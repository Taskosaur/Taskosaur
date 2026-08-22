import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as dns from 'dns/promises';
import type { LookupAddress } from 'dns';
import * as https from 'https';
import * as net from 'net';

/**
 * Parse JIRA_ALLOWED_HOSTS env var into a list of patterns.
 * Each entry is either an exact hostname or a wildcard like *.atlassian.net.
 * Wildcards match exactly one label (cert-wildcard semantics).
 * Default: *.atlassian.net
 */
function parseAllowlist(): string[] {
  const raw = process.env.JIRA_ALLOWED_HOSTS ?? '';
  const entries = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return entries.length ? entries : ['*.atlassian.net'];
}

function hostnameAllowed(hostname: string, allowlist: string[]): boolean {
  const host = hostname.toLowerCase();
  for (const pattern of allowlist) {
    if (pattern === '*') return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // e.g. ".atlassian.net"
      if (host.endsWith(suffix) && host.indexOf('.') === host.length - suffix.length) {
        return true;
      }
    } else if (pattern === host) {
      return true;
    }
  }
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b, c] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase().split('%')[0];
    if (normalized === '::1' || normalized === '::') return true;
    const ipv4Match = normalized.match(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (ipv4Match) return isPrivateIp(ipv4Match[1]);
    const firstGroup = parseInt(normalized.split(':')[0] || '0', 16);
    if ((firstGroup & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((firstGroup & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    return false;
  }
  return true;
}

/**
 * Jira project keys are letters, digits and underscores starting with a letter;
 * the REST API also accepts a numeric project id. Anything else is refused
 * rather than escaped, because this value is used in two places where escaping
 * would have to be different and getting either one wrong is a security bug:
 *
 * - a URL path segment, where `../` walks up out of `/rest/api/3` and reaches
 *   any other endpoint on the connected site under the stored credentials;
 * - a double-quoted JQL literal, where a `"` closes the string early and the
 *   rest of the key becomes query syntax.
 *
 * A single strict shape check covers both, and it costs nothing: no real Jira
 * key has ever contained a slash, a quote, or a space.
 */
const JIRA_PROJECT_KEY = /^(?:[A-Za-z][A-Za-z0-9_]{0,254}|[0-9]{1,19})$/;

function assertProjectKey(projectKey: string): string {
  if (typeof projectKey !== 'string' || !JIRA_PROJECT_KEY.test(projectKey)) {
    throw new BadRequestException('Invalid Jira project key');
  }
  return projectKey;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  avatarUrls: Record<string, string>;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

export interface JiraIssue {
  id: string;
  key: string; // e.g. PROJ-1
  fields: {
    summary: string;
    description?: any; // Jira ADF or plain text
    status: {
      id: string;
      name: string;
      statusCategory?: {
        id: number;
        key: string; // 'new' | 'indeterminate' | 'done'
        name: string;
      };
    };
    priority: {
      id: string;
      name: string;
    };
    duedate?: string | null;
    assignee?: {
      emailAddress: string;
      displayName: string;
    } | null;
    reporter?: {
      emailAddress: string;
      displayName: string;
    } | null;
  };
}

@Injectable()
export class JiraApiService {
  private readonly logger = new Logger(JiraApiService.name);
  private readonly allowlist: string[] = parseAllowlist();

  private async resolveSite(siteUrl: string): Promise<{
    origin: string;
    requestOrigin: string;
    hostHeader: string;
    agent: https.Agent;
  }> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(siteUrl);
    } catch {
      throw new BadRequestException('Invalid Jira site URL');
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new BadRequestException('Jira site URL must use HTTPS');
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new BadRequestException('Jira site URL must not include credentials');
    }

    if (parsedUrl.search || parsedUrl.hash) {
      throw new BadRequestException('Jira site URL must not include query parameters or fragments');
    }

    if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
      throw new BadRequestException('Jira site URL must be a site origin (no path)');
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    if (!hostnameAllowed(hostname, this.allowlist)) {
      this.logger.warn(`SSRF blocked: hostname ${hostname} not in allowlist`);
      throw new BadRequestException('Invalid or unsupported Jira site URL');
    }

    let addresses: LookupAddress[];
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch {
      throw new BadRequestException(`Cannot resolve Jira hostname: ${hostname}`);
    }

    if (!addresses.length) {
      throw new BadRequestException(`Cannot resolve Jira hostname: ${hostname}`);
    }

    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        this.logger.warn(`SSRF blocked: ${hostname} resolved to private IP ${address}`);
        throw new BadRequestException('Invalid or unsupported Jira site URL');
      }
    }

    // Pin to first resolved address — prevents DNS rebinding after validation
    const { address: pinnedIp, family: pinnedFamily } = addresses[0];

    if (!pinnedIp || typeof pinnedFamily !== 'number' || pinnedFamily === 0) {
      this.logger.error(
        `DNS lookup for ${hostname} returned incomplete/invalid result: address=${pinnedIp}, family=${pinnedFamily} (type: ${typeof pinnedFamily})`,
      );
      throw new BadRequestException('Cannot resolve Jira hostname: invalid DNS response');
    }

    // Send to the address that was checked rather than to the name. A hostname
    // in the URL is resolved again when the socket opens, and that second
    // lookup is the gap DNS rebinding lives in; an address is not resolved at
    // all, so the gap is not there to exploit.
    //
    // The name still does its two jobs: `servername` drives SNI and with it
    // certificate verification, so a certificate that does not cover the site
    // still fails the handshake, and the Host header carries the name for
    // virtual hosting, which Atlassian needs because tenants share addresses.
    //
    // The agent is per-site because `servername` is fixed on it; a shared agent
    // would hand out a pooled connection carrying the wrong TLS name, which
    // servers answer with 421.
    const literalHost = net.isIPv6(pinnedIp) ? `[${pinnedIp}]` : pinnedIp;

    // Read the port as a number and range-check it rather than pasting the
    // text back into a URL: a number cannot carry anything else along with it.
    const port = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : 443;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new BadRequestException('Invalid or unsupported Jira site URL');
    }
    const agent = new https.Agent({ servername: hostname, keepAlive: false });

    const origin = `https://${hostname}`;
    const requestOrigin = `https://${literalHost}:${port}`;
    return { origin, requestOrigin, hostHeader: parsedUrl.host, agent };
  }

  private buildClient(
    site: { requestOrigin: string; hostHeader: string },
    agent: https.Agent,
    email: string,
    apiToken: string,
  ): AxiosInstance {
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
    return axios.create({
      baseURL: `${site.requestOrigin}/rest/api/3`,
      headers: {
        // The URL names the checked address, so the site's own name has to
        // travel in the Host header for the server to route the request.
        Host: site.hostHeader,
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      httpsAgent: agent,
      timeout: 20000,
      // A redirect names a destination none of the validation above has seen,
      // and following one would step around the allowlist, the address check,
      // and the pinned lookup in a single hop. Jira does not need them.
      maxRedirects: 0,
    });
  }

  /** Validate credentials by hitting /myself */
  async validateCredentials(siteUrl: string, email: string, apiToken: string): Promise<boolean> {
    try {
      const site = await this.resolveSite(siteUrl);
      const client = this.buildClient(site, site.agent, email, apiToken);
      await client.get('/myself');
      return true;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Jira credential validation failed: ${err.message}`);
      return false;
    }
  }

  /** List accessible Jira projects */
  async getProjects(siteUrl: string, email: string, apiToken: string): Promise<JiraProject[]> {
    try {
      const site = await this.resolveSite(siteUrl);
      const client = this.buildClient(site, site.agent, email, apiToken);
      const results: JiraProject[] = [];
      let startAt = 0;
      const maxResults = 50;

      while (true) {
        const { data } = await client.get('/project/search', {
          params: { startAt, maxResults, expand: 'description' },
        });
        results.push(...(data.values as JiraProject[]));
        if (data.isLast || results.length >= data.total) break;
        startAt += maxResults;
      }

      return results;
    } catch (err) {
      this.logger.error(`Failed to fetch Jira projects: ${err.message}`);
      throw new BadRequestException(
        `Jira API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /** List statuses for a specific project */
  async getProjectStatuses(
    siteUrl: string,
    projectKey: string,
    email: string,
    apiToken: string,
  ): Promise<JiraStatus[]> {
    const safeKey = assertProjectKey(projectKey);
    try {
      const site = await this.resolveSite(siteUrl);
      const client = this.buildClient(site, site.agent, email, apiToken);
      const { data } = await client.get(`/project/${encodeURIComponent(safeKey)}/statuses`);

      this.logger.log(
        `[DEBUG] Raw /project/${projectKey}/statuses response: ${JSON.stringify(data).substring(0, 2000)}`,
      );

      // data is an array of issue-type → statuses; flatten and deduplicate
      const statusMap = new Map<string, JiraStatus>();
      for (const issueType of data) {
        this.logger.log(
          `[DEBUG] Issue type "${String(issueType.name)}" has statuses: ${JSON.stringify((issueType.statuses as JiraStatus[])?.map((s) => ({ id: s.id, name: s.name })))}`,
        );
        for (const status of issueType.statuses as JiraStatus[]) {
          statusMap.set(status.id, status);
        }
      }

      const result = Array.from(statusMap.values());
      this.logger.log(
        `[DEBUG] Flattened statuses for ${projectKey}: ${JSON.stringify(result.map((s) => ({ id: s.id, name: s.name })))}`,
      );
      return result;
    } catch (err) {
      this.logger.error(`Failed to fetch Jira statuses for project ${projectKey}: ${err.message}`);
      throw new BadRequestException(
        `Jira API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /** Fetch all issues for a project via JQL (paginated) */
  async getIssues(
    siteUrl: string,
    projectKey: string,
    email: string,
    apiToken: string,
  ): Promise<JiraIssue[]> {
    const safeKey = assertProjectKey(projectKey);
    try {
      const site = await this.resolveSite(siteUrl);
      const client = this.buildClient(site, site.agent, email, apiToken);
      const results: JiraIssue[] = [];
      let startAt = 0;
      const maxResults = 100;

      while (true) {
        const { data } = await client.get('/search/jql', {
          params: {
            jql: `project = "${safeKey}" ORDER BY created ASC`,
            startAt,
            maxResults,
            fields: [
              'summary',
              'description',
              'status',
              'priority',
              'duedate',
              'assignee',
              'reporter',
            ].join(','),
          },
        });

        // Log the raw top-level response shape (first page only)
        if (startAt === 0) {
          const rawData = data as Record<string, unknown>;
          this.logger.log(`[DEBUG] /search/jql response keys: ${Object.keys(rawData).join(', ')}`);
          const issuesList = rawData['issues'] as unknown[];
          this.logger.log(
            `[DEBUG] /search/jql total=${String(rawData['total'])}, issues count=${issuesList?.length ?? 'N/A'}, isLast=${String(rawData['isLast'])}`,
          );
          if (issuesList && issuesList.length > 0) {
            const sample = issuesList[0] as Record<string, unknown>;
            this.logger.log(`[DEBUG] Sample issue keys: ${Object.keys(sample).join(', ')}`);
            const sampleFields = sample['fields'] as Record<string, unknown> | undefined;
            this.logger.log(
              `[DEBUG] Sample issue.fields keys: ${Object.keys(sampleFields || {}).join(', ')}`,
            );
            this.logger.log(
              `[DEBUG] Sample issue full dump: ${JSON.stringify(sample).substring(0, 3000)}`,
            );
          } else {
            this.logger.warn(
              `[DEBUG] /search/jql returned 0 issues for project ${projectKey}. Full response: ${JSON.stringify(rawData).substring(0, 1000)}`,
            );
          }
        }

        const issues = (data.issues as JiraIssue[]) || [];
        this.logger.log(
          `Jira API returned ${issues.length} issues for project ${projectKey} (isLast: ${data.isLast}, total: ${data.total})`,
        );
        results.push(...issues);

        if (
          data.isLast ||
          (data.total !== undefined && results.length >= data.total) ||
          issues.length === 0
        )
          break;
        startAt += issues.length;
      }

      return results;
    } catch (err) {
      if (err.response) {
        this.logger.error(
          `Jira API error for project ${projectKey}: ${err.response.status} ${JSON.stringify(
            err.response.data,
          )}`,
        );
      } else {
        this.logger.error(`Jira API error for project ${projectKey}: ${err.message}`);
      }
      throw new BadRequestException(
        `Jira API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /**
   * Fetch issues for a project in batches (streaming) via JQL.
   * Supports incremental syncing using lastSyncAt.
   */
  async *getIssuesBatch(
    siteUrl: string,
    projectKey: string,
    email: string,
    apiToken: string,
    lastSyncAt?: Date,
  ): AsyncGenerator<JiraIssue[]> {
    const safeKey = assertProjectKey(projectKey);
    try {
      const site = await this.resolveSite(siteUrl);
      const client = this.buildClient(site, site.agent, email, apiToken);
      let startAt = 0;
      const maxResults = 100;

      let jql = `project = "${safeKey}"`;
      if (lastSyncAt) {
        // Jira JQL format: yyyy/MM/dd HH:mm
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formattedDate = `${lastSyncAt.getUTCFullYear()}/${pad(lastSyncAt.getUTCMonth() + 1)}/${pad(lastSyncAt.getUTCDate())} ${pad(lastSyncAt.getUTCHours())}:${pad(lastSyncAt.getUTCMinutes())}`;
        jql += ` AND updated >= "${formattedDate}"`;
      }
      jql += ` ORDER BY created ASC`;

      this.logger.log(`Executing Jira JQL: ${jql}`);

      while (true) {
        const { data } = await client.get('/search/jql', {
          params: {
            jql,
            startAt,
            maxResults,
            fields: [
              'summary',
              'description',
              'status',
              'priority',
              'duedate',
              'assignee',
              'reporter',
            ].join(','),
          },
        });

        const issues = (data.issues as JiraIssue[]) || [];
        this.logger.log(
          `Jira API yielded batch of ${issues.length} issues for project ${projectKey} (startAt: ${startAt}, isLast: ${data.isLast}, total: ${data.total})`,
        );

        if (issues.length > 0) {
          yield issues;
        }

        if (
          data.isLast ||
          (data.total !== undefined && startAt + issues.length >= data.total) ||
          issues.length === 0
        ) {
          break;
        }
        startAt += issues.length;
      }
    } catch (err) {
      if (err.response) {
        this.logger.error(
          `Jira API batch error for project ${projectKey}: ${err.response.status} ${JSON.stringify(
            err.response.data,
          )}`,
        );
      } else {
        this.logger.error(`Jira API batch error for project ${projectKey}: ${err.message}`);
      }
      throw new BadRequestException(
        `Jira API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }
}

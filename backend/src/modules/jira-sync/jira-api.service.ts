import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

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

  private buildClient(siteUrl: string, email: string, apiToken: string): AxiosInstance {
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
    return axios.create({
      baseURL: `${siteUrl.replace(/\/$/, '')}/rest/api/3`,
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  }

  /** Validate credentials by hitting /myself */
  async validateCredentials(siteUrl: string, email: string, apiToken: string): Promise<boolean> {
    try {
      const client = this.buildClient(siteUrl, email, apiToken);
      await client.get('/myself');
      return true;
    } catch (err) {
      this.logger.warn(`Jira credential validation failed: ${err.message}`);
      return false;
    }
  }

  /** List accessible Jira projects */
  async getProjects(siteUrl: string, email: string, apiToken: string): Promise<JiraProject[]> {
    try {
      const client = this.buildClient(siteUrl, email, apiToken);
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
    try {
      const client = this.buildClient(siteUrl, email, apiToken);
      const { data } = await client.get(`/project/${projectKey}/statuses`);

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
    try {
      const client = this.buildClient(siteUrl, email, apiToken);
      const results: JiraIssue[] = [];
      let startAt = 0;
      const maxResults = 100;

      while (true) {
        const { data } = await client.get('/search/jql', {
          params: {
            jql: `project = "${projectKey}" ORDER BY created ASC`,
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
    try {
      const client = this.buildClient(siteUrl, email, apiToken);
      let startAt = 0;
      const maxResults = 100;

      let jql = `project = "${projectKey}"`;
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

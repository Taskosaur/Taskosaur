import * as dns from 'dns/promises';
import type { LookupAddress } from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

/**
 * Shared protections for outbound requests whose destination comes from
 * configuration rather than from this codebase.
 *
 * Anywhere an operator or a user supplies a URL that the server then fetches,
 * the server can be aimed at things only it can reach: cloud metadata, an
 * internal admin port, a database's HTTP interface. The checks here exist to
 * stop that, and they have to work together, because each one alone is
 * bypassable:
 *
 *   - Parsing rules refuse shapes that hide a destination (credentials in the
 *     URL, a path or query that redirects meaning).
 *   - Every address the hostname resolves to is checked, not just the first,
 *     so a name that returns one public and one private address is refused.
 *   - The connection is pinned to the address that was checked, so a name that
 *     resolves differently a moment later (DNS rebinding) cannot move it.
 *   - Redirects are refused by the caller, because a redirect is a fresh
 *     destination that none of the above has seen.
 *
 * The Jira integration used these rules first; they live here so the AI
 * provider endpoint is held to the same standard rather than a weaker copy.
 */

/** Parse a comma-separated allowlist env var into lowercase patterns. */
export function parseHostAllowlist(raw: string | undefined, fallback: string[]): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return entries.length ? entries : fallback;
}

/**
 * Match a hostname against an allowlist. `*` allows everything; `*.example.com`
 * matches exactly one label, the same way a wildcard certificate does, so it
 * cannot be widened by an extra dot.
 */
export function hostnameAllowed(hostname: string, allowlist: string[]): boolean {
  const host = hostname.toLowerCase();
  for (const pattern of allowlist) {
    if (pattern === '*') return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // ".example.com"
      if (host.endsWith(suffix) && host.indexOf('.') === host.length - suffix.length) {
        return true;
      }
    } else if (pattern === host) {
      return true;
    }
  }
  return false;
}

/**
 * Is this address one that only the server can reach? Covers loopback, the
 * private ranges, link-local (including cloud metadata at 169.254.169.254),
 * carrier-grade NAT, the documentation ranges, and multicast. An address this
 * does not recognise as a public unicast address is treated as private, so a
 * parsing surprise fails closed.
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number);
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

export interface SafeDestinationOptions {
  /** Hostname patterns that may be reached at all. */
  allowlist: string[];
  /**
   * Permit http:// and addresses only the server can reach. Off by default.
   * A deployment that genuinely fetches from its own network (a self-hosted
   * model server, say) turns this on knowingly, and it is the operator's
   * decision rather than something a request can ask for.
   */
  allowPrivate?: boolean;
  /** Require the URL to be a bare origin with no path. */
  originOnly?: boolean;
}

export interface SafeDestination {
  /** The origin to send to, rebuilt from the validated parts. */
  origin: string;
  /** The validated URL, including its path when originOnly is off. */
  url: string;
  hostname: string;
  /** An agent pinned to the checked address, for http or https as parsed. */
  agent: http.Agent | https.Agent;
}

/** Raised when a destination is refused. Callers map it to a 400. */
export class UnsafeDestinationError extends Error {}

/**
 * Validate a caller-supplied URL and return an agent pinned to the address that
 * was actually checked.
 *
 * Refusal messages stay vague on purpose. A precise reason ("resolved to
 * 10.0.0.5") turns this into a scanner for the internal network, so the caller
 * learns only that the destination was refused; the specific reason is logged
 * for the operator instead.
 */
export async function resolveSafeDestination(
  rawUrl: string,
  opts: SafeDestinationOptions,
  onReject?: (reason: string) => void,
): Promise<SafeDestination> {
  const reject = (reason: string): never => {
    onReject?.(reason);
    throw new UnsafeDestinationError('Invalid or unsupported URL');
  };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeDestinationError('Invalid URL format');
  }

  const isHttps = parsed.protocol === 'https:';
  const isHttp = parsed.protocol === 'http:';
  if (!isHttps && !(isHttp && opts.allowPrivate)) {
    return reject(`protocol ${parsed.protocol} not permitted`);
  }

  // Credentials in a URL are a way to make one destination look like another.
  if (parsed.username || parsed.password) {
    return reject('URL must not include credentials');
  }

  if (opts.originOnly) {
    if (parsed.search || parsed.hash) {
      return reject('URL must not include query parameters or a fragment');
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      return reject('URL must be an origin with no path');
    }
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostnameAllowed(hostname, opts.allowlist)) {
    return reject(`hostname ${hostname} is not in the allowlist`);
  }

  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeDestinationError(`Cannot resolve hostname: ${hostname}`);
  }
  if (!addresses.length) {
    throw new UnsafeDestinationError(`Cannot resolve hostname: ${hostname}`);
  }

  // Every address, not just the one that will be used: a name resolving to both
  // a public and a private address must not be usable to reach the private one.
  if (!opts.allowPrivate) {
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return reject(`${hostname} resolved to non-public address ${address}`);
      }
    }
  }

  const { address: pinnedIp, family: pinnedFamily } = addresses[0];
  if (!pinnedIp || typeof pinnedFamily !== 'number' || pinnedFamily === 0) {
    throw new UnsafeDestinationError('Cannot resolve hostname: invalid DNS response');
  }

  // Pinning the checked address is what closes the gap between the check and
  // the connection: without it the name can resolve to something else in
  // between, and the request goes wherever the second answer points.
  const pinnedLookup = (
    lookupHostname: string,
    _opts: unknown,
    cb: (err: Error | null, address: string, family: number) => void,
  ) => {
    if (lookupHostname.toLowerCase() !== hostname.toLowerCase()) {
      return cb(new Error(`Unexpected host: ${lookupHostname}`), '', 0);
    }
    cb(null, pinnedIp, pinnedFamily);
  };

  const agent = isHttps
    ? Object.assign(new https.Agent({ lookup: pinnedLookup }), { lookup: pinnedLookup })
    : Object.assign(new http.Agent({ lookup: pinnedLookup }), { lookup: pinnedLookup });

  const origin = `${parsed.protocol}//${parsed.host}`;
  return {
    origin,
    url: opts.originOnly ? origin : parsed.toString(),
    hostname,
    agent,
  };
}

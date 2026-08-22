import * as dns from 'dns/promises';
import {
  resolveSafeDestination,
  UnsafeDestinationError,
  hostnameAllowed,
  isPrivateIp,
  parseHostAllowlist,
} from '../src/common/safe-outbound-http';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

const dnsLookup = dns.lookup as unknown as jest.Mock;

/**
 * The AI provider endpoint is read from settings that any authenticated user can
 * write, and the server then sends a POST to it and hands the reply back. That
 * makes it a request-forgery surface: without these checks a user could aim the
 * server at cloud metadata, an internal admin port, or any service reachable
 * only from inside, and read the answer through the error path.
 *
 * These tests cover the shared guard that now sits in front of it. They mock DNS
 * so nothing here touches the network.
 */
describe('Outbound request guard for user-supplied endpoints (e2e)', () => {
  const publicAddress = [{ address: '93.184.216.34', family: 4 }];

  beforeEach(() => {
    dnsLookup.mockReset();
    dnsLookup.mockResolvedValue(publicAddress);
  });

  const resolve = (url: string, opts: Partial<Parameters<typeof resolveSafeDestination>[1]> = {}) =>
    resolveSafeDestination(url, { allowlist: ['*'], ...opts });

  describe('addresses only the server can reach', () => {
    // Each of these is a destination a user must not be able to aim the server
    // at: the cloud metadata service, the host itself, and the private ranges.
    const internal: Array<[string, string]> = [
      ['cloud metadata', '169.254.169.254'],
      ['loopback', '127.0.0.1'],
      ['private 10/8', '10.0.0.5'],
      ['private 172.16/12', '172.16.0.5'],
      ['private 192.168/16', '192.168.1.5'],
      ['carrier-grade NAT', '100.64.0.1'],
      ['IPv6 loopback', '::1'],
      ['IPv6 unique local', 'fd00::1'],
    ];

    it.each(internal)('refuses a hostname resolving to %s', async (_label, address) => {
      dnsLookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]);
      await expect(resolve('https://evil.example.com')).rejects.toBeInstanceOf(
        UnsafeDestinationError,
      );
    });

    it('refuses when only one of several answers is internal', async () => {
      // A name that returns a public and a private address must not be usable:
      // checking just the first answer would let the private one through.
      dnsLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ]);
      await expect(resolve('https://split.example.com')).rejects.toBeInstanceOf(
        UnsafeDestinationError,
      );
    });

    it('allows an internal address only when the operator has opted in', async () => {
      dnsLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      const dest = await resolve('http://localhost:11434', { allowPrivate: true });
      expect(dest.hostname).toBe('localhost');
    });
  });

  describe('URL shapes that hide a destination', () => {
    it('refuses credentials embedded in the URL', async () => {
      await expect(resolve('https://user:pass@example.com')).rejects.toBeInstanceOf(
        UnsafeDestinationError,
      );
    });

    it('refuses a non-http scheme', async () => {
      await expect(resolve('file:///etc/passwd')).rejects.toBeInstanceOf(UnsafeDestinationError);
      await expect(resolve('gopher://example.com')).rejects.toBeInstanceOf(UnsafeDestinationError);
    });

    it('refuses plain http unless the operator has opted in', async () => {
      await expect(resolve('http://example.com')).rejects.toBeInstanceOf(UnsafeDestinationError);
    });

    it('refuses a malformed URL', async () => {
      await expect(resolve('not a url')).rejects.toBeInstanceOf(UnsafeDestinationError);
    });

    it('refuses a path or query when the caller wants an origin', async () => {
      await expect(resolve('https://example.com/admin', { originOnly: true })).rejects.toBeInstanceOf(
        UnsafeDestinationError,
      );
      await expect(resolve('https://example.com/?a=b', { originOnly: true })).rejects.toBeInstanceOf(
        UnsafeDestinationError,
      );
    });

    it('keeps the path when the caller allows one', async () => {
      const dest = await resolve('https://api.example.com/v1');
      expect(dest.url).toContain('/v1');
    });
  });

  describe('allowlisting', () => {
    it('refuses a hostname outside the allowlist', async () => {
      await expect(
        resolve('https://elsewhere.example.com', { allowlist: ['*.openai.com'] }),
      ).rejects.toBeInstanceOf(UnsafeDestinationError);
    });

    it('accepts a hostname the allowlist covers', async () => {
      const dest = await resolve('https://api.openai.com', { allowlist: ['*.openai.com'] });
      expect(dest.hostname).toBe('api.openai.com');
    });

    it('matches one label only, the way a wildcard certificate does', () => {
      expect(hostnameAllowed('api.openai.com', ['*.openai.com'])).toBe(true);
      // A deeper subdomain is a different host and must not match.
      expect(hostnameAllowed('a.b.openai.com', ['*.openai.com'])).toBe(false);
      // Nor does the bare apex, which has no leading label.
      expect(hostnameAllowed('openai.com', ['*.openai.com'])).toBe(false);
      // Nor a name that merely ends with the same characters.
      expect(hostnameAllowed('evilopenai.com', ['*.openai.com'])).toBe(false);
    });
  });

  describe('pinning the checked address', () => {
    it('pins the connection so the name cannot resolve elsewhere afterwards', async () => {
      const dest = await resolve('https://api.example.com');
      const lookup = (dest.agent as any).lookup as (
        host: string,
        opts: unknown,
        cb: (e: Error | null, addr: string, fam: number) => void,
      ) => void;

      // The host that was checked resolves to the address that was checked.
      const forChecked = jest.fn();
      lookup('api.example.com', {}, forChecked);
      expect(forChecked).toHaveBeenCalledWith(null, '93.184.216.34', 4);

      // Any other host is refused, so a redirect or a rebind cannot move it.
      const forOther = jest.fn();
      lookup('169.254.169.254', {}, forOther);
      expect(forOther.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('supporting helpers', () => {
    it('treats an unparseable address as internal, so a surprise fails closed', () => {
      expect(isPrivateIp('not-an-ip')).toBe(true);
    });

    it('falls back to the default allowlist when the env var is unset or empty', () => {
      expect(parseHostAllowlist(undefined, ['*.atlassian.net'])).toEqual(['*.atlassian.net']);
      expect(parseHostAllowlist('  ,  ', ['*.atlassian.net'])).toEqual(['*.atlassian.net']);
      expect(parseHostAllowlist('a.com, B.COM', ['*'])).toEqual(['a.com', 'b.com']);
    });
  });
});

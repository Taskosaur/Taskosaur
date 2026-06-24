import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as dns from 'dns/promises';
import { JiraApiService } from '../src/modules/jira-sync/jira-api.service';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

jest.mock('axios');

const dnsLookup = dns.lookup as any;
const axiosCreate = axios.create as any;

function makeClientMock(extra: Record<string, unknown> = {}) {
  return {
    get: jest.fn().mockResolvedValue({ data: { values: [], isLast: true, total: 0 } }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    ...extra,
  } as unknown as ReturnType<typeof axios.create>;
}

describe('JiraApiService SSRF guard (e2e)', () => {
  const originalEnv = process.env.JIRA_ALLOWED_HOSTS;

  beforeAll(() => {
    delete process.env.JIRA_ALLOWED_HOSTS;
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.JIRA_ALLOWED_HOSTS;
    } else {
      process.env.JIRA_ALLOWED_HOSTS = originalEnv;
    }
  });

  beforeEach(() => {
    dnsLookup.mockReset();
    axiosCreate.mockReset();
  });

  describe('URL parsing and scheme', () => {
    it('rejects malformed URLs', async () => {
      const service = new JiraApiService();
      await expect(service.getProjects('not-a-url', 'a@b.c', 'tok')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects http:// scheme', async () => {
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
      await expect(
        service.getProjects('http://acme.atlassian.net', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/HTTPS/i) });
    });

    it('rejects ftp:// scheme', async () => {
      const service = new JiraApiService();
      await expect(
        service.getProjects('ftp://acme.atlassian.net', 'a@b.c', 'tok'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects URL with embedded credentials', async () => {
      const service = new JiraApiService();
      await expect(
        service.getProjects('https://admin:password@acme.atlassian.net', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/must not include credentials/i) });
    });

    it('rejects URL with query parameters', async () => {
      const service = new JiraApiService();
      await expect(
        service.getProjects('https://acme.atlassian.net?foo=bar', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/must not include query/i) });
    });

    it('rejects URL with fragment', async () => {
      const service = new JiraApiService();
      await expect(
        service.getProjects('https://acme.atlassian.net#section', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/must not include query/i) });
    });

    it('rejects URL with path beyond origin', async () => {
      const service = new JiraApiService();
      await expect(
        service.getProjects('https://acme.atlassian.net/rest/api/3', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/must be a site origin/i) });
    });
  });

  describe('default allowlist (*.atlassian.net)', () => {
    let service: JiraApiService;

    beforeEach(() => {
      service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
    });

    it('accepts a single-label *.atlassian.net hostname', async () => {
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      const result = await service.getProjects('https://acme.atlassian.net', 'a@b.c', 'tok');

      expect(result).toEqual([]);
      expect(axiosCreate).toHaveBeenCalledTimes(1);
      const opts = axiosCreate.mock.calls[0]?.[0];
      expect(opts?.baseURL).toBe('https://acme.atlassian.net/rest/api/3');
      expect(opts?.httpsAgent).toBeDefined();
    });

    it('rejects a non-atlassian hostname', async () => {
      await expect(
        service.getProjects('https://example.com', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('rejects the bare apex (atlassian.net has no leading label)', async () => {
      await expect(
        service.getProjects('https://atlassian.net', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
    });

    it('rejects a multi-label subdomain against the single-label wildcard', async () => {
      await expect(
        service.getProjects('https://foo.bar.atlassian.net', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
    });

    it('rejects a different TLD that contains atlassian.net as a label', async () => {
      await expect(
        service.getProjects('https://atlassian.net.evil.example', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
    });

    it('matches case-insensitively', async () => {
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await expect(
        service.getProjects('https://ACME.ATLASSIAN.NET', 'a@b.c', 'tok'),
      ).resolves.toEqual([]);
    });
  });

  describe('JIRA_ALLOWED_HOSTS custom entries', () => {
    it('honors a custom exact-match hostname', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      const result = await service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok');

      expect(result).toEqual([]);
      expect(axiosCreate).toHaveBeenCalled();
    });

    it('honors a custom wildcard (*.mycompany.com)', async () => {
      process.env.JIRA_ALLOWED_HOSTS = '*.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await expect(
        service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
      ).resolves.toEqual([]);
    });

    it('rejects a non-matching host even with a custom allowlist', async () => {
      process.env.JIRA_ALLOWED_HOSTS = '*.mycompany.com';
      const service = new JiraApiService();
      await expect(
        service.getProjects('https://acme.atlassian.net', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
    });

    it('falls back to the default allowlist when JIRA_ALLOWED_HOSTS is blank', async () => {
      process.env.JIRA_ALLOWED_HOSTS = '   ,  ,';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await expect(
        service.getProjects('https://acme.atlassian.net', 'a@b.c', 'tok'),
      ).resolves.toEqual([]);
    });

    it('supports a comma-separated allowlist mixing exact and wildcard entries', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'foo.example, *.bar.example';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await expect(
        service.getProjects('https://x.bar.example', 'a@b.c', 'tok'),
      ).resolves.toEqual([]);
    });
  });

  describe('private / reserved IPv4 blocking', () => {
    let service: JiraApiService;

    beforeEach(() => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      service = new JiraApiService();
    });

    const privateIps: Array<[string, string]> = [
      ['loopback (127.0.0.0/8)', '127.0.0.1'],
      ['RFC1918 10/8', '10.0.0.1'],
      ['RFC1918 172.16/12', '172.20.5.4'],
      ['RFC1918 192.168/16', '192.168.1.10'],
      ['link-local / AWS metadata (169.254/16)', '169.254.169.254'],
      ['CGN (100.64/10)', '100.64.10.20'],
      ['0.0.0.0/8', '0.1.2.3'],
      ['benchmarking (198.18/15)', '198.18.0.1'],
      ['TEST-NET-1 (192.0.2/24)', '192.0.2.5'],
      ['TEST-NET-2 (198.51.100/24)', '198.51.100.5'],
      ['TEST-NET-3 (203.0.113/24)', '203.0.113.5'],
      ['multicast (224.0.0.0/4)', '224.0.0.1'],
      ['reserved (240.0.0.0/4)', '240.0.0.1'],
      ['broadcast 255.255.255.255', '255.255.255.255'],
    ];

    for (const [name, ip] of privateIps) {
      it(`blocks ${name} (${ip})`, async () => {
        dnsLookup.mockResolvedValue([{ address: ip, family: 4 }]);
        await expect(
          service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
        expect(axiosCreate).not.toHaveBeenCalled();
      });
    }
  });

  describe('private / reserved IPv6 blocking', () => {
    let service: JiraApiService;

    beforeEach(() => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      service = new JiraApiService();
    });

    const privateIps: Array<[string, string]> = [
      ['unspecified (::)', '::'],
      ['loopback (::1)', '::1'],
      ['ULA (fc00::/7) low end', 'fc00::1'],
      ['ULA (fd00::/8)', 'fd00::1'],
      ['link-local (fe80::/10)', 'fe80::1'],
      ['mapped loopback (::ffff:127.0.0.1)', '::ffff:127.0.0.1'],
      ['mapped private (::ffff:10.0.0.1)', '::ffff:10.0.0.1'],
    ];

    for (const [name, ip] of privateIps) {
      it(`blocks ${name} (${ip})`, async () => {
        dnsLookup.mockResolvedValue([{ address: ip, family: 6 }]);
        await expect(
          service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
        expect(axiosCreate).not.toHaveBeenCalled();
      });
    }
  });

  describe('mixed DNS answers', () => {
    it('blocks when at least one A record is private', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([
        { address: '104.18.0.1', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]);
      await expect(
        service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/invalid or unsupported/i) });
    });

    it('accepts when all A records are public', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([
        { address: '104.18.0.1', family: 4 },
        { address: '104.18.0.2', family: 4 },
      ]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);
      await expect(
        service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
      ).resolves.toEqual([]);
    });
  });

  describe('DNS failure', () => {
    it('rejects when dns.lookup throws ENOTFOUND', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockRejectedValue(new Error('ENOTFOUND'));
      await expect(
        service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/cannot resolve/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('rejects when dns.lookup returns an empty list', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([]);
      await expect(
        service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/cannot resolve/i) });
    });
  });

  describe('IP pinning via httpsAgent', () => {
    let service: JiraApiService;

    beforeEach(() => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      service = new JiraApiService();
    });

    it('passes an httpsAgent with a custom lookup to axios.create', async () => {
      dnsLookup.mockResolvedValue([{ address: '104.18.0.1', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok');

      const opts = axiosCreate.mock.calls[0]?.[0];
      expect(opts?.httpsAgent).toBeDefined();
      expect(typeof (opts?.httpsAgent as { lookup?: unknown })?.lookup).toBe('function');
    });

    it('the lookup pins the resolved IP for the expected hostname', async () => {
      dnsLookup.mockResolvedValue([{ address: '104.18.0.2', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok');

      const opts = axiosCreate.mock.calls[0]?.[0];
      const lookup = (opts?.httpsAgent as { lookup: Function }).lookup;
      expect(typeof lookup).toBe('function');

      const cb = jest.fn();
      lookup('jira.mycompany.com', {}, cb);
      expect(cb).toHaveBeenCalledWith(null, '104.18.0.2', 4);
    });

    it('the lookup blocks lookups for any other hostname (DNS rebinding mitigation)', async () => {
      dnsLookup.mockResolvedValue([{ address: '104.18.0.3', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok');

      const opts = axiosCreate.mock.calls[0]?.[0];
      const lookup = (opts?.httpsAgent as { lookup: Function }).lookup;

      const cb = jest.fn();
      lookup('attacker.example', {}, cb);
      expect(cb).toHaveBeenCalledTimes(1);
      const err = cb.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(String(err)).toMatch(/unexpected host/i);
    });

    it('validates dns.lookup is called with { all: true }', async () => {
      dnsLookup.mockResolvedValue([{ address: '104.18.0.4', family: 4 }]);
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await service.getProjects('https://jira.mycompany.com', 'a@b.c', 'tok');

      expect(dnsLookup).toHaveBeenCalledWith('jira.mycompany.com', { all: true });
    });
  });

  describe('validateCredentials behavior on rejection', () => {
    it('throws BadRequestException (does not swallow) when the URL is SSRF-blocked', async () => {
      process.env.JIRA_ALLOWED_HOSTS = 'jira.mycompany.com';
      const service = new JiraApiService();
      dnsLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(
        service.validateCredentials('https://jira.mycompany.com', 'a@b.c', 'tok'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(axiosCreate).not.toHaveBeenCalled();
    });
  });

  describe('credentials not echoed in error messages', () => {
    it('does not include the user-supplied URL in the error text for unknown hosts', async () => {
      const service = new JiraApiService();
      try {
        await service.getProjects('https://attacker-controlled.example/secret-path', 'a@b.c', 'tok');
        fail('Expected BadRequestException');
      } catch (err) {
        expect((err as Error).message).not.toContain('secret-path');
        expect((err as Error).message).not.toContain('attacker-controlled.example');
      }
    });
  });
});

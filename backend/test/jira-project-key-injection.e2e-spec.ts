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

/**
 * The Jira project key arrives from `@Param('projectKey')` and reaches two
 * places that treat it as syntax rather than data: a URL path segment under
 * `/rest/api/3`, and a double-quoted JQL literal. Neither escaped it.
 *
 * A key of `../../myself` walks out of the API version prefix and reaches any
 * other endpoint on the connected site using the stored Jira credentials. A key
 * containing a double quote closes the JQL string and appends query syntax,
 * which changes which issues the sync pulls.
 */
describe('Jira project key injection (e2e)', () => {
  const SITE = 'https://acme.atlassian.net';
  let clientGet: jest.Mock;

  beforeEach(() => {
    dnsLookup.mockReset();
    axiosCreate.mockReset();
    dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    // /project/:key/statuses answers with an array of issue types; the search
    // endpoints answer with a paging envelope.
    clientGet = jest.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/statuses')
          ? { data: [] }
          : { data: { values: [], issues: [], isLast: true, total: 0 } },
      ),
    );
    axiosCreate.mockReturnValue({ get: clientGet } as any);
  });

  const service = () => new JiraApiService();

  const TRAVERSAL = [
    '../../myself',
    '..%2f..%2fmyself',
    'ABC/../../myself',
    'ABC?expand=all',
    'ABC#frag',
    '/absolute',
    'ABC/statuses/../../serverInfo',
  ];

  describe('URL path segment', () => {
    it.each(TRAVERSAL)('refuses a traversing project key %p', async (key) => {
      await expect(
        service().getProjectStatuses(SITE, key, 'a@b.com', 'token'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(clientGet).not.toHaveBeenCalled();
    });

    it('accepts an ordinary key and keeps it inside the project path', async () => {
      await service().getProjectStatuses(SITE, 'TASK', 'a@b.com', 'token');
      expect(clientGet).toHaveBeenCalledWith('/project/TASK/statuses');
    });

    it('accepts a numeric project id', async () => {
      await service().getProjectStatuses(SITE, '10042', 'a@b.com', 'token');
      expect(clientGet).toHaveBeenCalledWith('/project/10042/statuses');
    });
  });

  const JQL_BREAKERS = [
    'A" OR project != "',
    'A" ORDER BY created DESC--',
    'A"',
    "A' OR '1'='1",
    'A OR project = B',
    'A AND assignee = currentUser()',
  ];

  describe('JQL string literal', () => {
    it.each(JQL_BREAKERS)('refuses a key that breaks out of the JQL literal %p', async (key) => {
      await expect(
        service().getIssues(SITE, key, 'a@b.com', 'token'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(clientGet).not.toHaveBeenCalled();
    });

    it('builds the JQL from an ordinary key', async () => {
      await service().getIssues(SITE, 'TASK', 'a@b.com', 'token');
      const [, config] = clientGet.mock.calls[0];
      expect(config.params.jql).toBe('project = "TASK" ORDER BY created ASC');
    });

    it('refuses a breaking key in the batch generator too', async () => {
      const gen = service().getIssuesBatch(SITE, 'A" OR project != "', 'a@b.com', 'token');
      await expect(gen.next()).rejects.toBeInstanceOf(BadRequestException);
      expect(clientGet).not.toHaveBeenCalled();
    });
  });

  it('refuses an over-long key rather than sending it', async () => {
    await expect(
      service().getProjectStatuses(SITE, 'A'.repeat(300), 'a@b.com', 'token'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(clientGet).not.toHaveBeenCalled();
  });
});

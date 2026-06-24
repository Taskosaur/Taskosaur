import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { TrelloApiService } from '../src/modules/trello-sync/trello-api.service';

jest.mock('axios');

const axiosCreate = axios.create as any;

function makeClientMock() {
  return {
    get: jest.fn().mockResolvedValue({ data: [{ id: 'abc', name: 'List' }] }),
  } as unknown as ReturnType<typeof axios.create>;
}

const validBoardId = '5e9f8f8f8f8f8f8f8f8f8f8f';

describe('TrelloApiService SSRF guard (e2e)', () => {
  beforeEach(() => {
    axiosCreate.mockReset();
  });

  describe('sanitizeBoardId', () => {
    it('accepts a valid 24-character hex board ID', async () => {
      const service = new TrelloApiService();
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await service.getLists(validBoardId, 'key', 'tok');

      expect(axiosCreate).toHaveBeenCalled();
    });

    it('rejects a board ID with fewer than 24 characters', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getLists('short', 'key', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/Invalid Trello board ID/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('rejects a board ID with non-hex characters', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getLists('zzzzzzzzzzzzzzzzzzzzzzzz', 'key', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/Invalid Trello board ID/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('rejects a board ID with path traversal characters', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getLists('../../admin/boards', 'key', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/Invalid Trello board ID/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('rejects a board ID with URL encoding tricks', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getLists('%2e%2e%2f%2e%2e%2fadmin', 'key', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/Invalid Trello board ID/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('rejects empty string', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getLists('', 'key', 'tok'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(axiosCreate).not.toHaveBeenCalled();
    });
  });

  describe('getCards', () => {
    it('rejects invalid board ID', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getCards('bad-id', 'key', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/Invalid Trello board ID/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });
  });

  describe('getCardsBatch', () => {
    it('rejects invalid board ID', async () => {
      const service = new TrelloApiService();
      const generator = service.getCardsBatch('bad-id', 'key', 'tok');
      await expect(generator.next()).rejects.toMatchObject({
        message: expect.stringMatching(/Invalid Trello board ID/i),
      });
      expect(axiosCreate).not.toHaveBeenCalled();
    });
  });

  describe('getCard', () => {
    it('rejects invalid card ID', async () => {
      const service = new TrelloApiService();
      await expect(
        service.getCard('bad-id', 'key', 'tok'),
      ).rejects.toMatchObject({ message: expect.stringMatching(/Invalid Trello card ID/i) });
      expect(axiosCreate).not.toHaveBeenCalled();
    });

    it('accepts a valid 24-character hex card ID', async () => {
      const service = new TrelloApiService();
      const client = makeClientMock();
      axiosCreate.mockReturnValue(client);

      await service.getCard(validBoardId, 'key', 'tok');

      expect(axiosCreate).toHaveBeenCalled();
    });
  });
});

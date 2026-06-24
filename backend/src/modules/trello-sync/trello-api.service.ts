import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloCard {
  id: string;
  name: string; // title
  desc: string; // description
  due: string | null; // due date ISO string
  closed: boolean; // archived
  idList: string; // list ID
  labels: TrelloLabel[];
  url: string;
  dateLastActivity: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

@Injectable()
export class TrelloApiService {
  private readonly logger = new Logger(TrelloApiService.name);
  private readonly baseUrl = 'https://api.trello.com/1';

  private buildClient(apiKey: string, token: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      params: { key: apiKey, token },
      timeout: 15000,
    });
  }

  /** Validate that provided credentials work by fetching member boards */
  async validateCredentials(apiKey: string, token: string): Promise<boolean> {
    try {
      const client = this.buildClient(apiKey, token);
      await client.get('/members/me');
      return true;
    } catch (err) {
      this.logger.warn(`Trello credential validation failed: ${err.message}`);
      return false;
    }
  }

  /** List all boards accessible by these credentials */
  async getBoards(apiKey: string, token: string): Promise<TrelloBoard[]> {
    try {
      const client = this.buildClient(apiKey, token);
      const { data } = await client.get<TrelloBoard[]>('/members/me/boards', {
        params: {
          key: apiKey,
          token,
          filter: 'open',
          fields: 'id,name,desc,url,closed',
        },
      });
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch Trello boards: ${err.message}`);
      throw new BadRequestException(
        `Trello API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /** Validate board ID format (24-character hex, Trello's standard) */
  private sanitizeBoardId(boardId: string): string {
    if (typeof boardId !== 'string' || !/^[0-9a-f]{24}$/i.test(boardId)) {
      throw new BadRequestException('Invalid Trello board ID format');
    }
    return boardId;
  }

  /** List all lists on a board */
  async getLists(boardId: string, apiKey: string, token: string): Promise<TrelloList[]> {
    const safeBoardId = this.sanitizeBoardId(boardId);
    try {
      const client = this.buildClient(apiKey, token);
      const { data } = await client.get<TrelloList[]>(`/boards/${safeBoardId}/lists`, {
        params: { key: apiKey, token, filter: 'open', fields: 'id,name,closed,pos' },
      });
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch Trello lists: ${err.message}`);
      throw new BadRequestException(
        `Trello API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /** Fetch all cards on a board (open and closed) */
  async getCards(boardId: string, apiKey: string, token: string): Promise<TrelloCard[]> {
    const safeBoardId = this.sanitizeBoardId(boardId);
    try {
      const client = this.buildClient(apiKey, token);
      const { data } = await client.get<TrelloCard[]>(`/boards/${safeBoardId}/cards`, {
        params: {
          key: apiKey,
          token,
          filter: 'all', // include archived cards
          fields: 'id,name,desc,due,closed,idList,labels,url,dateLastActivity',
        },
      });
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch Trello cards: ${err.message}`);
      throw new BadRequestException(
        `Trello API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /**
   * Fetch cards for a board in batches (streaming).
   * Uses Trello's limit and before pagination parameters.
   */
  async *getCardsBatch(
    boardId: string,
    apiKey: string,
    token: string,
  ): AsyncGenerator<TrelloCard[]> {
    const safeBoardId = this.sanitizeBoardId(boardId);
    try {
      const client = this.buildClient(apiKey, token);
      let before: string | undefined = undefined;
      const limit = 1000; // Trello API max limit

      while (true) {
        const params: any = {
          key: apiKey,
          token,
          filter: 'all',
          fields: 'id,name,desc,due,closed,idList,labels,url,dateLastActivity',
          limit,
        };

        if (before) {
          params.before = before;
        }

        const { data } = await client.get<TrelloCard[]>(`/boards/${safeBoardId}/cards`, { params });

        this.logger.log(`Trello API yielded batch of ${data.length} cards for board ${boardId}`);

        if (data.length > 0) {
          yield data;
          before = data[data.length - 1].id;
        }

        if (data.length < limit) {
          break; // Last page reached
        }
      }
    } catch (err) {
      this.logger.error(`Failed to fetch Trello cards batch: ${err.message}`);
      throw new BadRequestException(
        `Trello API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }

  /** Validate card ID format (24-character hex, same as board) */
  private sanitizeCardId(cardId: string): string {
    if (typeof cardId !== 'string' || !/^[0-9a-f]{24}$/i.test(cardId)) {
      throw new BadRequestException('Invalid Trello card ID format');
    }
    return cardId;
  }

  /** Fetch a single card */
  async getCard(cardId: string, apiKey: string, token: string): Promise<TrelloCard> {
    const safeCardId = this.sanitizeCardId(cardId);
    try {
      const client = this.buildClient(apiKey, token);
      const { data } = await client.get<TrelloCard>(`/cards/${safeCardId}`, {
        params: { key: apiKey, token },
      });
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch Trello card ${cardId}: ${err.message}`);
      throw new BadRequestException(
        `Trello API error: ${err.response?.data?.message || err.message}`,
      );
    }
  }
}

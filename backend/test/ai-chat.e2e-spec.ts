import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import {
  CreateConversationDto,
  RenameConversationDto,
  UpdateMessagesDto,
  ChatRequestDto,
  TestConnectionDto,
  GenerateDescriptionDto,
} from './../src/modules/ai-chat/dto/chat.dto';

describe('AiChatController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let user: any;
  let accessToken: string;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Create a test user
    user = await prismaService.user.create({
      data: {
        email: `ai-chat-test-${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        firstName: 'AiChat',
        lastName: 'Tester',
        username: `aichat_tester_${Date.now()}`,
        role: Role.MEMBER,
      },
    });

    // Generate token
    const payload = { sub: user.id, email: user.email, role: user.role };
    accessToken = jwtService.sign(payload);

    // Setup default AI settings for user
    await prismaService.settings.createMany({
      data: [
        {
          key: 'ai_enabled',
          value: 'true',
          userId: user.id,
          category: 'ai',
        },
        {
          key: 'ai_api_key',
          value: 'sk-mock-api-key',
          userId: user.id,
          category: 'ai',
        },
        {
          key: 'ai_model',
          value: 'gpt-4',
          userId: user.id,
          category: 'ai',
        },
        {
          key: 'ai_api_url',
          value: 'https://api.openai.com/v1',
          userId: user.id,
          category: 'ai',
        },
      ],
    });
  });

  beforeEach(async () => {
    fetchSpy = jest.spyOn(global, 'fetch');
    // Reset settings to default before each test to prevent test pollution
    await prismaService.settings.update({
      where: { userId_key: { userId: user.id, key: 'ai_enabled' } },
      data: { value: 'true' },
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    if (prismaService) {
      // Cleanup settings, conversations, and user
      await prismaService.settings.deleteMany({
        where: { userId: user.id },
      });
      await prismaService.conversation.deleteMany({
        where: { userId: user.id },
      });
      await prismaService.user.delete({
        where: { id: user.id },
      });
    }
    await app.close();
  });

  describe('Conversation Management', () => {
    let conversationId: string;
    const testSessionId = `test_session_${Date.now()}`;

    it('POST /ai-chat/conversations - should create a new conversation', () => {
      const dto: CreateConversationDto = {
        title: 'Initial Chat Title',
        sessionId: testSessionId,
      };

      return request(app.getHttpServer())
        .post('/api/ai-chat/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Initial Chat Title');
          expect(res.body.sessionId).toBe(testSessionId);
          expect(res.body.userId).toBe(user.id);
          conversationId = res.body.id;
        });
    });

    it('GET /ai-chat/conversations - should retrieve all conversations for user', () => {
      return request(app.getHttpServer())
        .get('/api/ai-chat/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const found = res.body.find((c: any) => c.id === conversationId);
          expect(found).toBeDefined();
          expect(found.title).toBe('Initial Chat Title');
        });
    });

    it('PATCH /ai-chat/conversations/:id - should rename conversation', () => {
      const dto: RenameConversationDto = {
        title: 'Renamed Chat Title',
      };

      return request(app.getHttpServer())
        .patch(`/api/ai-chat/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(conversationId);
          expect(res.body.title).toBe('Renamed Chat Title');
        });
    });

    it('PUT /ai-chat/conversations/:id/messages - should update messages of conversation', () => {
      const dto: UpdateMessagesDto = {
        messages: [
          { role: 'user', content: 'Hello AI' },
          { role: 'assistant', content: 'Hello human' },
        ],
      };

      return request(app.getHttpServer())
        .put(`/api/ai-chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('GET /ai-chat/conversations - should load updated messages with conversation', async () => {
      await request(app.getHttpServer())
        .get('/api/ai-chat/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const found = res.body.find((c: any) => c.id === conversationId);
          expect(found).toBeDefined();
          expect(found.messages).toHaveLength(2);
          expect(found.messages[0].role).toBe('user');
          expect(found.messages[0].content).toBe('Hello AI');
          expect(found.messages[1].role).toBe('assistant');
          expect(found.messages[1].content).toBe('Hello human');
        });
    });

    it('DELETE /ai-chat/context/:sessionId - should clear messages in conversation session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/ai-chat/context/${testSessionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });

      // Verify messages are deleted
      await request(app.getHttpServer())
        .get('/api/ai-chat/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          const found = res.body.find((c: any) => c.id === conversationId);
          expect(found).toBeDefined();
          expect(found.messages).toHaveLength(0);
        });
    });

    it('DELETE /ai-chat/conversations/:id - should delete conversation', () => {
      return request(app.getHttpServer())
        .delete(`/api/ai-chat/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('DELETE /ai-chat/conversations/:id - should cascade delete conversation chat messages from database', async () => {
      // 1. Create a conversation
      const conversation = await prismaService.conversation.create({
        data: {
          userId: user.id,
          title: 'Cascade Delete Test',
          sessionId: `cascade_session_${Date.now()}`,
        },
      });

      // 2. Add some messages
      await prismaService.chatMessage.createMany({
        data: [
          { conversationId: conversation.id, role: 'user', content: 'Message 1' },
          { conversationId: conversation.id, role: 'assistant', content: 'Message 2' },
        ],
      });

      // Verify they are in the database
      const dbMessagesBefore = await prismaService.chatMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(dbMessagesBefore).toHaveLength(2);

      // 3. Delete the conversation via API
      await request(app.getHttpServer())
        .delete(`/api/ai-chat/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      // 4. Verify conversation is deleted
      const dbConvAfter = await prismaService.conversation.findUnique({
        where: { id: conversation.id },
      });
      expect(dbConvAfter).toBeNull();

      // 5. Verify messages are deleted (cascade)
      const dbMessagesAfter = await prismaService.chatMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(dbMessagesAfter).toHaveLength(0);
    });
  });

  describe('AI Chat Executions', () => {
    it('POST /ai-chat/chat - should return success: false if AI is disabled', async () => {
      // Disable AI
      await prismaService.settings.update({
        where: { userId_key: { userId: user.id, key: 'ai_enabled' } },
        data: { value: 'false' },
      });

      const dto: ChatRequestDto = {
        message: 'Hello Assistant',
      };

      await request(app.getHttpServer())
        .post('/api/ai-chat/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('AI chat is currently disabled');
        });
    });

    it('POST /ai-chat/chat - should call LLM API and save history when sessionId is specified', async () => {
      const sessionId = `chat_session_${Date.now()}`;

      // Mock OpenAI success response
      fetchSpy.mockImplementation((url, init) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        // Check if this is the title generation prompt
        const isTitlePrompt = body.messages?.[0]?.content?.includes(
          'Analyze the following first user message',
        );

        if (isTitlePrompt) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                choices: [{ message: { content: 'Automated Title' } }],
              }),
          } as any);
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Hello! I am your AI assistant.' } }],
            }),
        } as any);
      });

      const dto: ChatRequestDto = {
        message: 'Hello AI',
        sessionId,
      };

      await request(app.getHttpServer())
        .post('/api/ai-chat/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Hello! I am your AI assistant.');
        });

      // Verify that conversation and messages were created in the database
      const conversation = await prismaService.conversation.findUnique({
        where: { sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      expect(conversation).toBeDefined();
      expect(conversation!.title).toBe('Automated Title');
      expect(conversation!.messages).toHaveLength(2);
      expect(conversation!.messages[0].role).toBe('user');
      expect(conversation!.messages[0].content).toBe('Hello AI');
      expect(conversation!.messages[1].role).toBe('assistant');
      expect(conversation!.messages[1].content).toBe('Hello! I am your AI assistant.');
    });

    it('POST /ai-chat/chat - should load and include old chat history in subsequent LLM requests', async () => {
      const sessionId = `history_session_${Date.now()}`;

      // First call (creates conversation and first message pair)
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Reply to first message' } }],
          }),
      } as any);

      await request(app.getHttpServer())
        .post('/api/ai-chat/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ message: 'First User Message', sessionId })
        .expect(HttpStatus.CREATED);

      // Reset mock history to inspect the next call
      fetchSpy.mockClear();

      // Second call (uses existing conversation)
      let sentMessagesPayload: any[] = [];
      fetchSpy.mockImplementation((url, init) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        sentMessagesPayload = body.messages || [];
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Reply to second message' } }],
            }),
        } as any);
      });

      await request(app.getHttpServer())
        .post('/api/ai-chat/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ message: 'Second User Message', sessionId })
        .expect(HttpStatus.CREATED);

      // Verify sentMessagesPayload contains the first message pair from history
      expect(sentMessagesPayload).toBeDefined();
      expect(sentMessagesPayload.length).toBeGreaterThanOrEqual(4);

      const userHistoryMsg = sentMessagesPayload.find(
        (m) => m.role === 'user' && m.content === 'First User Message',
      );
      const assistantHistoryMsg = sentMessagesPayload.find(
        (m) => m.role === 'assistant' && m.content === 'Reply to first message',
      );
      const newMsg = sentMessagesPayload.find(
        (m) => m.role === 'user' && m.content === 'Second User Message',
      );

      expect(userHistoryMsg).toBeDefined();
      expect(assistantHistoryMsg).toBeDefined();
      expect(newMsg).toBeDefined();
    });

    it('POST /ai-chat/chat - should return network error helper message when fetch fails', async () => {
      fetchSpy.mockRejectedValue(new Error('Failed to fetch'));

      const dto: ChatRequestDto = {
        message: 'Hello AI',
      };

      await request(app.getHttpServer())
        .post('/api/ai-chat/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dto)
        .expect(HttpStatus.CREATED) // Note: Controller returns 201 Created status but body has success: false
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Network error');
        });
    });
  });

  describe('AI Utility Endpoints', () => {
    describe('POST /ai-chat/test-connection', () => {
      const testConnectionDto: TestConnectionDto = {
        apiKey: 'sk-test',
        model: 'gpt-4',
        apiUrl: 'https://api.openai.com/v1',
      };

      it('should successfully test connection', async () => {
        fetchSpy.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Connection successful.' } }],
            }),
        } as any);

        await request(app.getHttpServer())
          .post('/api/ai-chat/test-connection')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(testConnectionDto)
          .expect(HttpStatus.CREATED)
          .expect((res) => {
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Connection successful!');
          });
      });

      it('should return error on 401 Unauthorized response from provider', async () => {
        fetchSpy.mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: { message: 'Invalid Key' } }),
        } as any);

        await request(app.getHttpServer())
          .post('/api/ai-chat/test-connection')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(testConnectionDto)
          .expect(HttpStatus.CREATED)
          .expect((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid API key');
          });
      });

      it('should return error on 429 Rate Limit response from provider', async () => {
        fetchSpy.mockResolvedValue({
          ok: false,
          status: 429,
          json: () => Promise.resolve({}),
        } as any);

        await request(app.getHttpServer())
          .post('/api/ai-chat/test-connection')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(testConnectionDto)
          .expect(HttpStatus.CREATED)
          .expect((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Rate limit exceeded');
          });
      });
    });

    describe('POST /ai-chat/generate-description', () => {
      it('should successfully generate a task description using AI', async () => {
        fetchSpy.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'This is a description generated for testing.' } }],
            }),
        } as any);

        const dto: GenerateDescriptionDto = {
          title: 'Implement E2E tests',
          taskType: 'TASK',
        };

        await request(app.getHttpServer())
          .post('/api/ai-chat/generate-description')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)
          .expect(HttpStatus.CREATED)
          .expect((res) => {
            expect(res.body.success).toBe(true);
            expect(res.body.description).toBe('This is a description generated for testing.');
          });
      });

      it('should return error if AI is disabled', async () => {
        // Disable AI
        await prismaService.settings.update({
          where: { userId_key: { userId: user.id, key: 'ai_enabled' } },
          data: { value: 'false' },
        });

        const dto: GenerateDescriptionDto = {
          title: 'Implement E2E tests',
        };

        await request(app.getHttpServer())
          .post('/api/ai-chat/generate-description')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)
          .expect(HttpStatus.CREATED)
          .expect((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('AI is not enabled.');
          });
      });
    });
  });
});

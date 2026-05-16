import { Test, TestingModule } from '@nestjs/testing';
import { AiChatService } from './ai-chat.service';
import { SettingsService } from '../settings/settings.service';

describe('AiChatService', () => {
  let service: AiChatService;
  let fetchMock: jest.SpyInstance;

  const settingsMock = {
    get: jest.fn(),
  };

  const settingsFor = (
    overrides: Partial<{
      enabled: string;
      apiKey: string;
      model: string;
      apiUrl: string;
    }> = {},
  ) => {
    const { enabled = 'true', apiKey = 'sk-test', model, apiUrl } = overrides;
    return (key: string, _userId: string, fallback?: string) => {
      switch (key) {
        case 'ai_enabled':
          return enabled;
        case 'ai_api_key':
          return apiKey;
        case 'ai_model':
          return model ?? fallback;
        case 'ai_api_url':
          return apiUrl ?? fallback;
        default:
          return fallback;
      }
    };
  };

  const okJsonResponse = (body: unknown) =>
    ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiChatService, { provide: SettingsService, useValue: settingsMock }],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    settingsMock.get.mockReset();
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJsonResponse({
        choices: [{ message: { content: 'ok' } }],
        content: [{ text: 'ok' }],
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      }),
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const getSentBody = () => {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string);
  };

  describe('getModelFamily', () => {
    const cases: Array<[string, 'anthropic' | 'openai' | 'google' | 'unknown']> = [
      ['claude-sonnet-4-5', 'anthropic'],
      ['anthropic/claude-3.5-sonnet', 'anthropic'],
      ['my-proxy/claude-opus-4', 'anthropic'],
      ['gpt-4o-mini', 'openai'],
      ['openai/gpt-5', 'openai'],
      ['o3-mini', 'openai'],
      ['chatgpt-4o-latest', 'openai'],
      ['gemini-2.0-flash', 'google'],
      ['google/gemini-2.5-pro', 'google'],
      ['deepseek/deepseek-chat-v3-0324:free', 'unknown'],
      ['mistral-large', 'unknown'],
    ];

    it.each(cases)('classifies %s as %s', (model, expected) => {
      expect((service as any).getModelFamily(model)).toBe(expected);
    });

    it('returns unknown for non-string input', () => {
      expect((service as any).getModelFamily(undefined)).toBe('unknown');
      expect((service as any).getModelFamily(null)).toBe('unknown');
      expect((service as any).getModelFamily(42)).toBe('unknown');
    });
  });

  describe('chat() — prompt caching', () => {
    it('attaches cache_control on the Anthropic-native system block', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'claude-sonnet-4-5',
          apiUrl: 'https://api.anthropic.com/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      expect(Array.isArray(body.system)).toBe(true);
      expect(body.system[0]).toMatchObject({
        type: 'text',
        cache_control: { type: 'ephemeral' },
      });
      expect(typeof body.system[0].text).toBe('string');
      expect(body.system[0].text.length).toBeGreaterThan(0);
    });

    it('rewrites system message for OpenRouter + Claude with cache_control', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'anthropic/claude-3.5-sonnet',
          apiUrl: 'https://openrouter.ai/api/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(Array.isArray(systemMsg.content)).toBe(true);
      expect(systemMsg.content[0]).toMatchObject({
        type: 'text',
        cache_control: { type: 'ephemeral' },
      });
    });

    it('rewrites system message for a custom proxy hosting Claude', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'claude-opus-4-7',
          apiUrl: 'https://proxy.example.com/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system');
      expect(systemMsg.content[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('does NOT add cache_control for OpenAI direct with a GPT model', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'gpt-4o-mini',
          apiUrl: 'https://api.openai.com/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      const systemMsg = body.messages.find((m: { role: string }) => m.role === 'system');
      expect(typeof systemMsg.content).toBe('string');
      expect(JSON.stringify(body)).not.toContain('cache_control');
    });

    it('does NOT add cache_control for OpenRouter + GPT model', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'openai/gpt-4o-mini',
          apiUrl: 'https://openrouter.ai/api/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      expect(JSON.stringify(body)).not.toContain('cache_control');
    });

    it('does NOT add cache_control for Google Gemini native wire', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'gemini-2.0-flash',
          apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      expect(JSON.stringify(body)).not.toContain('cache_control');
      expect(body.contents).toBeDefined();
    });

    it('does NOT add cache_control for Ollama + non-Claude model', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          apiKey: '',
          model: 'llama3',
          apiUrl: 'http://localhost:11434/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      expect(JSON.stringify(body)).not.toContain('cache_control');
    });

    it('does NOT add cache_control for an unknown-family model on a custom proxy', async () => {
      settingsMock.get.mockImplementation(
        settingsFor({
          model: 'deepseek/deepseek-chat-v3-0324:free',
          apiUrl: 'https://openrouter.ai/api/v1',
        }),
      );

      await service.chat({ message: 'hi' }, 'user-1');

      const body = getSentBody();
      expect(JSON.stringify(body)).not.toContain('cache_control');
    });
  });
});

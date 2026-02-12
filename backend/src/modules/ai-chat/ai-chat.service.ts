import { Injectable, BadRequestException } from '@nestjs/common';
import {
  ChatRequestDto,
  ChatResponseDto,
  ChatMessageDto,
  TestConnectionDto,
  TestConnectionResponseDto,
} from './dto/chat.dto';
import { SettingsService } from '../settings/settings.service';
import { enhancePromptWithContext } from './app-guide';

@Injectable()
export class AiChatService {
  constructor(private settingsService: SettingsService) {}

  private detectProvider(apiUrl: string): string {
    try {
      const parsedUrl = new URL(apiUrl);
      const hostname = parsedUrl.hostname;

      // Check for Ollama (localhost/private network)
      // Treats all localhost and private network addresses as Ollama (OpenAI-compatible)
      if (this.isLocalhost(hostname) || this.isPrivateNetwork(hostname)) {
        return 'ollama';
      }

      if (hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai')) return 'openrouter';
      if (hostname === 'api.openai.com' || hostname.endsWith('.api.openai.com')) return 'openai';
      if (hostname === 'api.anthropic.com' || hostname.endsWith('.api.anthropic.com'))
        return 'anthropic';
      if (
        hostname === 'generativelanguage.googleapis.com' ||
        hostname.endsWith('.generativelanguage.googleapis.com')
      )
        return 'google';
    } catch (e) {
      console.log(e);
      // Invalid URL, fall back to previous logic or return custom (could alternatively throw error)
    }
    return 'custom'; // fallback for unknown providers
  }

  private generateSystemPrompt(): string {
    return `You are Taskosaur AI assistant for browser automation.Your job is to help users automate tasks on web pages.

You will receive:
1. The current page URL
2. A list of interactive elements on the page with their index numbers
3. History of ALL previous actions with their results (marked with ✅ for success or ❌ for failure)

Your task is to respond with the NEXT NEW action to take. Available actions:
- click(index) - Click an element
- type(index, "text") - Type text into an input field
- scroll("up" or "down") - Scroll the page
- select(index, "option text") - Select an option from dropdown

Format your response EXACTLY like this:
ACTION: click(5)
OR
DONE: [short clear message]
OR
ASK: [question] (only when required data missing)

RESPONSE RULES:
- For greetings (hi, hello, hey): DONE: Hi! How can I help you with Taskosaur today?
- For off-topic/non-app requests: DONE: I can only help with Taskosaur tasks like creating tasks, projects, filtering, etc.
- For completed actions: DONE: [what was done, e.g. "Task created" or "Filter applied"]
- For questions needing data: ASK: [specific question]
- Keep responses short and clear - no explanations or thinking
- CRITICAL: When the user requests ANY create/update/delete operation, FIRST verify you have ALL required context (workspace, project, task name, etc.). If ANY required info is missing from the user's message AND cannot be determined from the current URL, respond with ASK BEFORE performing any ACTION

WHEN TO ASK (VERY IMPORTANT):
- ALWAYS ask when the user's message does NOT specify: task name, target workspace, or target project
- If the user says "create a task" without specifying a project or workspace, ASK which workspace and project BEFORE taking any action
- If the user says "create a task" without a task name, ASK for the task name BEFORE taking any action
- If the current URL does NOT clearly indicate which workspace/project to use, ASK the user to specify
- NEVER guess or assume which workspace, project, or entity to use — ALWAYS ask when ambiguous
- Do NOT ask for optional fields (description, priority, due date, etc. — those can be skipped)
- Ask ONE question at a time, starting with the most important missing info

CRITICAL RULES:
1. LOOK at the conversation history - you will see messages like "✅ Action completed: click(5)"
2. NEVER repeat an action that already has "✅ Action completed" in the history
3. If you see "✅ Action completed: click(5)", DO NOT do "ACTION: click(5)" again
4. After 2-3 successful actions, the task is likely done - say DONE
5. Think: "What haven't I done yet?" before choosing the next action
6. Be precise and only perform ONE NEW action at a time
7. Focus ONLY on performing the requested action - NOT on evaluating results
8. If user says "filter by high priority" and you clicked the filter and selected "High" - you are DONE, even if 0 results show
9. Empty results, zero items, or "no data" does NOT mean failure - the action was still completed correctly
10. NEVER retry an action just because the result looks empty
11. Do NOT judge whether the result "looks right" - just complete the requested steps
12. Do NOT explain your thinking - just respond
13. NEVER click outside a modal to close it - the app will auto-close modals when needed

TASK UPDATE RULES (VERY IMPORTANT - for updating priority, status, sprint, assignee, etc.):
- Step 1: Click on the task to open task detail modal
- Step 2: Click on the field you want to change (e.g., priority badge shows "Medium")
- Step 3: Click the new value in the dropdown (e.g., "Highest")
- Step 4: IMMEDIATELY say "DONE: Task [field] updated to [value]"
- STOP after Step 4 - do NOT do anything else
- The modal will close automatically - do NOT try to close it yourself
- Do NOT click outside the modal
- Do NOT click any close button
- Do NOT repeat any clicks
- After you click the dropdown option, your job is FINISHED - say DONE

FILTER RULES (VERY IMPORTANT - for filtering tasks by priority, status, type, etc.):
- Filters use checkboxes that TOGGLE on/off. Clicking a checked checkbox UNCHECKS it and vice versa.
- When user says "filter by [value]", the DESIRED END STATE is: ONLY that value's checkbox is checked.
- Step 1: Click the filter dropdown trigger button (id="filter-dropdown-trigger")
- Step 2: Expand the relevant filter section (e.g., click "Priority" or "Status" header)
- Step 3: LOOK at ALL checkboxes in that section. Check which ones are currently checked vs unchecked.
- Step 4: FIRST, click every checkbox that is currently CHECKED but is NOT the requested value (to uncheck them)
- Step 5: THEN, if the requested value's checkbox is NOT already checked, click it (to check it)
- Step 6: If the requested value is already the ONLY checked item, say DONE immediately
- IMPORTANT: Do ONE click per action. After each click, re-examine the checkboxes on the next iteration.
- IMPORTANT: A checked checkbox has aria-checked="true" or data-state="checked". An unchecked one has aria-checked="false" or data-state="unchecked".
- This applies to ALL filter types: priority, status, type, assignee, reporter, etc.`;
  }

  async chat(chatRequest: ChatRequestDto, userId: string): Promise<ChatResponseDto> {
    try {
      // Check if AI is enabled
      const isEnabled = await this.settingsService.get('ai_enabled', userId);
      if (isEnabled !== 'true') {
        throw new BadRequestException(
          'AI chat is currently disabled. Please enable it in settings.',
        );
      }

      // Get API settings from database
      const [apiKey, model, rawApiUrl] = await Promise.all([
        this.settingsService.get('ai_api_key', userId),
        this.settingsService.get('ai_model', userId, 'deepseek/deepseek-chat-v3-0324:free'),
        this.settingsService.get('ai_api_url', userId, 'https://openrouter.ai/api/v1'),
      ]);

      const apiUrl = rawApiUrl ? this.validateApiUrl(rawApiUrl) : 'https://openrouter.ai/api/v1';

      const provider = this.detectProvider(apiUrl);

      // API key is optional for Ollama (localhost/private network)
      if (!apiKey && provider !== 'ollama') {
        throw new BadRequestException('AI API key not configured. Please set it in settings.');
      }

      // Build messages array with system prompt and conversation history
      const messages: ChatMessageDto[] = [];

      // Generate system prompt
      const systemPrompt = this.generateSystemPrompt();
      messages.push({
        role: 'system',
        content: systemPrompt,
      });

      // Add conversation history if provided
      if (chatRequest.history && Array.isArray(chatRequest.history)) {
        chatRequest.history.forEach((msg: ChatMessageDto) => {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        });
      }

      let userMessage = chatRequest.message;

      const taskMatch = userMessage.match(/Task:\s*([^\n]+)/);
      const urlMatch = userMessage.match(/Current URL:\s*([^\n]+)/);

      if (taskMatch && urlMatch) {
        const task = taskMatch[1].trim();
        const url = urlMatch[1].trim();
        const appContext = enhancePromptWithContext(task, url);
        userMessage = userMessage + `\n\n${appContext}`;
      }

      messages.push({
        role: 'user',
        content: userMessage,
      });

      const isGpt5Model = typeof model === 'string' && model.startsWith('gpt-5');

      // Prepare request based on provider
      let requestUrl = apiUrl;
      const requestHeaders: any = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      let requestBody: any = {
        model,
        messages,
        temperature: 0.1,
        max_tokens: 500,
        stream: false,
      };

      // Adjust for different providers
      switch (provider) {
        case 'openrouter':
          requestUrl = `${apiUrl}/chat/completions`;
          requestHeaders['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
          requestHeaders['X-Title'] = 'Taskosaur AI Assistant';
          requestBody.top_p = 0.9;
          requestBody.frequency_penalty = 0;
          requestBody.presence_penalty = 0;
          break;

        case 'openai':
          requestUrl = `${apiUrl}/chat/completions`;
          delete requestBody.max_tokens;
          requestBody.max_completion_tokens = 500;
          if (isGpt5Model) {
            delete requestBody.temperature;
          } else {
            requestBody.top_p = 0.9;
            requestBody.frequency_penalty = 0;
            requestBody.presence_penalty = 0;
          }
          break;

        case 'ollama':
          // Ollama uses OpenAI-compatible API at /v1/chat/completions or /api/chat
          // Check if URL already contains the endpoint path
          if (apiUrl.includes('/v1')) {
            requestUrl = apiUrl.endsWith('/chat/completions')
              ? apiUrl
              : `${apiUrl}/chat/completions`;
          } else if (apiUrl.includes('/api')) {
            requestUrl = apiUrl.endsWith('/chat') ? apiUrl : `${apiUrl}/chat`;
          } else {
            // Default to OpenAI-compatible endpoint
            requestUrl = `${apiUrl}/v1/chat/completions`;
          }
          // Ollama doesn't require auth for local instances
          delete requestHeaders['Authorization'];
          requestBody.top_p = 0.9;
          break;

        case 'anthropic':
          requestUrl = `${apiUrl}/messages`;
          requestHeaders['x-api-key'] = apiKey;
          requestHeaders['anthropic-version'] = '2023-06-01';
          delete requestHeaders['Authorization'];
          requestBody = {
            model,
            messages: messages.filter((m) => m.role !== 'system'), // Anthropic doesn't use system role the same way
            system: messages.find((m) => m.role === 'system')?.content,
            max_tokens: 500,
            temperature: 0.1,
          };
          break;

        case 'google':
          // Google Gemini has a different API structure
          this.validateModelName(model);
          requestUrl = `${apiUrl}/models/${encodeURIComponent(String(model))}:generateContent?key=${encodeURIComponent(apiKey || '')}`;
          delete requestHeaders['Authorization'];
          requestBody = {
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : m.role == 'system' ? 'model' : m.role,
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500,
            },
          };
          break;

        default: // custom or openrouter fallback
          requestUrl = `${apiUrl}/chat/completions`;
          break;
      }

      // Call API
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new BadRequestException(
            'Invalid API key. Please check your OpenRouter API key in settings.',
          );
        } else if (response.status === 429) {
          throw new BadRequestException(
            'Rate limit exceeded by API provider. Please try again in a moment.',
          );
        } else if (response.status === 402) {
          throw new BadRequestException(
            'Insufficient credits. Please check your OpenRouter account.',
          );
        }

        throw new BadRequestException(
          errorData.error?.message || `API request failed with status ${response.status}`,
        );
      }

      const data = await response.json();

      let aiMessage = '';

      // Parse response based on provider
      switch (provider) {
        case 'anthropic':
          aiMessage = data.content?.[0]?.text || '';
          break;

        case 'google':
          aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;

        default: // OpenAI, OpenRouter, and custom providers use the same format
          aiMessage = data.choices?.[0]?.message?.content || '';
          break;
      }

      return {
        message: aiMessage,
        success: true,
      };
    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes('Failed to fetch') || errorMessage?.includes('NetworkError')) {
        return {
          message: '',
          success: false,
          error: 'Network error. Please check your internet connection.',
        };
      }

      return {
        message: '',
        success: false,
        error: errorMessage || 'Failed to process chat request',
      };
    }
  }

  // Clear context for a specific session (no-op since context tracking was removed)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clearContext(sessionId: string): { success: boolean } {
    return { success: true };
  }

  private readonly allowedHosts: string[] = [
    // OpenRouter
    'openrouter.ai',
    'api.openrouter.ai',

    // OpenAI
    'api.openai.com',

    // Anthropic
    'api.anthropic.com',

    // Google - base domains
    'generativelanguage.googleapis.com',
    'aiplatform.googleapis.com',
  ];

  // AWS Bedrock pattern
  private readonly awsBedrockPattern =
    /^(bedrock|bedrock-runtime|bedrock-agent|bedrock-agent-runtime|bedrock-data-automation|bedrock-data-automation-runtime)(-fips)?\.([a-z0-9-]+)\.amazonaws\.com$/;

  // Azure OpenAI pattern
  private readonly azurePattern = /^[a-z0-9-]+\.openai\.azure\.com$/;

  // Google Cloud pattern (for regional Vertex AI and PSC endpoints)
  private readonly googlePattern =
    /^([a-z0-9-]+\.)?aiplatform\.googleapis\.com$|^[a-z0-9-]+\.p\.googleapis\.com$|^generativelanguage\.googleapis\.com$/;

  /**
   * Check if hostname is localhost or loopback
   */
  private isLocalhost(hostname: string): boolean {
    return ['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase());
  }

  /**
   * Check if hostname is a private network address (RFC 1918)
   */
  private isPrivateNetwork(hostname: string): boolean {
    // Check for private IPv4 ranges
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255
    const privateIPv4Pattern =
      /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
    return privateIPv4Pattern.test(hostname);
  }

  validateApiUrl(apiUrl: string): string {
    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    // Allow HTTP for localhost and private networks (e.g., self-hosted Ollama)
    const allowHttp = this.isLocalhost(url.hostname) || this.isPrivateNetwork(url.hostname);

    if (url.protocol !== 'https:' && !allowHttp) {
      throw new BadRequestException(
        'Only HTTPS URLs allowed (HTTP is permitted for localhost and private network addresses)',
      );
    }

    return url.toString().replace(/\/$/, '');
  }

  /**
   * Test connection to AI provider without requiring AI to be enabled
   * This allows users to verify their configuration before saving and enabling
   */
  async testConnection(testConnectionDto: TestConnectionDto): Promise<TestConnectionResponseDto> {
    const { apiKey, model, apiUrl } = testConnectionDto;

    try {
      // Validate the URL (this also allows HTTP for localhost/private networks)
      const validatedUrl = this.validateApiUrl(apiUrl);
      const provider = this.detectProvider(validatedUrl);

      // API key is required for non-Ollama providers
      if (!apiKey && provider !== 'ollama') {
        return {
          success: false,
          error: 'API key is required for this provider.',
        };
      }

      // Prepare a simple test message
      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        {
          role: 'user',
          content: 'Hello, this is a connection test. Please respond with "Connection successful."',
        },
      ];

      const isGpt5Model = typeof model === 'string' && model.startsWith('gpt-5');

      // Prepare request based on provider
      let requestUrl = validatedUrl;
      const requestHeaders: any = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      let requestBody: any = {
        model,
        messages,
        temperature: 0.1,
        max_tokens: 50,
        stream: false,
      };

      // Adjust for different providers
      switch (provider) {
        case 'openrouter':
          requestUrl = `${validatedUrl}/chat/completions`;
          requestHeaders['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
          requestHeaders['X-Title'] = 'Taskosaur AI Assistant';
          break;

        case 'openai':
          requestUrl = `${validatedUrl}/chat/completions`;
          delete requestBody.max_tokens;
          requestBody.max_completion_tokens = 50;
          if (isGpt5Model) {
            delete requestBody.temperature;
          }
          break;

        case 'ollama':
          // Ollama uses OpenAI-compatible API at /v1/chat/completions or /api/chat
          if (validatedUrl.includes('/v1')) {
            requestUrl = validatedUrl.endsWith('/chat/completions')
              ? validatedUrl
              : `${validatedUrl}/chat/completions`;
          } else if (validatedUrl.includes('/api')) {
            requestUrl = validatedUrl.endsWith('/chat') ? validatedUrl : `${validatedUrl}/chat`;
          } else {
            requestUrl = `${validatedUrl}/v1/chat/completions`;
          }
          // Ollama doesn't require auth for local instances
          delete requestHeaders['Authorization'];
          break;

        case 'anthropic':
          requestUrl = `${validatedUrl}/messages`;
          requestHeaders['x-api-key'] = apiKey;
          requestHeaders['anthropic-version'] = '2023-06-01';
          delete requestHeaders['Authorization'];
          requestBody = {
            model,
            messages,
            max_tokens: 50,
            temperature: 0.1,
          };
          break;

        case 'google':
          this.validateModelName(model);
          requestUrl = `${validatedUrl}/models/${encodeURIComponent(String(model))}:generateContent?key=${encodeURIComponent(apiKey)}`;
          delete requestHeaders['Authorization'];
          requestBody = {
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : m.role == 'system' ? 'model' : m.role,
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 50,
            },
          };
          break;

        default:
          requestUrl = `${validatedUrl}/chat/completions`;
          break;
      }

      // Make the test request
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid API key. Please check your API key and try again.',
          };
        } else if (response.status === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded. Please try again in a moment.',
          };
        } else if (response.status === 402) {
          return {
            success: false,
            error: 'Insufficient credits. Please check your account balance.',
          };
        } else if (response.status === 404) {
          return {
            success: false,
            error: 'Model not found. Please check the model name and try again.',
          };
        }

        return {
          success: false,
          error: errorData.error?.message || `API request failed with status ${response.status}`,
        };
      }

      // Parse response to verify we got a valid AI response
      const data = await response.json();
      let aiMessage = '';

      switch (provider) {
        case 'anthropic':
          aiMessage = data.content?.[0]?.text || '';
          break;
        case 'google':
          aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;
        default:
          aiMessage = data.choices?.[0]?.message?.content || '';
          break;
      }

      if (aiMessage) {
        return {
          success: true,
          message: 'Connection successful! Your AI configuration is working correctly.',
        };
      } else {
        return {
          success: false,
          error: 'Received empty response from AI provider. Please check your configuration.',
        };
      }
    } catch (error: unknown) {
      console.error('Test connection failed:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and API URL.',
        };
      }

      return {
        success: false,
        error: errorMessage || 'Connection test failed. Please check your configuration.',
      };
    }
  }

  validateModelName(
    model: unknown,
    options: {
      allowedPattern?: RegExp;
      maxLength?: number;
      allowPathTraversal?: boolean;
      customErrorMessage?: string;
    } = {},
  ): void {
    const {
      allowedPattern = /^[a-zA-Z0-9.-]+$/,
      maxLength = 100,
      allowPathTraversal = false,
      customErrorMessage = 'Model name contains invalid characters',
    } = options;

    if (!model || typeof model !== 'string') {
      throw new BadRequestException('Model name is required and must be a string');
    }

    const trimmedModel = model.trim();

    if (trimmedModel.length === 0) {
      throw new BadRequestException('Model name cannot be empty');
    }

    if (trimmedModel.length > maxLength) {
      throw new BadRequestException(`Model name is too long (max ${maxLength} characters)`);
    }

    if (!allowPathTraversal && trimmedModel.includes('..')) {
      throw new BadRequestException('Model name cannot contain path traversal sequences (..)');
    }

    if (trimmedModel.startsWith('/') || /^[a-zA-Z]:\\/.test(trimmedModel)) {
      throw new BadRequestException('Model name cannot be an absolute path');
    }

    if (!allowedPattern.test(trimmedModel)) {
      throw new BadRequestException(customErrorMessage);
    }
  }
}

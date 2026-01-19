import { Injectable, BadRequestException } from '@nestjs/common';
import {
  ChatRequestDto,
  ChatResponseDto,
  ChatMessageDto,
  TestConnectionDto,
  TestConnectionResponseDto,
} from './dto/chat.dto';
import { SettingsService } from '../settings/settings.service';
import * as commandsData from '../../constants/commands.json';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ProjectsService } from '../projects/projects.service';

interface Command {
  name: string;
  params: string[];
}

interface CommandsData {
  commands: Command[];
}

@Injectable()
export class AiChatService {
  private commands: CommandsData;
  // Store conversation context per session/user
  private conversationContexts: Map<
    string,
    {
      workspaceSlug?: string;
      workspaceName?: string;
      projectSlug?: string;
      projectName?: string;
      lastUpdated: Date;
      currentWorkSpaceProjectSlug?: string[];
    }
  > = new Map();

  constructor(
    private settingsService: SettingsService,
    private workspacesService: WorkspacesService,
    private projectService: ProjectsService,
  ) {
    // Load commands from imported JSON
    this.commands = commandsData;
    // Clean up old contexts every hour
    setInterval(() => this.cleanupOldContexts(), 3600000);
  }

  private cleanupOldContexts() {
    const oneHourAgo = new Date(Date.now() - 3600000);
    for (const [sessionId, context] of this.conversationContexts.entries()) {
      if (context.lastUpdated < oneHourAgo) {
        this.conversationContexts.delete(sessionId);
      }
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private async checkWorkspaceExists(slug: string): Promise<boolean> {
    if (!slug) return false;
    try {
      return (await this.workspacesService.getIdBySlug(slug)) !== null;
    } catch {
      return false;
    }
  }

  private async checkProjectExistsInWorkspace(
    workspaceSlug: string,
    projectSlug: string,
  ): Promise<boolean> {
    if (!workspaceSlug || !projectSlug) return false;
    try {
      const workspaceId = await this.workspacesService.getIdBySlug(workspaceSlug);
      if (!workspaceId) return false;
      const projectSlugs = await this.projectService.getAllSlugsByWorkspaceId(workspaceId);
      return projectSlugs.includes(projectSlug);
    } catch {
      return false;
    }
  }

  private async buildCommandChain(
    commandName: string,
    parameters: Record<string, any>,
  ): Promise<Array<{ name: string; parameters: Record<string, any> }> | null> {
    if (!['createTask', 'createProject'].includes(commandName)) return null;

    const chain: Array<{ name: string; parameters: Record<string, any> }> = [];
    const workspaceName = String(parameters.workspaceName || parameters.workspaceSlug || '');
    const projectName = String(
      parameters.projectName || parameters.name || parameters.projectSlug || '',
    );
    const workspaceSlug = String(parameters.workspaceSlug || '') || this.slugify(workspaceName);
    const projectSlug = String(parameters.projectSlug || '') || this.slugify(projectName);

    if (commandName === 'createTask' && workspaceSlug && projectSlug) {
      const workspaceExists = await this.checkWorkspaceExists(workspaceSlug);

      if (!workspaceExists) {
        chain.push({
          name: 'createWorkspace',
          parameters: {
            name: workspaceName || workspaceSlug,
            description: `Workspace for ${String(parameters.taskTitle || 'tasks')}`,
          },
        });
      }

      const projectExists = workspaceExists
        ? await this.checkProjectExistsInWorkspace(workspaceSlug, projectSlug)
        : false;

      if (!projectExists) {
        chain.push({
          name: 'createProject',
          parameters: {
            workspaceSlug,
            name: projectName || projectSlug,
            description: `Project for ${String(parameters.taskTitle || 'tasks')}`,
          },
        });
      }

      if (chain.length > 0) {
        chain.push({
          name: 'createTask',
          parameters: { ...parameters, workspaceSlug, projectSlug },
        });
        return chain;
      }
    }

    if (commandName === 'createProject' && workspaceSlug) {
      const workspaceExists = await this.checkWorkspaceExists(workspaceSlug);
      if (!workspaceExists) {
        chain.push({
          name: 'createWorkspace',
          parameters: {
            name: workspaceName || workspaceSlug,
            description: `Workspace for ${String(parameters.name || 'projects')}`,
          },
        });
        chain.push({ name: 'createProject', parameters: { ...parameters, workspaceSlug } });
        return chain;
      }
    }

    return null;
  }

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

  private generateSystemPrompt(
    sessionContext?: {
      workspaceSlug?: string;
      workspaceName?: string;
      projectSlug?: string;
      projectName?: string;
      currentWorkSpaceProjectSlug?: string[];
    },
    slugs: string[] = [],
  ): string {
    // Generate compact command list from commands.json
    const commandList = this.commands.commands
      .map((cmd) => {
        const params = cmd.params.map((p) => (p.endsWith('?') ? `[${p.slice(0, -1)}]` : p));
        return `${cmd.name}(${params.join(', ')})`;
      })
      .join('\n');

    // Build context section
    const hasContext = sessionContext?.workspaceSlug || sessionContext?.projectSlug;
    const contextSection = hasContext
      ? `CURRENT CONTEXT:
- Workspace: ${sessionContext.workspaceSlug || 'none'}${sessionContext.workspaceName ? ` (${sessionContext.workspaceName})` : ''}
- Project: ${sessionContext.projectSlug || 'none'}${sessionContext.projectName ? ` (${sessionContext.projectName})` : ''}${sessionContext.currentWorkSpaceProjectSlug?.length ? `\n- Available projects: ${sessionContext.currentWorkSpaceProjectSlug.join(', ')}` : ''}`
      : 'CURRENT CONTEXT: No workspace/project selected';

    // Build available workspaces section
    const workspacesSection =
      slugs.length > 0 ? `EXISTING WORKSPACES: ${slugs.join(', ')}` : 'EXISTING WORKSPACES: none';

    return `You are Taskosaur AI Assistant - a task management helper. You execute commands to manage workspaces, projects, and tasks.

COMMANDS (params in [] are optional):
${commandList}

OUTPUT FORMAT:
When executing a command, respond with a brief message followed by the command block:
[COMMAND: commandName] {"param": "value"}

${contextSection}

${workspacesSection}

VALID VALUES:
- priority: "URGENT", "HIGH", "MEDIUM", "LOW", "NONE"
- status: "Backlog", "Todo", "In Progress", "Done", "Cancelled"

INTENT MAPPING (understand these phrases):
- "add/new/create task" → createTask
- "show/list/my tasks" or "todos" or "what do I need to do" → navigateToTasksView
- "complete/finish/done with task X" → updateTaskStatus (newStatus: "Done")
- "start/begin task X" → updateTaskStatus (newStatus: "In Progress")
- "show/filter urgent/high/medium/low priority" → filterTasksByPriority
- "show completed/done/pending/backlog tasks" → filterTasksByStatus
- "find/search/look for task X" → searchTasks
- "remove/delete task X" → deleteTask
- "open/go to/switch to/navigate to workspace X" → navigateToWorkspace
- "open/go to project X" → navigateToProject
- "show/list workspaces" or "my workspaces" → listWorkspaces
- "show/list projects" or "my projects" → listProjects
- "create/add/new workspace" → createWorkspace
- "create/add/new project" → createProject
- "rename/edit/change workspace X to Y" → editWorkspace
- "clear/reset/remove filters" → clearTaskFilters
- "details of task X" or "show task X" → getTaskDetails

CORE RULES:

1. SLUGS: Convert names to slugs (lowercase, spaces→hyphens). Example: "My App" → "my-app"

2. CONTEXT USAGE: When workspace/project params are optional ([workspaceSlug], [projectSlug]):
   - If context exists → use context values
   - If no context → use empty string ""
   - Never ask the user for optional params

3. TASK OPERATIONS (updateTaskStatus, filterTasksByPriority, filterTasksByStatus, searchTasks, deleteTask, getTaskDetails, clearTaskFilters, navigateToTasksView):
   → Execute immediately using context or empty strings. Do NOT ask for workspace/project.

4. CREATE OPERATIONS:
   - createTask: Needs workspaceSlug, projectSlug, taskTitle. If user specifies new workspace/project names, include workspaceName/projectName and the system will auto-create them.
   - createWorkspace: Needs name AND description. Ask if missing.
   - createProject: Needs workspaceSlug and name.

5. NAVIGATION: For navigateToWorkspace, the slug must match EXISTING WORKSPACES. If not found, show available options.

6. ALWAYS OUTPUT COMMAND: When you have enough info, include the [COMMAND: ...] block. Never just say "I will do X" without the command.

EXAMPLES:

"what's urgent?" / "show urgent tasks"
→ [COMMAND: filterTasksByPriority] {"workspaceSlug": "", "projectSlug": "", "priority": "URGENT"}

"I finished the Login Bug task" / "complete Login Bug"
→ [COMMAND: updateTaskStatus] {"workspaceSlug": "", "projectSlug": "", "taskTitle": "Login Bug", "newStatus": "Done"}

"start working on API fix"
→ [COMMAND: updateTaskStatus] {"workspaceSlug": "", "projectSlug": "", "taskTitle": "API fix", "newStatus": "In Progress"}

"add task Fix API to Backend workspace, Core project"
→ [COMMAND: createTask] {"workspaceSlug": "backend", "projectSlug": "core", "taskTitle": "Fix API", "workspaceName": "Backend", "projectName": "Core"}

"switch to marketing workspace" / "open marketing"
→ [COMMAND: navigateToWorkspace] {"workspaceSlug": "marketing"}

"show my tasks" / "what do I need to do?"
→ [COMMAND: navigateToTasksView] {"workspaceSlug": "", "projectSlug": ""}

"show completed tasks" / "what's done?"
→ [COMMAND: filterTasksByStatus] {"workspaceSlug": "", "projectSlug": "", "status": "Done"}

"new workspace Analytics" (missing description)
→ What description would you like for the Analytics workspace?

"my workspaces" / "list workspaces"
→ [COMMAND: listWorkspaces] {}

"show projects" / "my projects"
→ [COMMAND: listProjects] {"workspaceSlug": ""}

"rename workspace dev to Development"
→ [COMMAND: editWorkspace] {"workspaceSlug": "dev", "updates": {"name": "Development"}}

"find tasks about authentication"
→ [COMMAND: searchTasks] {"workspaceSlug": "", "projectSlug": "", "query": "authentication"}

"remove task Old Feature"
→ [COMMAND: deleteTask] {"workspaceSlug": "", "projectSlug": "", "taskId": "Old Feature"}

"reset filters" / "clear all filters"
→ [COMMAND: clearTaskFilters] {"workspaceSlug": "", "projectSlug": ""}
`;
  }

  private validateCommandParameters(
    commandName: string,
    parameters: Record<string, any>,
  ): { valid: boolean; missing: string[]; message?: string } {
    const command = this.commands.commands.find((cmd) => cmd.name === commandName);
    if (!command) {
      return {
        valid: false,
        missing: [],
        message: `Unknown command: ${commandName}`,
      };
    }

    const requiredParams = command.params.filter((p) => !p.endsWith('?'));
    const missing = requiredParams.filter((param) => {
      const value = parameters[param];
      if (param === 'workspaceSlug' || param === 'projectSlug') {
        return false;
      }
      return !value || String(value).toString().trim() === '';
    });

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message: `Missing required parameters for ${commandName}: ${missing.join(', ')}`,
      };
    }

    return { valid: true, missing: [] };
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
      const slugs = await this.workspacesService.findAllSlugs(
        chatRequest.currentOrganizationId ?? '',
      );

      // Get or create session context
      const sessionId = chatRequest.sessionId || 'default';
      let sessionContext = this.conversationContexts.get(sessionId);
      if (!sessionContext) {
        sessionContext = { lastUpdated: new Date() };
        this.conversationContexts.set(sessionId, sessionContext);
      }

      if (chatRequest.workspaceId) {
        sessionContext.workspaceSlug = chatRequest.workspaceId;
        sessionContext.lastUpdated = new Date();
      }
      if (chatRequest.projectId) {
        sessionContext.projectSlug = chatRequest.projectId;
        sessionContext.lastUpdated = new Date();
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

      // Generate dynamic system prompt from commands.json with session context
      const systemPrompt = this.generateSystemPrompt(sessionContext, slugs);
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

      // Extract and update context from user message before processing
      this.extractContextFromMessage(sessionId, chatRequest.message, sessionContext);

      // Add current user message
      messages.push({
        role: 'user',
        content: chatRequest.message,
      });

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
          requestBody.top_p = 0.9;
          requestBody.frequency_penalty = 0;
          requestBody.presence_penalty = 0;
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

      // Parse command if detected
      let action: { name: string; parameters: Record<string, any> } | undefined;

      // Try both formats: with ** markers and without
      // Use a more robust regex that handles nested braces
      let commandMatch = aiMessage.match(/\*\*\[COMMAND:\s*([^\]]+)\]\*\*\s*(\{.*\})$/m);
      if (!commandMatch) {
        commandMatch = aiMessage.match(/\[COMMAND:\s*([^\]]+)\]\s*(\{.*\})$/m);
      }

      // If still no match, try without requiring closing brace and attempt to fix JSON
      if (!commandMatch) {
        commandMatch = aiMessage.match(/\[COMMAND:\s*([^\]]+)\]\s*(\{.*)/);
      }

      if (commandMatch) {
        try {
          const commandName = commandMatch[1].trim();
          const parametersString = commandMatch[2] || '{}';

          let parameters: any;
          try {
            parameters = JSON.parse(parametersString);
          } catch (parseError) {
            // Attempt to repair incomplete JSON by adding missing closing braces
            let repairedJson = parametersString;
            let openBraces = 0;
            for (let i = 0; i < repairedJson.length; i++) {
              if (repairedJson[i] === '{') openBraces++;
              if (repairedJson[i] === '}') openBraces--;
            }

            // Add missing closing braces
            while (openBraces > 0) {
              repairedJson += '}';
              openBraces--;
            }

            try {
              parameters = JSON.parse(repairedJson);
            } catch (error) {
              console.error('Failed to parse repaired JSON:', error);
              throw parseError; // Throw original error
            }
          }

          // Validate command parameters
          const validation = this.validateCommandParameters(
            commandName,
            parameters as Record<string, any>,
          );

          if (!validation.valid) {
            // Override the AI message with parameter collection guidance
            const missingParamsList =
              validation.missing.length > 0
                ? `I need the following information to proceed: ${validation.missing.join(', ')}.`
                : validation.message;

            // Don't return action if validation fails - this prevents execution
            return {
              message: `${aiMessage}\n\n${missingParamsList}`,
              success: true,
            };
          }

          if (sessionContext) {
            // Auto-fill workspace/project if missing and context exists
            if (commandName !== 'listWorkspaces' && commandName !== 'createWorkspace') {
              if (parameters.workspaceSlug === undefined && sessionContext.workspaceSlug) {
                parameters.workspaceSlug = sessionContext.workspaceSlug;
              }
            }
            if (commandName.includes('Task') || commandName.includes('Project')) {
              if (
                parameters.projectSlug === undefined &&
                sessionContext.projectSlug &&
                parameters.workspaceSlug === sessionContext.workspaceSlug
              ) {
                parameters.projectSlug = sessionContext.projectSlug;
              }
            }
          }

          // Validate the project slug
          switch (commandName) {
            case 'navigateToProject': {
              const projectSlug = await this.projectService.validateProjectSlug(
                parameters.projectSlug as string,
              );

              if (projectSlug.status === 'exact' || projectSlug.status === 'fuzzy') {
                parameters.projectSlug = projectSlug.slug;
              }

              switch (projectSlug.status) {
                case 'exact':
                  aiMessage = `✅ Great! I found the project **${projectSlug.slug}**. Taking you there now.`;
                  break;

                case 'fuzzy':
                  aiMessage = `🤔 I couldn’t find an exact match, but I found something close: **${projectSlug.slug}**. Navigating there for you.`;
                  break;

                case 'not_found':
                  parameters.projectSlug = '';
                  aiMessage = `⚠️ I couldn't find any project matching that name.
                  Try again with a different project name, or use **list all projects** to see what's available.`;
                  break;
              }
              break;
            }
          }

          action = {
            name: commandName,
            parameters,
          };

          const commandChain = await this.buildCommandChain(
            commandName,
            parameters as Record<string, any>,
          );

          if (commandChain && commandChain.length > 0) {
            await this.updateContextFromCommand(
              sessionId,
              commandChain[commandChain.length - 1].name,
              commandChain[commandChain.length - 1].parameters,
              sessionContext,
            );

            const chainDescription = commandChain
              .map((cmd) => {
                if (cmd.name === 'createWorkspace')
                  return `Creating workspace "${cmd.parameters.name}"`;
                if (cmd.name === 'createProject')
                  return `Creating project "${cmd.parameters.name}"`;
                if (cmd.name === 'createTask') return `Creating task "${cmd.parameters.taskTitle}"`;
                return `Executing ${cmd.name}`;
              })
              .join(' → ');

            return {
              message: `${aiMessage}\n\n ${chainDescription}`,
              actionChain: commandChain,
              success: true,
            };
          }

          await this.updateContextFromCommand(
            sessionId,
            commandName,
            parameters as Record<string, any>,
            sessionContext,
          );
        } catch (error) {
          console.error('Failed to parse command parameters:', error);
        }
      }

      return {
        message: aiMessage,
        action,
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

  private async updateContextFromCommand(
    sessionId: string,
    commandName: string,
    parameters: Record<string, any>,
    context: any,
  ) {
    // Update workspace context
    if (commandName === 'navigateToWorkspace') {
      if (parameters.workspaceSlug) {
        const slug = await this.workspacesService.getIdBySlug(parameters.workspaceSlug as string);
        const currentWorkSpaceAllProjects = await this.projectService.getAllSlugsByWorkspaceId(
          slug ?? '',
        );
        context.currentWorkSpaceProjectSlug = currentWorkSpaceAllProjects;
        context.workspaceSlug = parameters.workspaceSlug;
        context.workspaceName = parameters.workspaceName || parameters.workspaceSlug;
        // Clear project context when switching workspaces
        delete context.projectSlug;
        delete context.projectName;
      }
    }

    // Handle createWorkspace - convert name to slug and update context
    if (commandName === 'createWorkspace') {
      if (parameters.name) {
        // Convert workspace name to slug format
        const workspaceSlug = String(parameters.name)
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        context.workspaceSlug = workspaceSlug;
        context.workspaceName = String(parameters.name);
        // Clear project context when creating new workspace
        delete context.projectSlug;
        delete context.projectName;
      }
    }

    // Update project context
    const slugify = (str: string | undefined) =>
      str
        ?.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    if (commandName === 'navigateToProject' || commandName === 'createProject') {
      const { name, projectSlug, workspaceSlug } = parameters;

      if (commandName === 'createProject') {
        // Priority: name → slug
        context.projectSlug = name ? slugify(name as string) : projectSlug;
        context.projectName = name || projectSlug;
      } else if (commandName === 'navigateToProject') {
        // Priority: projectSlug → slug from name
        context.projectSlug = projectSlug || (name ? slugify(name as string) : undefined);
        context.projectName = projectSlug || name;
      }
      if (workspaceSlug) {
        context.workspaceSlug = workspaceSlug;
      }
    }

    // Update workspace context from editWorkspace
    if (commandName === 'editWorkspace' && parameters.updates?.name) {
      if (parameters.workspaceSlug) {
        context.workspaceSlug = parameters.workspaceSlug;
        context.workspaceName = parameters.updates.name;
      }
    }

    // Update last activity timestamp
    context.lastUpdated = new Date();

    // Save updated context
    this.conversationContexts.set(
      sessionId,
      context as {
        workspaceSlug?: string;
        workspaceName?: string;
        projectSlug?: string;
        projectName?: string;
        lastUpdated: Date;
        currentWorkSpaceProjectSlug?: string[];
      },
    );
  }
  private extractContextFromMessage(sessionId: string, message: string, context: any) {
    // Prevent ReDoS attacks by limiting message length for regex processing
    const MAX_MESSAGE_LENGTH = 10000;
    const safeMessage =
      message.length > MAX_MESSAGE_LENGTH ? message.substring(0, MAX_MESSAGE_LENGTH) : message;

    const lowerMessage = safeMessage.toLowerCase();
    let contextUpdated = false;

    // Extract workspace mentions - improved patterns
    const workspacePatterns = [
      /(?:go\s+with|use|with|navigate\s+to|go\s+to)\s+workspace\s+["']([^"']+)["']?/gi,
      /workspace\s+is\s+["']([^"']+)["']?/gi,
      /use\s+["']?([^"'.,!?\n]+)\s+workspace["']?/gi,
      /["']([^"']+)\s+workspace["']?/gi,
      /in\s+(?:the\s+)?["']?([^"'.,!?\n]+)\s+workspace["']?/gi,
      /["']?([a-zA-Z][^"'.,!?\n]*?)\s+w[uo]rkspace["']?/gi,
      // Add pattern for "take me to X" or "navigate to X"
      /(?:take\s+me\s+to|navigate\s+to|go\s+to)\s+["']?([^"'.,!?\n]+)["']?(?:\s+workspace)?/gi,
    ];

    for (const pattern of workspacePatterns) {
      const matches = [...safeMessage.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const workspaceName = match[1].trim();

          context.workspaceName = workspaceName;
          contextUpdated = true;

          // Clear project context when switching workspaces (unless mentioned in same message)
          if (!lowerMessage.includes('project')) {
            delete context.projectSlug;
            delete context.projectName;
          }

          break; // Use first match
        }
      }
    }

    // Extract project mentions - improved patterns
    const projectPatterns = [
      // "Ok, go with HIMS project"
      /(?:ok,?\s+)?(?:go\s+with|use|with|navigate\s+to|go\s+to)\s+["']?([^"'.,!?\n]+?)\s+project["']?/gi,
      // "I choose hims"
      /(?:i\s+)?(?:choose|select|pick)\s+["']?([^"'.,!?\n]+)["']?/gi,
      // "project is HIMS"
      /project\s+is\s+["']?([^"'.,!?\n]+)["']?/gi,
      // "HIMS project"
      /["']?([^"'.,!?\n\s]+)\s+project["']?/gi,
      // "in HIMS project"
      /in\s+(?:the\s+)?["']?([^"'.,!?\n]+?)\s+project["']?/gi,
      // Add pattern for "take me to project X"
      /(?:take\s+me\s+to|navigate\s+to|go\s+to)\s+project\s+["']?([^"'.,!?\n]+)["']?/gi,
    ];

    for (const pattern of projectPatterns) {
      const matches = [...safeMessage.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const projectName = match[1].trim();

          // Skip if it looks like a workspace (contains 'workspace')
          if (
            projectName.toLowerCase().includes('workspace') ||
            projectName.toLowerCase().includes('wokspace')
          ) {
            continue;
          }

          // Skip common words that aren't project names
          const skipWords = [
            'yes',
            'no',
            'ok',
            'fine',
            'good',
            'sure',
            'right',
            'correct',
            'thanks',
            'thank you',
            'i want to create a task drink water',
            'can you first list the projects sot hat i can choose',
            'the',
            'a',
            'an',
            'and',
            'or',
            'but',
            'with',
            'without',
            'please',
            'help',
          ];
          if (
            skipWords.some((word) => projectName.toLowerCase().includes(word)) ||
            projectName.toLowerCase().startsWith('i want to') ||
            projectName.toLowerCase().startsWith('can you')
          ) {
            continue;
          }

          // Convert name to slug format
          const projectSlug = projectName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

          context.projectSlug = projectSlug;
          context.projectName = projectName;
          contextUpdated = true;

          break; // Use first match
        }
      }
    }

    // Update last activity timestamp and save context
    if (contextUpdated) {
      context.lastUpdated = new Date();
      this.conversationContexts.set(
        sessionId,
        context as {
          workspaceSlug?: string;
          workspaceName?: string;
          projectSlug?: string;
          projectName?: string;
          lastUpdated: Date;
          currentWorkSpaceProjectSlug?: string[];
        },
      );
    }
  }

  // Clear context for a specific session
  clearContext(sessionId: string): { success: boolean } {
    if (this.conversationContexts.has(sessionId)) {
      this.conversationContexts.delete(sessionId);
    }
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

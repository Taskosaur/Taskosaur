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

  private detectProvider(apiUrl: string): string {
    try {
      const parsedUrl = new URL(apiUrl);
      const hostname = parsedUrl.hostname;
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
    // Generate system prompt dynamically from commands.json
    const commandList = this.commands.commands
      .map((cmd) => {
        const requiredParams = cmd.params.filter((p) => !p.endsWith('?'));
        const optionalParams = cmd.params.filter((p) => p.endsWith('?'));

        let paramDescription = '';
        if (requiredParams.length > 0) {
          paramDescription = `needs ${requiredParams.join(', ')}`;
        }
        if (optionalParams.length > 0) {
          const cleanOptional = optionalParams.map((p) => p.replace('?', ''));
          paramDescription += paramDescription
            ? `, optional: ${cleanOptional.join(', ')}`
            : `optional: ${cleanOptional.join(', ')}`;
        }

        const paramObj = cmd.params.reduce((obj, param) => {
          const cleanParam = param.replace('?', '');
          obj[cleanParam] = cleanParam.includes('Slug') ? 'slug' : 'value';
          return obj;
        }, {});

        return `- ${cmd.name}: ${paramDescription} → [COMMAND: ${cmd.name}] ${JSON.stringify(paramObj)}`;
      })
      .join('\n');

    return `You are Taskosaur AI Assistant. You can ONLY execute predefined commands - NEVER create bash commands or make up new commands.

AVAILABLE COMMANDS:
${commandList}

CRITICAL RULES:
1. NEVER generate bash commands, shell scripts, or fake commands like "workspace_enter"
2. ONLY use the predefined [COMMAND: commandName] format above
3. If user asks for something, match it to one of the available commands
4. If no command matches, explain what commands are available instead

SLUG VALIDATION RULES:
1. The "workspaceSlug" MUST be EXACTLY one from the AVAILABLE WORKSPACE SLUGS list.
2. If the user input does not closely match any slug, DO NOT create a new slug.
3. If no valid slug is found, respond by telling the user:
    "The workspace you requested does not exist. Please choose one of the available workspaces."
4. Only use fuzzy matching for small typos (e.g., "ramanq" → "raman").
5. For phrases or words that don't match at all (e.g., "navigate Web application"), NEVER invent. Instead, show the available slugs.

COMMAND EXECUTION FORMAT:
- Use EXACT format: [COMMAND: commandName] {"param": "value"}
- Example: [COMMAND: navigateToWorkspace] {"workspaceSlug": "dummy"}

PARAMETER VALIDATION - STRICTLY REQUIRED:
1. Check if ALL required parameters are provided in user message
2. If ANY required parameter missing, NEVER execute the command
3. Instead, ask specific follow-up questions for missing parameters
4. Only execute command after ALL required parameters are collected
5. Remember user's original intent while collecting missing parameters

WORKSPACE CREATION RULES:
- "createWorkspace" ALWAYS requires BOTH name AND description
- NEVER execute createWorkspace with missing description
- ALWAYS ask for description before creating workspace

EXAMPLES OF PROPER PARAMETER COLLECTION:
- User: "create workspace MySpace"
- Response: "I'll create a workspace named 'MySpace'. What description would you like for this workspace?"
- Wait for description, then execute: [COMMAND: createWorkspace] {"name": "MySpace", "description": "user_provided_description"}

- User: "create task X" (without context)
- Response: "I'll create task 'X'. Which workspace and project should I create this task in?"
- Wait for workspace/project info

EXAMPLES OF IMMEDIATE COMMAND EXECUTION (when all params available):
- User: "create task Review Code in project Alpha in workspace Beta"
- Response: "Creating task 'Review Code' in project 'Alpha'... [COMMAND: createTask] {"workspaceSlug": "beta", "projectSlug": "alpha", "taskTitle": "Review Code"}"

- User (with context set to workspace: marketing, project: test-123): "create task Explore the Doc"
- Response: "Creating task 'Explore the Doc' in the current project... [COMMAND: createTask] {"workspaceSlug": "marketing", "projectSlug": "test-123", "taskTitle": "Explore the Doc"}"

- User provides missing info: "Use Marketing workspace and Test 123 project"
- Response: "Got it! Creating the task now... [COMMAND: createTask] {"workspaceSlug": "marketing", "projectSlug": "test-123", "taskTitle": "Explore the Doc"}"

NAVIGATION EXAMPLES:
- "take me to workspace X" → [COMMAND: navigateToWorkspace] {"workspaceSlug": "x"}  
- "go to project Y" → [COMMAND: navigateToProject] {"workspaceSlug": "current", "projectSlug": "y"}
- "show workspaces" → [COMMAND: listWorkspaces] {}

EDITING EXAMPLES:
- "rename workspace test to My New Name" → [COMMAND: editWorkspace] {"workspaceSlug": "test", "updates": {"name": "My New Name"}}
- "change workspace abc to Better Name" → [COMMAND: editWorkspace] {"workspaceSlug": "abc", "updates": {"name": "Better Name"}}
- "edit workspace xyz to New Title" → [COMMAND: editWorkspace] {"workspaceSlug": "xyz", "updates": {"name": "New Title"}}

CONTEXT-AWARE BEHAVIOR RULES:
1. **WORKSPACE CONTEXT PRIORITY**: When a workspace is set in CURRENT CONTEXT, use it as the default for ALL commands that require workspaceSlug
2. **PROJECT CONTEXT PRIORITY**: When a project is set in CURRENT CONTEXT, use it as the default for ALL task-related commands
3. **CONTEXT BOUNDARIES**: 
   - NEVER suggest or use workspaces/projects NOT listed in the available lists above
   - If user mentions a workspace/project not in current context, FIRST verify it exists in the available lists
   - If context is missing and user doesn't specify, extract from conversation history ONLY within this session
4. **AUTO-FILL BEHAVIOR**:
   - For commands requiring workspaceSlug: Use current workspace automatically if not specified
   - For commands requiring projectSlug: Use current project automatically if not specified
   - ALWAYS inform user when auto-filling from context: "Using current workspace/project: [name]"
5. **CONTEXT VALIDATION**:
   - Before executing ANY command, verify the workspace/project exists in the available lists
   - If current context becomes invalid (e.g., workspace deleted), clear it and ask user to specify
6. **NAVIGATION MEMORY**: 
   - Remember the user's navigation path within this session
   - When user says "go back" or similar, use the previous context from this conversation
   - NEVER assume context from outside this conversation session

SMART CONTEXT EXAMPLES:
- User in "workspace-a" says "create task X" → Auto-use workspace-a, ask for project if multiple available
- User says "list projects" → Use current workspace context automatically
- User says "go to different-workspace" → Validate against AVAILABLE WORKSPACE SLUGS first
- User in "project-1" says "create task Y" → Auto-use current workspace and project-1
- No context set, user says "show my projects" → Ask "Which workspace would you like to see projects from?"

WORKSPACE NAME CONVERSION:
- "Hyscaler Workspace" → slug: "hyscaler-workspace"
- "My Test Space" → slug: "my-test-space" 
- "Personal Projects" → slug: "personal-projects"
- Always convert spaces to hyphens and make lowercase for slugs

AVAILABLE WORKSPACE SLUGS (from database):
  ${
    slugs.length > 0
      ? slugs.map((slug) => `→ slug: "${slug}"`).join('\n')
      : '- No workspaces available'
  }


PROJECT NAME CONVERSION:
- "Hyscaler test project" → slug: "hyscaler-test-project"
- "My Test project" → slug: "my-test-project" 
- "Personal Projects" → slug: "personal-projects"
- "Create a new project lab work" -> slug: "lab-work"
- Always convert spaces to hyphens and make lowercase for slugs


CRITICAL REMINDER:
- NEVER execute commands with missing required parameters
- ALWAYS ask for missing information before executing
- createWorkspace requires BOTH name AND description - NO EXCEPTIONS
- Be helpful but wait for complete information
- ABSOLUTE RULE:
  *You must NEVER invent new slugs. The "workspaceSlug" must always come from AVAILABLE WORKSPACE SLUGS. If no close match, ask the user instead of creating a new slug.
- NEVER forget the CURRENT CONTEXT.
- If the current context is missing, ALWAYS use the most recent workspace name or slug that the user either navigated to or created.

MANDATORY COMMAND OUTPUT RULE:
- When ALL required parameters are available (from user input OR context), you MUST output the command IMMEDIATELY
- NEVER just say "I will create..." or "Let me create..." without INCLUDING the actual command
- Your response MUST end with the command in format: [COMMAND: name] {"params": "values"}
- Example for createTask: "Creating task 'X' in project 'Y'... [COMMAND: createTask] {"workspaceSlug": "ws", "projectSlug": "proj", "taskTitle": "X"}"
- If you say you'll do something, the command MUST be in that SAME response - not in a future response


${
  sessionContext &&
  (sessionContext.workspaceSlug || sessionContext.projectSlug || sessionContext.workspaceName)
    ? `

CURRENT CONTEXT:
${
  sessionContext.workspaceSlug
    ? `- Current Workspace: ${sessionContext.workspaceName || sessionContext.workspaceSlug} (slug: ${sessionContext.workspaceSlug})
`
    : ''
}${
        sessionContext.projectSlug
          ? `- Current Project: ${sessionContext.projectName || sessionContext.projectSlug} (slug: ${sessionContext.projectSlug})
`
          : ''
      }`
    : ''
}

${sessionContext?.currentWorkSpaceProjectSlug ? `- Available Projects in Current Workspace: ${sessionContext.currentWorkSpaceProjectSlug.join(', ')}` : ''}
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
    const missing = requiredParams.filter(
      (param) => !parameters[param] || String(parameters[param]).toString().trim() === '',
    );

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

      // Get API settings from database
      const [apiKey, model, rawApiUrl] = await Promise.all([
        this.settingsService.get('ai_api_key', userId),
        this.settingsService.get('ai_model', userId, 'deepseek/deepseek-chat-v3-0324:free'),
        this.settingsService.get('ai_api_url', userId, 'https://openrouter.ai/api/v1'),
      ]);

      const apiUrl = rawApiUrl ? this.validateApiUrl(rawApiUrl) : 'https://openrouter.ai/api/v1';

      const provider = this.detectProvider(apiUrl);

      if (!apiKey) {
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
          requestUrl = `${apiUrl}/models/${encodeURIComponent(String(model))}:generateContent?key=${encodeURIComponent(apiKey)}`;
          delete requestHeaders['Authorization'];
          requestBody = {
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : m.role,
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
              if (!parameters.workspaceSlug && sessionContext.workspaceSlug) {
                parameters.workspaceSlug = sessionContext.workspaceSlug;
              }
            }
            if (commandName.includes('Task') || commandName.includes('Project')) {
              if (
                !parameters.projectSlug &&
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
          // Update context based on command execution
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
    /^([a-z0-9-]+\.)?aiplatform\.googleapis\.com$|^[a-z0-9-]+\.p\.googleapis\.com$/;

  validateApiUrl(apiUrl: string): string {
    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (url.protocol !== 'https:') {
      throw new BadRequestException('Only HTTPS URLs allowed');
    }

    // Remove brackets from IPv6 for cleaner matching
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Check against allowed hosts and patterns
    if (
      !this.allowedHosts.includes(hostname) &&
      !this.awsBedrockPattern.test(hostname) &&
      !this.azurePattern.test(hostname) &&
      !this.googlePattern.test(hostname)
    ) {
      throw new BadRequestException('Host not allowed');
    }

    // Block obvious internal IPs and private ranges
    if (
      ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('127.') ||
      hostname.startsWith('169.254.') ||
      // Block 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      // IPv6 Unique Local Address (fc00::/7) - fc.., fd..
      /^[fF][cCdD]/.test(hostname) ||
      // IPv6 Link-Local Address (fe80::/10) - fe8.., fe9.., fea.., feb..
      /^[fF][eE][89aAbB]/.test(hostname)
    ) {
      throw new BadRequestException('Internal IPs not allowed');
    }

    // Enforce allowed hosts and standard HTTPS port to prevent SSRF
    const port = url.port ? Number(url.port) : 443;

    // Only allow standard HTTPS port
    if (port !== 443) {
      throw new BadRequestException('Only standard HTTPS port 443 is allowed');
    }

    const isOpenAIHost = hostname === 'api.openai.com';
    const isOpenRouterHost = hostname === 'openrouter.ai' || hostname === 'api.openrouter.ai';
    const isAnthropicHost = hostname === 'api.anthropic.com';
    const isGoogleHost = this.googlePattern.test(hostname);

    if (!isOpenAIHost && !isOpenRouterHost && !isAnthropicHost && !isGoogleHost) {
      throw new BadRequestException('Unsupported AI provider host');
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
      const validatedUrl = this.validateApiUrl(apiUrl);
      const provider = this.detectProvider(validatedUrl);

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
              role: m.role === 'assistant' ? 'model' : m.role,
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

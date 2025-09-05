import { automationExecutor } from './automation-executor';
import api from '@/lib/api';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// MCP Server configuration for Taskosaur context
export interface TaskosaurContext {
  currentWorkspace?: string;
  currentProject?: string;
  currentUser?: {
    id: string;
    email: string;
    name: string;
  };
  permissions?: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  parameters?: any;
  execute: (params: any, context: TaskosaurContext) => Promise<any>;
}

// Helper function to aggressively clean command text from responses
function cleanCommandFromResponse(text: string): string {
  return text
    // Remove command blocks with various formats
    .replace(/\*\*\[COMMAND:\s*[^\]]+\]\*\*(\s*\{[^}]*\})?/gi, '')
    .replace(/\[COMMAND:\s*[^\]]+\](\s*\{[^}]*\})?/gi, '')
    // Remove standalone JSON parameter objects
    .replace(/^\s*\{[^}]*"name"\s*:\s*"[^"]*"[^}]*\}\s*$/gm, '')
    .replace(/^\s*\{[^}]*"workspaceSlug"\s*:\s*"[^"]*"[^}]*\}\s*$/gm, '')
    // Remove empty lines and clean up
    .replace(/^\s*\n/gm, '')
    .trim();
}

class MCPServer {
  private context: TaskosaurContext = {};
  private tools: Map<string, MCPTool> = new Map();
  private conversationHistory: ChatMessage[] = [];

  // Initialize MCP server with context
  initialize(context: TaskosaurContext = {}) {
    this.context = context;
    this.conversationHistory = [];
  }

  // Update context (e.g., when user navigates to different workspace/project)
  updateContext(updates: Partial<TaskosaurContext>) {
    this.context = { ...this.context, ...updates };
  }

  // Register a tool that the AI can use
  registerTool(tool: MCPTool) {
    this.tools.set(tool.name, tool);
  }

  // Process a message from the user
  async processMessage(
    message: string,
    options: {
      stream?: boolean;
      onChunk?: (chunk: string) => void;
    } = {}
  ): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    // Build history for context
    const history = this.conversationHistory.slice(0, -1); // Exclude current message

    try {
      let response: string;

      // Call backend API using centralized API client
      const apiResponse = await api.post('/ai-chat/chat', {
        message,
        history,
        workspaceId: this.context.currentWorkspace,
        projectId: this.context.currentProject
      });

      const data = apiResponse.data;
      if (!data.success) {
        throw new Error(data.error || 'Chat request failed');
      }

      response = data.message;
      
      // Clean command syntax from the response
      let userVisibleResponse = cleanCommandFromResponse(response);
      
      // If response becomes empty after cleaning, provide a user-friendly message
      if (!userVisibleResponse || userVisibleResponse.length < 10) {
        if (data.action && data.action.name) {
          switch (data.action.name) {
            case 'listWorkspaces':
              userVisibleResponse = "Let me show you your available workspaces...";
              break;
            case 'createProject':
              userVisibleResponse = "Creating your project now...";
              break;
            case 'createTask':
              userVisibleResponse = "Creating your task now...";
              break;
            default:
              userVisibleResponse = "Processing your request...";
          }
        } else {
          // Check if original response was mostly command syntax
          const cleanOriginal = cleanCommandFromResponse(response);
          userVisibleResponse = cleanOriginal || "Let me help you with that...";
        }
      }

      // Handle streaming for UI compatibility - show clean response
      if (options.stream && options.onChunk) {
        const words = userVisibleResponse.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          options.onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Add response to history with context about what was created
      let historyContent = userVisibleResponse;
      if (data.action && data.action.name === 'createWorkspace' && data.action.parameters.name) {
        historyContent = `${userVisibleResponse} [Created workspace: ${data.action.parameters.name}]`;
      } else if (data.action && data.action.name === 'createProject' && data.action.parameters.name) {
        historyContent = `${userVisibleResponse} [Created project: ${data.action.parameters.name} in workspace: ${data.action.parameters.workspaceSlug}]`;
      }
      
      this.conversationHistory.push({
        role: 'assistant',
        content: historyContent
      });

      // Check if backend returned an action to execute (execute silently in background)
      if (data.action && data.action.name) {
        // Execute automation in the background without showing to user
        this.executeActionInBackground(data.action, userVisibleResponse, options);
      }

      // Keep more history for better context (last 10 messages)
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return response;
    } catch (error) {
      console.error('MCP Server error:', error);
      throw error;
    }
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
  }

  // Get current context
  getContext() {
    return this.context;
  }

  // Get registered tools
  getTools() {
    return Array.from(this.tools.values());
  }

  // Execute action in background and emit events
  private async executeActionInBackground(
    action: { name: string; parameters: Record<string, any> },
    userResponse: string,
    options: { stream?: boolean; onChunk?: (chunk: string) => void }
  ) {
    try {
      const parameters = { ...action.parameters };
      
      // Replace "current" placeholders with actual context
      if (parameters.workspaceSlug === 'current' && this.context.currentWorkspace) {
        parameters.workspaceSlug = this.context.currentWorkspace;
      }
      if (parameters.projectSlug === 'current' && this.context.currentProject) {
        parameters.projectSlug = this.context.currentProject;
      }
      if (parameters.organizationId === 'current') {
        // Get organization ID from localStorage
        const orgId = typeof window !== 'undefined' ? localStorage.getItem('currentOrganizationId') : null;
        if (orgId) {
          parameters.organizationId = orgId;
        }
      }
      
      // Convert workspace names to slugs if they're not already slugs
      if (parameters.workspaceSlug && typeof parameters.workspaceSlug === 'string') {
        console.log(`MCP: Processing workspaceSlug: "${parameters.workspaceSlug}"`);
        
        // If it looks like a name (contains spaces, capitals, or special chars), try to find the actual slug
        if (parameters.workspaceSlug.includes(' ') || /[A-Z]/.test(parameters.workspaceSlug) || parameters.workspaceSlug.toLowerCase() !== parameters.workspaceSlug.replace(/[^a-z0-9-]/g, '')) {
          console.log('MCP: Workspace slug looks like a name, converting...');
          
          // First try to get the slug from the current context
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const pathParts = currentPath.split('/').filter(Boolean);
          console.log(`MCP: Current path parts: [${pathParts.join(', ')}]`);
          
          // If we're already in a workspace, use that slug
          if (pathParts.length > 0 && !['dashboard', 'settings', 'activity'].includes(pathParts[0])) {
            console.log(`MCP: Using current workspace slug: "${pathParts[0]}"`);
            parameters.workspaceSlug = pathParts[0];
          } else {
            // Try to find the actual workspace slug by name
            const originalName = parameters.workspaceSlug;
            console.log(`MCP: Searching for workspace with name: "${originalName}"`);
            
            try {
              // Import the listWorkspaces function
              const { listWorkspaces } = await import('../utils/automation/workspace');
              const result = await listWorkspaces({ timeout: 5000 });
              
              if (result.success && result.data?.workspaces) {
                console.log(`MCP: Found ${result.data.workspaces.length} workspaces to search`);
                
                // Find workspace by name (case-insensitive)
                const matchingWorkspace = result.data.workspaces.find((w: any) => 
                  w.name && w.name.toLowerCase() === originalName.toLowerCase()
                );
                
                if (matchingWorkspace && matchingWorkspace.slug) {
                  console.log(`MCP: Found matching workspace with slug: "${matchingWorkspace.slug}"`);
                  parameters.workspaceSlug = matchingWorkspace.slug;
                } else {
                  // Fallback to simple slug conversion
                  parameters.workspaceSlug = originalName
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9-]/g, '');
                  console.log(`MCP: No matching workspace found, using generated slug: "${parameters.workspaceSlug}"`);
                }
              } else {
                // Fallback to simple slug conversion if listWorkspaces fails
                parameters.workspaceSlug = originalName
                  .toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '');
                console.log(`MCP: listWorkspaces failed, using generated slug: "${parameters.workspaceSlug}"`);
              }
            } catch (error) {
              // Fallback to simple slug conversion if there's any error
              parameters.workspaceSlug = originalName
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
              console.log(`MCP: Error looking up workspaces, using generated slug: "${parameters.workspaceSlug}"`);
            }
          }
        } else {
          console.log('MCP: Workspace slug already looks like a slug, using as-is');
        }
        
        console.log(`MCP: Final workspaceSlug: "${parameters.workspaceSlug}"`);
      }

      // Emit automation start event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aiAutomationStart', {
          detail: { action: action.name, parameters: parameters }
        }));
      }

      // Show execution indicator in chat
      if (options.stream && options.onChunk) {
        options.onChunk('\n\n🔄 Executing...');
      }

      // Execute the automation
      const result = await automationExecutor.executeAction(action.name, parameters);
      
      // Format result
      const formattedResult = automationExecutor.formatResult(result);

      // Show result in chat
      if (options.stream && options.onChunk) {
        const resultWords = formattedResult.split(' ');
        for (let i = 0; i < resultWords.length; i++) {
          const chunk = (i === 0 ? '\n' : ' ') + resultWords[i];
          options.onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      // Update conversation history with result
      const finalResponse = `${userResponse}\n\n${formattedResult}`;
      if (this.conversationHistory.length > 0) {
        this.conversationHistory[this.conversationHistory.length - 1].content = finalResponse;
      }

      // Emit automation success event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aiAutomationSuccess', {
          detail: { action: action.name, parameters: parameters, result: result }
        }));
      }

    } catch (error) {
      console.error('Failed to execute action:', error);
      const errorMessage = `❌ ${error instanceof Error ? error.message : 'Failed to execute command'}`;

      // Show error in chat
      if (options.stream && options.onChunk) {
        options.onChunk(`\n\n${errorMessage}`);
      }

      // Update conversation history with error
      const finalResponse = `${userResponse}\n\n${errorMessage}`;
      if (this.conversationHistory.length > 0) {
        this.conversationHistory[this.conversationHistory.length - 1].content = finalResponse;
      }

      // Emit automation error event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aiAutomationError', {
          detail: { action: action.name, parameters: action.parameters, error: error.message }
        }));
      }
    }
  }
}

// Export singleton instance
export const mcpServer = new MCPServer();

// Helper function to extract workspace and project from URL
export function extractContextFromPath(pathname: string): Partial<TaskosaurContext> {
  const pathParts = pathname.split('/').filter(Boolean);
  const context: Partial<TaskosaurContext> = {};

  if (pathParts.length > 0 && !['dashboard', 'workspaces', 'settings', 'activities'].includes(pathParts[0])) {
    context.currentWorkspace = pathParts[0];
  }

  if (pathParts.length > 1 && context.currentWorkspace && !['projects', 'members', 'settings'].includes(pathParts[1])) {
    context.currentProject = pathParts[1];
  }

  return context;
}
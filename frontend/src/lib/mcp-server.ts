import api from "@/lib/api";
import * as crypto from 'crypto';

interface ChatMessage {
  role: "system" | "user" | "assistant";
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

class MCPServer {
  private context: TaskosaurContext = {};
  private tools: Map<string, MCPTool> = new Map();
  private conversationHistory: ChatMessage[] = [];
  private sessionId: string = this.getOrCreateSessionId();

  // Initialize MCP server with context
  initialize(context: TaskosaurContext = {}) {
    this.context = context;
    this.conversationHistory = [];
    // Don't regenerate session ID on initialize - keep the persistent one
  }

  getCurrentOrganizationId(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("currentOrganizationId");
    }
    return null;
  }

  private getOrCreateSessionId(): string {
    // Try to get existing session ID from localStorage or sessionStorage
    if (typeof window !== "undefined") {
      let sessionId = sessionStorage.getItem("mcp-session-id");
      if (!sessionId) {
        // Use cryptographically secure random value for suffix
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const randomSuffix = array[0].toString(36).substring(0, 9);
        sessionId = `session_${Date.now()}_${randomSuffix}`;
        sessionStorage.setItem("mcp-session-id", sessionId);
      } else {
      }
      return sessionId;
    }

    // Fallback for server-side rendering
    // Fallback for server-side rendering: use insecure randomness, but ideally would use node crypto. Here, using insecure randomness as last resort.
    let randomSuffix = '';
    try {
      // Try Node.js crypto if available
      randomSuffix = crypto.randomBytes(4).toString('hex').substring(0, 9);
    } catch (e) {
      randomSuffix = Math.random().toString(36).substring(2, 11);
    }
    return `session_${Date.now()}_${randomSuffix}`;
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
      role: "user",
      content: message,
    });

    const currentOrganizationId: string | null = this.getCurrentOrganizationId();

    // Build history for context
    const history = this.conversationHistory.slice(0, -1); // Exclude current message

    try {
      // Call backend API using centralized API client
      const apiResponse = await api.post(
        "/ai-chat/chat",
        {
          message,
          history,
          workspaceId: this.context.currentWorkspace,
          projectId: this.context.currentProject,
          sessionId: this.sessionId,
          currentOrganizationId: currentOrganizationId,
        },
        { timeout: 18000 }
      );

      const data = apiResponse.data;
      if (!data.success) {
        throw new Error(data.error || "Chat request failed");
      }

      const response = data.message;

      // Handle streaming for UI compatibility
      if (options.stream && options.onChunk) {
        const words = response.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          options.onChunk(chunk);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Add response to history
      this.conversationHistory.push({
        role: "assistant",
        content: response,
      });

      // Keep more history for better context (last 10 messages)
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return response;
    } catch (error) {
      console.error("MCP Server error:", error);
      throw error;
    }
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
  }

  // Clear context both locally and on backend
  async clearContext(): Promise<void> {
    try {
      // Clear local context
      this.context = {
        currentUser: this.context.currentUser, // Keep user info
        permissions: this.context.permissions, // Keep permissions
      };

      // Clear backend context
      await api.delete(`/ai-chat/context/${this.sessionId}`);
    } catch (error) {
      console.error("[MCP] Failed to clear context on backend:", error);
      // Still clear local context even if backend fails
      this.context = {
        currentUser: this.context.currentUser,
        permissions: this.context.permissions,
      };
    }
  }

  // Get conversation history
  getHistory() {
    return this.conversationHistory;
  }

  // Get current context
  getContext() {
    return this.context;
  }

  // Get registered tools
  getTools() {
    return Array.from(this.tools.values());
  }
}

// Export singleton instance
export const mcpServer = new MCPServer();

// Helper function to extract workspace and project from URL
export function extractContextFromPath(pathname: string): Partial<TaskosaurContext> {
  const context: Partial<TaskosaurContext> = {};
  if (pathname == null || pathname == undefined) return context;
  const pathParts = pathname.split("/").filter(Boolean);

  // Exclude known global routes that are not workspaces
  const globalRoutes = [
    "dashboard",
    "workspaces",
    "settings",
    "activities",
    "tasks",
    "projects",
    "notifications",
    "organization",
    "public",
    "login",
    "register",
    "forgot-password",
    "reset-password",
    "invite",
    "intro",
    "setup",
    "privacy-policy",
    "terms-of-service",
    "404",
  ];

  if (
    pathParts?.length > 0 &&
    !globalRoutes.includes(pathParts[0])
  ) {
    context.currentWorkspace = pathParts[0];
  }

  // Exclude known sub-routes that are not projects
  const workspaceSubRoutes = ["projects", "members", "settings", "tasks", "activities"];

  if (
    pathParts?.length > 1 &&
    context.currentWorkspace &&
    !workspaceSubRoutes.includes(pathParts[1])
  ) {
    context.currentProject = pathParts[1];
  }

  return context;
}

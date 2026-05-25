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

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
  sessionId: string;
}

class MCPServer {
  private context: TaskosaurContext = {};
  private tools: Map<string, MCPTool> = new Map();
  private conversations: Record<string, Conversation> = {};
  private currentConversationId: string = "";

  // Initialize MCP server with context
  async initialize(context: TaskosaurContext = {}) {
    this.context = context;
    await this.loadAll();
  }

  async loadAll() {
    if (typeof window !== "undefined") {
      try {
        const response = await api.get("/ai-chat/conversations");
        const list = response.data || [];
        
        this.conversations = {};
        list.forEach((conv: any) => {
          this.conversations[conv.id] = {
            id: conv.id,
            title: conv.title,
            sessionId: conv.sessionId,
            updatedAt: conv.updatedAt,
            messages: conv.messages || [],
          };
        });
        
        let currentId = localStorage.getItem("mcp_current_conversation_id");
        if (!currentId || !this.conversations[currentId]) {
          const sorted = this.getConversations();
          if (sorted.length > 0) {
            currentId = sorted[0].id;
          } else {
            // Create default conversation locally
            const newConv = this.createNewConversationInternal();
            currentId = newConv.id;
          }
        }
        this.currentConversationId = currentId || "";
        if (this.currentConversationId) {
          localStorage.setItem("mcp_current_conversation_id", this.currentConversationId);
        }
      } catch (e) {
        console.warn("Failed to load conversations from backend, using local storage fallback", e);
        // Fallback to local storage if backend fails
        const storedConvs = localStorage.getItem("mcp_conversations");
        if (storedConvs) {
          this.conversations = JSON.parse(storedConvs);
        }
        let currentId = localStorage.getItem("mcp_current_conversation_id");
        if (!currentId || !this.conversations[currentId]) {
          const newConv = this.createNewConversationInternal();
          currentId = newConv.id;
        }
        this.currentConversationId = currentId;
      }
    }
  }


  private createNewConversationInternal(title = "New Chat"): Conversation {
    let randomSuffix = "";
    if (typeof window !== "undefined") {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      randomSuffix = array[0].toString(36).substring(0, 9);
    } else {
      try {
        randomSuffix = crypto.randomBytes(4).toString('hex').substring(0, 9);
      } catch (e) {
        randomSuffix = Math.random().toString(36).substring(2, 11);
      }
    }
    const id = `chat_${Date.now()}_${randomSuffix}`;
    const sessionId = `session_${Date.now()}_${randomSuffix}`;
    
    const newConv: Conversation = {
      id,
      title,
      messages: [],
      updatedAt: new Date().toISOString(),
      sessionId,
    };
    
    this.conversations[id] = newConv;
    return newConv;
  }


  getConversations(): Conversation[] {
    return Object.values(this.conversations)
      .filter((c) => c.messages && c.messages.length > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getCurrentConversation(): Conversation {
    if (!this.currentConversationId || !this.conversations[this.currentConversationId]) {
      // Return a temporary/empty conversation object if not loaded yet to prevent runtime crash
      return {
        id: "",
        title: "New Chat",
        messages: [],
        updatedAt: new Date().toISOString(),
        sessionId: "",
      };
    }
    return this.conversations[this.currentConversationId];
  }

  async switchConversation(id: string) {
    if (this.conversations[id]) {
      this.currentConversationId = id;
      localStorage.setItem("mcp_current_conversation_id", id);
      // Reload from backend to get the latest messages
      await this.loadAll();
    }
  }

  async startNewConversation(title = "New Chat"): Promise<string> {
    // Reuse existing empty conversation if one exists
    const emptyConv = Object.values(this.conversations).find(
      (c) => !c.messages || c.messages.length === 0
    );
    if (emptyConv) {
      this.currentConversationId = emptyConv.id;
      localStorage.setItem("mcp_current_conversation_id", emptyConv.id);
      return emptyConv.id;
    }

    const newConv = this.createNewConversationInternal(title);
    this.currentConversationId = newConv.id;
    localStorage.setItem("mcp_current_conversation_id", newConv.id);
    return newConv.id;
  }

  async deleteConversation(id: string): Promise<string> {
    try {
      if (!id.startsWith("chat_")) {
        await api.delete(`/ai-chat/conversations/${id}`);
      }
    } catch (e) {
      console.warn("Failed to delete conversation on backend", e);
    }

    delete this.conversations[id];
    let nextId = "";
    if (this.currentConversationId === id) {
      const remaining = this.getConversations();
      if (remaining.length > 0) {
        nextId = remaining[0].id;
        this.currentConversationId = nextId;
      } else {
        const newConv = await this.startNewConversation();
        nextId = newConv;
        this.currentConversationId = nextId;
      }
    } else {
      nextId = this.currentConversationId;
    }
    localStorage.setItem("mcp_current_conversation_id", this.currentConversationId);
    return nextId;
  }

  async renameConversation(id: string, newTitle: string) {
    if (this.conversations[id]) {
      this.conversations[id].title = newTitle;
      this.conversations[id].updatedAt = new Date().toISOString();
      try {
        if (!id.startsWith("chat_")) {
          await api.patch(`/ai-chat/conversations/${id}`, { title: newTitle });
        }
      } catch (e) {
        console.warn("Failed to rename conversation on backend", e);
      }
    }
  }

  get conversationHistory(): ChatMessage[] {
    return this.getCurrentConversation().messages;
  }

  set conversationHistory(messages: ChatMessage[]) {
    const conv = this.getCurrentConversation();
    if (conv.id) {
      conv.messages = messages;
      conv.updatedAt = new Date().toISOString();
    }
  }

  async saveHistory(messages: ChatMessage[]) {
    const conv = this.getCurrentConversation();
    if (conv.id) {
      conv.messages = messages;
      conv.updatedAt = new Date().toISOString();
      try {
        if (!conv.id.startsWith("chat_")) {
          await api.put(`/ai-chat/conversations/${conv.id}/messages`, { messages });
        }
      } catch (e) {
        console.warn("Failed to sync messages to backend", e);
      }
    }
  }

  get sessionId(): string {
    return this.getCurrentConversation().sessionId;
  }

  getCurrentOrganizationId(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("currentOrganizationId");
    }
    return null;
  }

  updateContext(updates: Partial<TaskosaurContext>) {
    this.context = { ...this.context, ...updates };
  }

  registerTool(tool: MCPTool) {
    this.tools.set(tool.name, tool);
  }

  async processMessage(
    message: string,
    options: {
      stream?: boolean;
      onChunk?: (chunk: string) => void;
    } = {}
  ): Promise<string> {
    const currentConv = this.getCurrentConversation();
    if (currentConv.id) {
      currentConv.messages.push({
        role: "user",
        content: message,
      });
      currentConv.updatedAt = new Date().toISOString();
    }

    const currentOrganizationId = this.getCurrentOrganizationId();

    try {
      const apiResponse = await api.post(
        "/ai-chat/chat",
        {
          message,
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

      if (options.stream && options.onChunk) {
        const words = response.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          options.onChunk(chunk);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Reload conversations from backend to sync history and title updates
      await this.loadAll();

      return response;
    } catch (error) {
      console.error("MCP Server error:", error);
      throw error;
    }
  }

  async clearHistory() {
    try {
      const conv = this.getCurrentConversation();
      if (conv.id) {
        conv.messages = [];
        conv.updatedAt = new Date().toISOString();
      }
      await api.delete(`/ai-chat/context/${this.sessionId}`);
      await this.loadAll();
    } catch (error) {
      console.error("[MCP] Failed to clear history on backend:", error);
    }
  }

  async clearContext(): Promise<void> {
    try {
      this.context = {
        currentUser: this.context.currentUser,
        permissions: this.context.permissions,
      };
      await api.delete(`/ai-chat/context/${this.sessionId}`);
      await this.loadAll();
    } catch (error) {
      console.error("[MCP] Failed to clear context on backend:", error);
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

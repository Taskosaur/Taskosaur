import api from "@/lib/api";
import {
  ProjectInbox,
  CreateInboxDto,
  SetupEmailDto,
  InboxMessage,
  InboxRule,
} from "@/types/inbox";

// Simple ID validator: allows UUIDs, alphanumeric, dash and underscore. Adjust if stricter pattern is needed.
function isValidId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

// Inbox API - aligned with your NestJS controller
export const inboxApi = {
  // Inbox Management
  createInbox: async (projectId: string, data: CreateInboxDto): Promise<ProjectInbox> => {
    try {
      const payload = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== "")
      );
      const response = await api.post<ProjectInbox>(`/projects/${projectId}/inbox`, payload);
      return response.data;
    } catch (error) {
      console.error("Create inbox error:", error);
      throw error;
    }
  },

  getInbox: async (projectId: string): Promise<ProjectInbox> => {
    try {
      const response = await api.get<ProjectInbox>(`/projects/${projectId}/inbox`);
      return response.data;
    } catch (error) {
      console.error("Get inbox error:", error);
      throw error;
    }
  },

  updateInbox: async (projectId: string, data: Partial<CreateInboxDto>): Promise<ProjectInbox> => {
    try {
      // Remove keys with undefined or empty string values
      const payload = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== "")
      );

      const response = await api.put<ProjectInbox>(`/projects/${projectId}/inbox`, payload);
      return response.data;
    } catch (error) {
      console.error("Update inbox error:", error);
      throw error;
    }
  },

  // Email Account Setup
  setupEmailAccount: async (projectId: string, data: SetupEmailDto): Promise<any> => {
    try {
      const response = await api.put<any>(`/projects/${projectId}/inbox/email-account`, data);
      return response.data;
    } catch (error) {
      console.error("Setup email account error:", error);
      throw error;
    }
  },

  testEmailConnection: async (
    projectId: string,
    accountId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/projects/${projectId}/inbox/test-email/${accountId}`
      );
      return response.data;
    } catch (error) {
      console.error("Test email connection error:", error);
      throw error;
    }
  },

  // Email Sync
  triggerSync: async (projectId: string): Promise<{ message: string }> => {
    try {
      const response = await api.post<{ message: string }>(`/projects/${projectId}/inbox/sync`);
      return response.data;
    } catch (error) {
      console.error("Trigger sync error:", error);
      throw error;
    }
  },

  // Messages Management
  getMessages: async (
    projectId: string,
    params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<InboxMessage[]> => {
    try {
      const queryParams = params
        ? `?${new URLSearchParams(
            Object.entries(params).reduce(
              (acc, [key, value]) => {
                if (value !== undefined) {
                  acc[key] = value.toString();
                }
                return acc;
              },
              {} as Record<string, string>
            )
          ).toString()}`
        : "";

      const response = await api.get<InboxMessage[]>(
        `/projects/${projectId}/inbox/messages${queryParams}`
      );
      return response.data;
    } catch (error) {
      console.error("Get messages error:", error);
      throw error;
    }
  },

  convertMessageToTask: async (projectId: string, messageId: string): Promise<any> => {
    try {
      const response = await api.post<any>(
        `/projects/${projectId}/inbox/messages/${messageId}/convert`
      );
      return response.data;
    } catch (error) {
      console.error("Convert message to task error:", error);
      throw error;
    }
  },

  // Rules Management
  getRules: async (projectId: string): Promise<InboxRule[]> => {
    try {
      const response = await api.get<InboxRule[]>(`/projects/${projectId}/inbox/rules`);
      return response.data;
    } catch (error) {
      console.error("Get rules error:", error);
      throw error;
    }
  },

  createRule: async (projectId: string, data: Partial<InboxRule>): Promise<InboxRule> => {
    try {
      const response = await api.post<InboxRule>(`/projects/${projectId}/inbox/rules`, data);
      return response.data;
    } catch (error) {
      console.error("Create rule error:", error);
      throw error;
    }
  },

  updateRule: async (
    projectId: string,
    ruleId: string,
    data: Partial<InboxRule>
  ): Promise<InboxRule> => {
    try {
      const response = await api.put<InboxRule>(
        `/projects/${projectId}/inbox/rules/${ruleId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error("Update rule error:", error);
      throw error;
    }
  },

  deleteRule: async (
    projectId: string,
    ruleId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(`/projects/${projectId}/inbox/rules/${ruleId}`);

      const status = response.status;
      if (status === 204 || status === 200) {
        return { success: true, message: "Rule deleted successfully" };
      }

      return (
        response.data || {
          success: true,
          message: "Rule deleted successfully",
        }
      );
    } catch (error) {
      console.error("Delete rule error:", error);
      throw error;
    }
  },

  // Task Email Integration
  sendCommentAsEmail: async (
    taskId: string,
    commentId: string
  ): Promise<{
    success: boolean;
    messageId: string;
    recipients: string[];
  }> => {
    if (!isValidId(taskId) || !isValidId(commentId)) {
      throw new Error("Invalid taskId or commentId");
    }
    try {
      const response = await api.post<{
        success: boolean;
        messageId: string;
        recipients: string[];
      }>(`/tasks/${taskId}/comments/${commentId}/send-email`);
      return response.data;
    } catch (error) {
      console.error("Send comment as email error:", error);
      throw error;
    }
  },

  // Utility functions for inbox management
  getInboxStatusColor: (isActive: boolean): string => {
    return isActive ? "#22c55e" : "#6b7280"; // green for active, gray for inactive
  },

  getMessageStatusLabel: (status: string): string => {
    switch (status) {
      case "PENDING":
        return "Pending";
      case "PROCESSING":
        return "Processing";
      case "CONVERTED":
        return "Converted";
      case "IGNORED":
        return "Ignored";
      case "FAILED":
        return "Failed";
      default:
        return "Unknown";
    }
  },

  getMessageStatusColor: (status: string): string => {
    switch (status) {
      case "PENDING":
        return "#f59e0b"; // amber
      case "PROCESSING":
        return "#3b82f6"; // blue
      case "CONVERTED":
        return "#22c55e"; // green
      case "IGNORED":
        return "#6b7280"; // gray
      case "FAILED":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  },

  getPriorityLabel: (priority: string): string => {
    switch (priority) {
      case "LOWEST":
        return "Lowest";
      case "LOW":
        return "Low";
      case "MEDIUM":
        return "Medium";
      case "HIGH":
        return "High";
      case "HIGHEST":
        return "Highest";
      default:
        return "Unknown";
    }
  },

  getTaskTypeLabel: (type: string): string => {
    switch (type) {
      case "TASK":
        return "Task";
      case "BUG":
        return "Bug";
      case "EPIC":
        return "Epic";
      case "STORY":
        return "Story";
      case "SUBTASK":
        return "Subtask";
      default:
        return "Unknown";
    }
  },

  // Email provider detection
  detectEmailProvider: (emailAddress: string): string | null => {
    const domain = emailAddress.split("@")[1]?.toLowerCase();

    const providers: Record<string, string> = {
      "gmail.com": "Gmail",
      "outlook.com": "Outlook",
      "hotmail.com": "Outlook",
      "yahoo.com": "Yahoo",
      "icloud.com": "iCloud",
      "protonmail.com": "ProtonMail",
    };

    return providers[domain] || null;
  },

  // Validation helper
  validateEmailAddress: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Format email list for display
  formatEmailList: (emails: string[]): string => {
    if (emails.length === 0) return "No recipients";
    if (emails.length === 1) return emails[0];
    if (emails.length <= 3) return emails.join(", ");
    return `${emails.slice(0, 2).join(", ")} and ${emails.length - 2} more`;
  },
};

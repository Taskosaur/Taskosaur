import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { inboxApi } from "@/utils/api/inboxApi";
import {
  ProjectInbox,
  CreateInboxDto,
  SetupEmailDto,
  InboxMessage,
  InboxRule,
  MessageStatus,
} from "@/types/inbox";

interface InboxState {
  inboxes: ProjectInbox[];
  currentInbox: ProjectInbox | null;
  messages: InboxMessage[];
  rules: InboxRule[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
}

interface InboxContextType extends InboxState {
  // Inbox Management
  createInbox: (projectId: string, data: CreateInboxDto) => Promise<ProjectInbox>;
  getInbox: (projectId: string) => Promise<ProjectInbox>;
  updateInbox: (projectId: string, data: Partial<CreateInboxDto>) => Promise<ProjectInbox>;

  // Email Account Setup
  setupEmailAccount: (projectId: string, data: SetupEmailDto) => Promise<any>;
  testEmailConnection: (
    projectId: string,
    accountId: string
  ) => Promise<{ success: boolean; message: string }>;

  // Email Sync
  triggerSync: (projectId: string) => Promise<{ message: string }>;

  // Messages Management
  getMessages: (
    projectId: string,
    params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) => Promise<InboxMessage[]>;
  convertMessageToTask: (projectId: string, messageId: string) => Promise<any>;

  // Rules Management
  getRules: (projectId: string) => Promise<InboxRule[]>;
  createRule: (projectId: string, data: Partial<InboxRule>) => Promise<InboxRule>;
  updateRule: (projectId: string, ruleId: string, data: Partial<InboxRule>) => Promise<InboxRule>;
  deleteRule: (projectId: string, ruleId: string) => Promise<void>;

  // Task Email Integration
  sendCommentAsEmail: (
    taskId: string,
    commentId: string
  ) => Promise<{
    success: boolean;
    messageId: string;
    recipients: string[];
  }>;

  // State Management
  setCurrentInbox: (inbox: ProjectInbox | null) => void;
  refreshInbox: (projectId: string) => Promise<void>;
  refreshMessages: (
    projectId: string,
    params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) => Promise<void>;
  refreshRules: (projectId: string) => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const useInbox = (): InboxContextType => {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error("useInbox must be used within an InboxProvider");
  }
  return context;
};

interface InboxProviderProps {
  children: React.ReactNode;
}

export function InboxProvider({ children }: InboxProviderProps) {
  const [inboxState, setInboxState] = useState<InboxState>({
    inboxes: [],
    currentInbox: null,
    messages: [],
    rules: [],
    isLoading: false,
    isSyncing: false,
    error: null,
  });

  // Helper to handle API operations with error handling
  const handleApiOperation = useCallback(async function <T>(
    operation: () => Promise<T>,
    loadingState: boolean = true,
    syncingState: boolean = false
  ): Promise<T> {
    try {
      if (loadingState || syncingState) {
        setInboxState((prev) => ({
          ...prev,
          isLoading: loadingState,
          isSyncing: syncingState,
          error: null,
        }));
      }
      const result = await operation();
      if (loadingState || syncingState) {
        setInboxState((prev) => ({
          ...prev,
          isLoading: false,
          isSyncing: false,
        }));
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      setInboxState((prev) => ({
        ...prev,
        isLoading: false,
        isSyncing: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Inbox Management functions
  const createInbox = useCallback(
    async (projectId: string, data: CreateInboxDto): Promise<ProjectInbox> => {
      const result = await handleApiOperation(() => inboxApi.createInbox(projectId, data));
      setInboxState((prev) => ({
        ...prev,
        inboxes: [...prev.inboxes, result],
      }));
      return result;
    },
    [handleApiOperation]
  );

  const getInbox = useCallback(
    async (projectId: string): Promise<ProjectInbox> => {
      const result = await handleApiOperation(() => inboxApi.getInbox(projectId));
      setInboxState((prev) => ({
        ...prev,
        currentInbox: result,
      }));
      return result;
    },
    [handleApiOperation]
  );

  const updateInbox = useCallback(
    async (projectId: string, data: Partial<CreateInboxDto>): Promise<ProjectInbox> => {
      const result = await handleApiOperation(() => inboxApi.updateInbox(projectId, data), false);
      setInboxState((prev) => ({
        ...prev,
        inboxes: prev.inboxes.map((inbox) =>
          inbox.projectId === projectId ? { ...inbox, ...result } : inbox
        ),
        currentInbox:
          prev.currentInbox?.projectId === projectId
            ? { ...prev.currentInbox, ...result }
            : prev.currentInbox,
      }));
      return result;
    },
    [handleApiOperation]
  );

  // Email Account Setup functions
  const setupEmailAccount = useCallback(
    async (projectId: string, data: SetupEmailDto): Promise<any> => {
      return await handleApiOperation(() => inboxApi.setupEmailAccount(projectId, data), false);
    },
    [handleApiOperation]
  );

  const testEmailConnection = useCallback(
    async (
      projectId: string,
      accountId: string
    ): Promise<{ success: boolean; message: string }> => {
      return await handleApiOperation(
        () => inboxApi.testEmailConnection(projectId, accountId),
        false
      );
    },
    [handleApiOperation]
  );

  // Email Sync functions
  const triggerSync = useCallback(
    async (projectId: string): Promise<{ message: string }> => {
      return await handleApiOperation(() => inboxApi.triggerSync(projectId), false, true);
    },
    [handleApiOperation]
  );

  // Messages Management functions
  const getMessages = useCallback(
    async (
      projectId: string,
      params?: {
        status?: string;
        limit?: number;
        offset?: number;
      }
    ): Promise<InboxMessage[]> => {
      const result = await handleApiOperation(() => inboxApi.getMessages(projectId, params));
      setInboxState((prev) => ({ ...prev, messages: result }));
      return result;
    },
    [handleApiOperation]
  );

  const convertMessageToTask = useCallback(
    async (projectId: string, messageId: string): Promise<any> => {
      const result = await handleApiOperation(
        () => inboxApi.convertMessageToTask(projectId, messageId),
        false
      );
      // Update message status to converted
      setInboxState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                status: "CONVERTED" as MessageStatus,
                convertedAt: new Date().toISOString(),
                taskId: result.taskId,
              }
            : msg
        ),
      }));
      return result;
    },
    [handleApiOperation]
  );

  // Rules Management functions
  const getRules = useCallback(
    async (projectId: string): Promise<InboxRule[]> => {
      const result = await handleApiOperation(() => inboxApi.getRules(projectId));
      setInboxState((prev) => ({ ...prev, rules: result }));
      return result;
    },
    [handleApiOperation]
  );

  const createRule = useCallback(
    async (projectId: string, data: Partial<InboxRule>): Promise<InboxRule> => {
      const result = await handleApiOperation(() => inboxApi.createRule(projectId, data), false);
      setInboxState((prev) => ({
        ...prev,
        rules: [...prev.rules, result].sort((a, b) => b.priority - a.priority),
      }));
      return result;
    },
    [handleApiOperation]
  );

  const updateRule = useCallback(
    async (projectId: string, ruleId: string, data: Partial<InboxRule>): Promise<InboxRule> => {
      const result = await handleApiOperation(
        () => inboxApi.updateRule(projectId, ruleId, data),
        false
      );
      setInboxState((prev) => ({
        ...prev,
        rules: prev.rules
          .map((rule) => (rule.id === ruleId ? { ...rule, ...result } : rule))
          .sort((a, b) => b.priority - a.priority),
      }));
      return result;
    },
    [handleApiOperation]
  );

  const deleteRule = useCallback(
    async (projectId: string, ruleId: string): Promise<void> => {
      await handleApiOperation(() => inboxApi.deleteRule(projectId, ruleId), false);
      setInboxState((prev) => ({
        ...prev,
        rules: prev.rules.filter((rule) => rule.id !== ruleId),
      }));
    },
    [handleApiOperation]
  );

  // Task Email Integration functions
  const sendCommentAsEmail = useCallback(
    async (
      taskId: string,
      commentId: string
    ): Promise<{
      success: boolean;
      messageId: string;
      recipients: string[];
    }> => {
      return await handleApiOperation(() => inboxApi.sendCommentAsEmail(taskId, commentId), false);
    },
    [handleApiOperation]
  );

  // State Management functions
  const setCurrentInbox = useCallback((inbox: ProjectInbox | null): void => {
    setInboxState((prev) => ({
      ...prev,
      currentInbox: inbox,
    }));
  }, []);

  const refreshInbox = useCallback(
    async (projectId: string): Promise<void> => {
      const result = await handleApiOperation(() => inboxApi.getInbox(projectId));
      setInboxState((prev) => ({ ...prev, currentInbox: result }));
    },
    [handleApiOperation]
  );

  const refreshMessages = useCallback(
    async (
      projectId: string,
      params?: { status?: string; limit?: number; offset?: number }
    ): Promise<void> => {
      const result = await handleApiOperation(() => inboxApi.getMessages(projectId, params));
      setInboxState((prev) => ({ ...prev, messages: result }));
    },
    [handleApiOperation]
  );

  const refreshRules = useCallback(
    async (projectId: string): Promise<void> => {
      const result = await handleApiOperation(() => inboxApi.getRules(projectId));
      setInboxState((prev) => ({ ...prev, rules: result }));
    },
    [handleApiOperation]
  );

  const clearError = useCallback((): void => {
    setInboxState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearMessages = useCallback((): void => {
    setInboxState((prev) => ({ ...prev, messages: [] }));
  }, []);

  // Create context value with proper memoization
  const contextValue = useMemo(
    () => ({
      // State values
      inboxes: inboxState.inboxes,
      currentInbox: inboxState.currentInbox,
      messages: inboxState.messages,
      rules: inboxState.rules,
      isLoading: inboxState.isLoading,
      isSyncing: inboxState.isSyncing,
      error: inboxState.error,

      // Functions
      createInbox,
      getInbox,
      updateInbox,
      setupEmailAccount,
      testEmailConnection,
      triggerSync,
      getMessages,
      convertMessageToTask,
      getRules,
      createRule,
      updateRule,
      deleteRule,
      sendCommentAsEmail,
      setCurrentInbox,
      refreshInbox,
      refreshMessages,
      refreshRules,
      clearError,
      clearMessages,
    }),
    [
      // Only include primitive state values, not the entire inboxState object
      inboxState.inboxes,
      inboxState.currentInbox,
      inboxState.messages,
      inboxState.rules,
      inboxState.isLoading,
      inboxState.isSyncing,
      inboxState.error,
      // All memoized functions
      createInbox,
      getInbox,
      updateInbox,
      setupEmailAccount,
      testEmailConnection,
      triggerSync,
      getMessages,
      convertMessageToTask,
      getRules,
      createRule,
      updateRule,
      deleteRule,
      sendCommentAsEmail,
      setCurrentInbox,
      refreshInbox,
      refreshMessages,
      refreshRules,
      clearError,
      clearMessages,
    ]
  );

  return <InboxContext.Provider value={contextValue}>{children}</InboxContext.Provider>;
}

export default InboxProvider;

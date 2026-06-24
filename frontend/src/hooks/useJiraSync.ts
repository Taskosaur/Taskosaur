import { useState, useCallback, useMemo } from 'react';
import api from '@/lib/api';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  avatarUrls: Record<string, string>;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

export interface JiraSyncStatus {
  id: string;
  projectId: string | null;
  workspaceId: string | null;
  jiraSiteUrl: string;
  jiraProjectKey: string | null;
  syncEnabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'FAILED' | null;
  lastSyncError: string | null;
  issuesImported: number;
  statusMappings: Record<string, string> | null;
  hasEmail: boolean;
  hasApiToken: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectJiraPayload {
  projectId: string;
  jiraSiteUrl: string;
  jiraProjectKey: string;
  jiraEmail: string;
  jiraApiToken: string;
  syncInterval?: number;
  statusMappings?: Record<string, string>;
}

export interface UpdateJiraSyncPayload {
  syncEnabled?: boolean;
  syncInterval?: number;
  statusMappings?: Record<string, string>;
}

export function useJiraSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  /** Validate credentials and list accessible Jira projects */
  const validateAndListProjects = useCallback(
    async (siteUrl: string, email: string, apiToken: string): Promise<JiraProject[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/jira-sync/validate/projects', {
          jiraSiteUrl: siteUrl,
          jiraEmail: email,
          jiraApiToken: apiToken,
        });
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to validate Jira credentials';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Get statuses for a Jira project before connecting */
  const validateAndListStatuses = useCallback(
    async (
      siteUrl: string,
      projectKey: string,
      email: string,
      apiToken: string,
    ): Promise<JiraStatus[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/jira-sync/validate/statuses', {
          jiraSiteUrl: siteUrl,
          jiraProjectKey: projectKey,
          jiraEmail: email,
          jiraApiToken: apiToken,
        });
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to fetch Jira statuses';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Connect a project to a Jira project */
  const connect = useCallback(async (payload: ConnectJiraPayload): Promise<JiraSyncStatus> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/jira-sync/connect', payload);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect Jira';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get sync status for a project */
  const getStatus = useCallback(async (projectId: string): Promise<JiraSyncStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/jira-sync/${projectId}`);
      return res.data;
    } catch (err: any) {
      if (err?.status === 404) return null;
      const msg = err?.message || 'Failed to get Jira sync status';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /** List statuses using stored credentials */
  const listStatuses = useCallback(async (projectId: string): Promise<JiraStatus[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/jira-sync/${projectId}/statuses`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to list Jira statuses';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Trigger a manual sync */
  const triggerSync = useCallback(async (projectId: string): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/jira-sync/${projectId}/sync`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Jira sync failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Update sync configuration */
  const updateConfig = useCallback(
    async (projectId: string, payload: UpdateJiraSyncPayload): Promise<JiraSyncStatus> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.patch(`/jira-sync/${projectId}`, payload);
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to update Jira config';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Disconnect Jira from a project */
  const disconnect = useCallback(async (projectId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/jira-sync/${projectId}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to disconnect Jira';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Workspace Level Methods ---

  const connectWorkspace = useCallback(
    async (
      workspaceId: string,
      payload: { jiraSiteUrl: string; jiraEmail: string; jiraApiToken: string },
    ): Promise<JiraSyncStatus> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post(`/workspaces/${workspaceId}/jira-sync/connect`, payload);
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to connect Jira workspace';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getWorkspaceStatus = useCallback(
    async (workspaceId: string): Promise<JiraSyncStatus | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/workspaces/${workspaceId}/jira-sync`);
        return res.data;
      } catch (err: any) {
        if (err?.status === 404) return null;
        const msg = err?.message || 'Failed to get Jira workspace status';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const listWorkspaceProjects = useCallback(
    async (workspaceId: string): Promise<JiraProject[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/workspaces/${workspaceId}/jira-sync/projects`);
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to list Jira projects';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getWorkspaceSyncedProjects = useCallback(async (workspaceId: string): Promise<any[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/workspaces/${workspaceId}/jira-sync/synced-projects`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to get synced Jira projects';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const listWorkspaceProjectStatuses = useCallback(
    async (workspaceId: string, projectKey: string): Promise<JiraStatus[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(
          `/workspaces/${workspaceId}/jira-sync/projects/${projectKey}/statuses`,
        );
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to list Jira project statuses';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const importProjectsToWorkspace = useCallback(
    async (
      workspaceId: string,
      projects: (string | { key: string; statusMappings?: Record<string, string> })[],
    ): Promise<any> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post(`/workspaces/${workspaceId}/jira-sync/import`, {
          projects,
        });
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to import Jira projects';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const disconnectWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/workspaces/${workspaceId}/jira-sync`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to disconnect Jira workspace';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncAllWorkspaceProjects = useCallback(async (workspaceId: string): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/workspaces/${workspaceId}/jira-sync/sync-all`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to sync all Jira projects';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkspaceConfig = useCallback(
    async (
      workspaceId: string,
      payload: { jiraSiteUrl: string; jiraEmail: string; jiraApiToken: string },
    ): Promise<JiraSyncStatus> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.patch(`/workspaces/${workspaceId}/jira-sync`, payload);
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to update Jira workspace config';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      loading,
      error,
      clearError,
      validateAndListProjects,
      validateAndListStatuses,
      connect,
      getStatus,
      listStatuses,
      triggerSync,
      updateConfig,
      disconnect,
      connectWorkspace,
      getWorkspaceStatus,
      listWorkspaceProjects,
      getWorkspaceSyncedProjects,
      listWorkspaceProjectStatuses,
      importProjectsToWorkspace,
      disconnectWorkspace,
      syncAllWorkspaceProjects,
      updateWorkspaceConfig,
    }),
    [
      loading,
      error,
      validateAndListProjects,
      validateAndListStatuses,
      connect,
      getStatus,
      listStatuses,
      triggerSync,
      updateConfig,
      disconnect,
      connectWorkspace,
      getWorkspaceStatus,
      listWorkspaceProjects,
      getWorkspaceSyncedProjects,
      listWorkspaceProjectStatuses,
      importProjectsToWorkspace,
      disconnectWorkspace,
      syncAllWorkspaceProjects,
      updateWorkspaceConfig,
    ],
  );

  return contextValue;
}

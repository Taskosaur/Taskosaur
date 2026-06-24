import { useState, useCallback, useMemo } from 'react';
import api from '@/lib/api';

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloSyncStatus {
  id: string;
  projectId: string;
  trelloBoardId: string;
  syncEnabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'FAILED' | null;
  lastSyncError: string | null;
  cardsImported: number;
  statusMappings: Record<string, string> | null;
  hasApiKey: boolean;
  hasToken: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectTrelloPayload {
  projectId: string;
  trelloBoardId: string;
  trelloApiKey: string;
  trelloToken: string;
  syncInterval?: number;
  statusMappings?: Record<string, string>;
}

export interface UpdateTrelloSyncPayload {
  syncEnabled?: boolean;
  syncInterval?: number;
  statusMappings?: Record<string, string>;
}

export function useTrelloSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  /** Validate credentials and get list of accessible boards (no project required) */
  const validateAndListBoards = useCallback(
    async (apiKey: string, token: string): Promise<TrelloBoard[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/trello-sync/validate/boards', { apiKey, token });
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to validate credentials';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Get lists for a board before connecting */
  const validateAndListLists = useCallback(
    async (boardId: string, apiKey: string, token: string): Promise<TrelloList[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/trello-sync/validate/lists', { boardId, apiKey, token });
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to fetch lists';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Connect a project to a Trello board */
  const connect = useCallback(async (payload: ConnectTrelloPayload): Promise<TrelloSyncStatus> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/trello-sync/connect', payload);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect Trello';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get sync status for a project */
  const getStatus = useCallback(async (projectId: string): Promise<TrelloSyncStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/trello-sync/${projectId}`);
      return res.data;
    } catch (err: any) {
      if (err?.status === 404) {
        return null; // Not connected
      }
      const msg = err?.message || 'Failed to get sync status';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /** List boards using stored credentials */
  const listBoards = useCallback(async (projectId: string): Promise<TrelloBoard[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/trello-sync/${projectId}/boards`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to list boards';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** List Trello lists on the connected board */
  const listLists = useCallback(async (projectId: string): Promise<TrelloList[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/trello-sync/${projectId}/lists`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to list Trello lists';
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
      const res = await api.post(`/trello-sync/${projectId}/sync`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Sync failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Update sync configuration */
  const updateConfig = useCallback(
    async (projectId: string, payload: UpdateTrelloSyncPayload): Promise<TrelloSyncStatus> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.patch(`/trello-sync/${projectId}`, payload);
        return res.data;
      } catch (err: any) {
        const msg = err?.message || 'Failed to update config';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Disconnect Trello from a project */
  const disconnect = useCallback(async (projectId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/trello-sync/${projectId}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to disconnect';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Workspace Level Methods ---

  const connectWorkspace = useCallback(async (workspaceId: string, payload: { trelloApiKey: string, trelloToken: string }): Promise<TrelloSyncStatus> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/workspaces/${workspaceId}/trello-sync/connect`, payload);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect Trello Workspace';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getWorkspaceStatus = useCallback(async (workspaceId: string): Promise<TrelloSyncStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/workspaces/${workspaceId}/trello-sync`);
      return res.data;
    } catch (err: any) {
      if (err?.status === 404) return null;
      const msg = err?.message || 'Failed to get sync status';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listWorkspaceBoards = useCallback(async (workspaceId: string): Promise<TrelloBoard[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/workspaces/${workspaceId}/trello-sync/boards`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to list boards';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const importBoardsToWorkspace = useCallback(async (workspaceId: string, boardIds: string[]): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/workspaces/${workspaceId}/trello-sync/import`, { boardIds });
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to import boards';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/workspaces/${workspaceId}/trello-sync`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to disconnect workspace';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkspaceConfig = useCallback(async (workspaceId: string, payload: { trelloApiKey: string, trelloToken: string }): Promise<TrelloSyncStatus> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.patch(`/workspaces/${workspaceId}/trello-sync`, payload);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update workspace config';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getWorkspaceSyncedProjects = useCallback(async (workspaceId: string): Promise<any[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/workspaces/${workspaceId}/trello-sync/projects`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to get synced projects';
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
      const res = await api.post(`/workspaces/${workspaceId}/trello-sync/sync-all`);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to sync all projects';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const contextValue = useMemo(() => ({
    loading,
    error,
    clearError,
    validateAndListBoards,
    validateAndListLists,
    connect,
    getStatus,
    listBoards,
    listLists,
    triggerSync,
    updateConfig,
    disconnect,
    connectWorkspace,
    getWorkspaceStatus,
    listWorkspaceBoards,
    importBoardsToWorkspace,
    disconnectWorkspace,
    updateWorkspaceConfig,
    getWorkspaceSyncedProjects,
    syncAllWorkspaceProjects,
  }), [
    loading,
    error,
    validateAndListBoards,
    validateAndListLists,
    connect,
    getStatus,
    listBoards,
    listLists,
    triggerSync,
    updateConfig,
    disconnect,
  ]);

  return contextValue;
}

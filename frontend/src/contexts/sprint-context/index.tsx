import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { sprintApi } from "@/utils/api/sprintApi";
import { Sprint, CreateSprintData, UpdateSprintData, SprintStatus, SprintStats } from "@/types";

interface SprintState {
  sprints: Sprint[];
  currentSprint: Sprint | null;
  sprintStats: SprintStats | null;
  isLoading: boolean;
  error: string | null;
}

interface SprintContextType extends SprintState {
  // Sprint methods
  listSprints: (
    filters?: {
      slug?: string;
      status?: SprintStatus;
    },
    isAuthenticated?: boolean,
    workspaceSlug?: string
  ) => Promise<Sprint[]>;
  createSprint: (sprintData: CreateSprintData) => Promise<Sprint>;
  getSprintById: (sprintId: string) => Promise<Sprint>;
  getSprintsByProject: (
    slug: string,
    isAuthenticated?: boolean,
    workspaceSlug?: string
  ) => Promise<Sprint[]>;
  getSprintsByStatus: (
    status: SprintStatus,
    isAuthenticated?: boolean,
    workspaceSlug?: string,
    projectSlug?: string
  ) => Promise<Sprint[]>;
  getActiveSprint: (projectId: string) => Promise<Sprint | null>;
  updateSprint: (sprintId: string, sprintData: UpdateSprintData) => Promise<Sprint>;
  deleteSprint: (sprintId: string) => Promise<{ success: boolean; message: string }>;
  startSprint: (sprintId: string) => Promise<Sprint>;
  completeSprint: (sprintId: string) => Promise<Sprint>;
  // Bulk
  bulkUpdateSprints: (sprintIds: string[], updateData: UpdateSprintData) => Promise<Sprint[]>;
  bulkDeleteSprints: (sprintIds: string[]) => Promise<void>;
  // State management
  setCurrentSprint: (sprint: Sprint | null) => void;
  refreshSprints: (
    filters?: {
      slug?: string;
      status?: SprintStatus;
    },
    isAuthenticated?: boolean,
    workspaceSlug?: string
  ) => Promise<void>;
  clearError: () => void;
}

const SprintContext = createContext<SprintContextType | undefined>(undefined);

export const useSprint = (): SprintContextType => {
  const context = useContext(SprintContext);
  if (!context) {
    throw new Error("useSprint must be used within a SprintProvider");
  }
  return context;
};

interface SprintProviderProps {
  children: React.ReactNode;
}

export function SprintProvider({ children }: SprintProviderProps) {
  const [sprintState, setSprintState] = useState<SprintState>({
    sprints: [],
    currentSprint: null,
    sprintStats: null,
    isLoading: false,
    error: null,
  });

  // Helper to handle API operations with error handling
  const handleApiOperation = useCallback(async function <T>(
    operation: () => Promise<T>,
    loadingState: boolean = true
  ): Promise<T> {
    try {
      if (loadingState) {
        setSprintState((prev) => ({ ...prev, isLoading: true, error: null }));
      }
      const result = await operation();
      if (loadingState) {
        setSprintState((prev) => ({ ...prev, isLoading: false }));
      }
      return result;
    } catch (error) {
      const errorMessage = error?.message ? error.message : "An error occurred";
      setSprintState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      ...sprintState,

      listSprints: async (
        filters = {},
        isAuthenticated = true,
        workspaceSlug?: string
      ): Promise<Sprint[]> => {
        const result = await handleApiOperation(() =>
          sprintApi.getSprints(filters, isAuthenticated, workspaceSlug)
        );
        setSprintState((prev) => ({ ...prev, sprints: result }));
        return result;
      },

      createSprint: async (sprintData: CreateSprintData): Promise<Sprint> => {
        const result = await handleApiOperation(() => sprintApi.createSprint(sprintData));
        setSprintState((prev) => ({
          ...prev,
          sprints: [...prev.sprints, result],
        }));
        return result;
      },

      getSprintById: async (sprintId: string): Promise<Sprint> => {
        const result = await handleApiOperation(() => sprintApi.getSprintById(sprintId), false);
        setSprintState((prev) => ({
          ...prev,
          currentSprint: prev.currentSprint?.id === sprintId ? result : prev.currentSprint,
        }));
        return result;
      },

      getSprintsByProject: async (
        slug: string,
        isAuthenticated = true,
        workspaceSlug?: string
      ): Promise<Sprint[]> => {
        const result = await handleApiOperation(() =>
          sprintApi.getSprintsByProject(slug, isAuthenticated, workspaceSlug)
        );
        setSprintState((prev) => ({ ...prev, sprints: result }));
        return result;
      },

      getSprintsByStatus: async (
        status: SprintStatus,
        isAuthenticated = true,
        workspaceSlug?: string,
        projectSlug?: string
      ): Promise<Sprint[]> => {
        const result = await handleApiOperation(() =>
          sprintApi.getSprintsByStatus(status, isAuthenticated, workspaceSlug, projectSlug)
        );
        setSprintState((prev) => ({ ...prev, sprints: result }));
        return result;
      },

      getActiveSprint: async (projectId: string): Promise<Sprint | null> => {
        return await handleApiOperation(() => sprintApi.getActiveSprint(projectId), false);
      },

      updateSprint: async (sprintId: string, sprintData: UpdateSprintData): Promise<Sprint> => {
        // Remove projectId from update payload if present (ignore TS error if not present)
        const { projectId, ...updateData } = sprintData as any;
        const result = await handleApiOperation(
          () => sprintApi.updateSprint(sprintId, updateData),
          false
        );
        setSprintState((prev) => ({
          ...prev,
          sprints: prev.sprints.map((sprint) =>
            sprint.id === sprintId ? { ...sprint, ...result } : sprint
          ),
          currentSprint:
            prev.currentSprint?.id === sprintId
              ? { ...prev.currentSprint, ...result }
              : prev.currentSprint,
        }));
        return result;
      },

      deleteSprint: async (sprintId: string): Promise<{ success: boolean; message: string }> => {
        const result = await handleApiOperation(() => sprintApi.deleteSprint(sprintId), false);
        setSprintState((prev) => ({
          ...prev,
          sprints: prev.sprints.filter((sprint) => sprint.id !== sprintId),
          currentSprint: prev.currentSprint?.id === sprintId ? null : prev.currentSprint,
        }));
        return result;
      },

      startSprint: async (sprintId: string): Promise<Sprint> => {
        const result = await handleApiOperation(() => sprintApi.startSprint(sprintId), false);
        setSprintState((prev) => ({
          ...prev,
          sprints: prev.sprints.map((sprint) =>
            sprint.id === sprintId ? { ...sprint, ...result } : sprint
          ),
          currentSprint:
            prev.currentSprint?.id === sprintId
              ? { ...prev.currentSprint, ...result }
              : prev.currentSprint,
        }));
        return result;
      },

      completeSprint: async (sprintId: string): Promise<Sprint> => {
        const result = await handleApiOperation(() => sprintApi.completeSprint(sprintId), false);
        setSprintState((prev) => ({
          ...prev,
          sprints: prev.sprints.map((sprint) =>
            sprint.id === sprintId ? { ...sprint, ...result } : sprint
          ),
          currentSprint:
            prev.currentSprint?.id === sprintId
              ? { ...prev.currentSprint, ...result }
              : prev.currentSprint,
        }));
        return result;
      },

      bulkUpdateSprints: async (
        sprintIds: string[],
        updateData: UpdateSprintData
      ): Promise<Sprint[]> => {
        const result = await handleApiOperation(
          () => sprintApi.bulkUpdateSprints(sprintIds, updateData),
          false
        );
        setSprintState((prev) => ({
          ...prev,
          sprints: prev.sprints.map((sprint) =>
            sprintIds.includes(sprint.id)
              ? { ...sprint, ...result.find((r) => r.id === sprint.id) }
              : sprint
          ),
        }));
        return result;
      },

      bulkDeleteSprints: async (sprintIds: string[]): Promise<void> => {
        await handleApiOperation(() => sprintApi.bulkDeleteSprints(sprintIds), false);
        setSprintState((prev) => ({
          ...prev,
          sprints: prev.sprints.filter((sprint) => !sprintIds.includes(sprint.id)),
          currentSprint: sprintIds.includes(prev.currentSprint?.id || "")
            ? null
            : prev.currentSprint,
        }));
      },

      setCurrentSprint: (sprint: Sprint | null): void => {
        setSprintState((prev) => ({ ...prev, currentSprint: sprint }));
      },

      refreshSprints: async (
        filters = {},
        isAuthenticated = true,
        workspaceSlug?: string
      ): Promise<void> => {
        await contextValue.listSprints(filters, isAuthenticated, workspaceSlug);
      },

      clearError: (): void => {
        setSprintState((prev) => ({ ...prev, error: null }));
      },
    }),
    [sprintState, handleApiOperation]
  );

  return <SprintContext.Provider value={contextValue}>{children}</SprintContext.Provider>;
}

export default SprintProvider;

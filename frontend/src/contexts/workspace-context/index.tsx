import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { workspaceApi } from "@/utils/api/workspaceApi";
import {
  Workspace,
  WorkspaceData,
  WorkspaceMember,
  AddMemberToWorkspaceData,
  InviteMemberToWorkspaceData,
  UpdateMemberRoleData,
  WorkspaceStats,
  WorkspaceRole,
  CreateWorkspaceData,
  GetWorkspaceActivityParams,
  WorkspaceActivityResponse,
  WorkspaceChartType,
} from "@/types";

interface AnalyticsData {
  projectStatus: any[];
  taskPriority: any[];
  kpiMetrics: any;
  taskType: any[];
  sprintStatus: any[];
  monthlyCompletion: any[];
}
interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspaceMembers: WorkspaceMember[];
  workspaceStats: WorkspaceStats | null;
  isLoading: boolean;
  error: string | null;
  analyticsData: AnalyticsData | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  refreshingAnalytics: boolean;
  workspaceRole: WorkspaceRole | null;
}

interface WorkspaceContextType extends WorkspaceState {
  // Workspace methods
  createWorkspace: (workspaceData: WorkspaceData) => Promise<Workspace>;
  getWorkspaces: () => Promise<Workspace[]>;
  getWorkspacesByOrganization: (organizationId?: string, search?: string) => Promise<Workspace[]>;
  getWorkspaceById: (workspaceId: string) => Promise<Workspace>;
  getWorkspaceBySlug: (slug: string, organizationId?: string) => Promise<Workspace>;
  updateWorkspace: (
    workspaceId: string,
    workspaceData: Partial<WorkspaceData>
  ) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string) => Promise<{ success: boolean; message: string }>;
  archiveWorkspace: (workspaceId: string) => Promise<{ success: boolean; message: string }>;

  // Workspace member methods
  getWorkspaceMembers: (
    workspaceId: string,
    search?: string,
    page?: number,
    limit?: number
  ) => Promise<{ data: WorkspaceMember[]; total: number; page: number }>;
  addMemberToWorkspace: (memberData: AddMemberToWorkspaceData) => Promise<WorkspaceMember>;
  inviteMemberToWorkspace: (inviteData: InviteMemberToWorkspaceData) => Promise<any>;
  updateMemberRole: (
    memberId: string,
    updateData: UpdateMemberRoleData,
    requestUserId: string
  ) => Promise<WorkspaceMember>;
  removeMemberFromWorkspace: (
    memberId: string,
    requestUserId: string
  ) => Promise<{ success: boolean; message: string }>;

  // Stats and utility methods
  getWorkspaceStats: (workspaceId: string) => Promise<WorkspaceStats>;

  // State management
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspaces: (organizationId?: string) => Promise<void>;
  clearError: () => void;

  // Helper methods
  isUserWorkspaceMember: (workspaceId: string, userId: string) => boolean;
  getUserWorkspaceRole: (workspaceId: string, userId: string) => WorkspaceRole | null;
  getCurrentOrganizationId: () => string | null;
  getWorkspaceRecentActivity: (
    workspaceId: string,
    params?: GetWorkspaceActivityParams
  ) => Promise<WorkspaceActivityResponse>;
  fetchAnalyticsData: (organizationId: string, workspaceSlug: string) => Promise<void>;
  workspaceRoleSet: (workspace: Workspace) => Promise<void>;

  clearAnalyticsError: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};

// For backward compatibility
export const useWorkspaceContext = useWorkspace;

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    workspaces: [],
    currentWorkspace: null,
    workspaceMembers: [],
    workspaceStats: null,
    isLoading: false,
    error: null,
    analyticsData: null,
    analyticsLoading: false,
    analyticsError: null,
    refreshingAnalytics: false,
    workspaceRole: null,
  });

  // Helper to handle API operations with error handling
  const handleApiOperation = useCallback(async function <T>(
    operation: () => Promise<T>,
    loadingState: boolean = true
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      if (loadingState) {
        setWorkspaceState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));
      }

      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("Operation timed out"))
          );
        }),
      ]);

      clearTimeout(timeoutId);

      if (loadingState) {
        setWorkspaceState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
        }));
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";

      setWorkspaceState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        // Clear current workspace on critical errors
        currentWorkspace: errorMessage.includes("not found") ? null : prev.currentWorkspace,
      }));
      throw error;
    }
  }, []);
  const workspaceRoleSet = (workspace: Workspace): Promise<void> => {
    return new Promise((resolve) => {
      setWorkspaceState((prev) => ({
        ...prev,
        workspaceRole: workspace.members?.[0]?.role || null,
      }));
      resolve();
    });
  };
  const fetchAnalyticsData = useCallback(
    async (organizationId: string, workspaceSlug: string): Promise<void> => {
      try {
        setWorkspaceState((prev) => ({
          ...prev,
          analyticsLoading: true,
          analyticsError: null,
          refreshingAnalytics: true,
        }));

        const results = await workspaceApi.getAllCharts(organizationId, workspaceSlug);

        // Process each chart with individual error handling
        const processChartData = (data: any, chartName: string) => {
          if (!data) {
            console.warn(`No data received for ${chartName}`);
            return null;
          }
          if (data.error) {
            console.error(`Error loading ${chartName}:`, data.error);
            return null;
          }
          return data;
        };

        const analyticsData = {
          projectStatus: processChartData(
            results[WorkspaceChartType.PROJECT_STATUS],
            "Project Status"
          ),
          taskPriority: processChartData(
            results[WorkspaceChartType.TASK_PRIORITY],
            "Task Priority"
          ),
          kpiMetrics: processChartData(results[WorkspaceChartType.KPI_METRICS], "KPI Metrics"),
          taskType: processChartData(results[WorkspaceChartType.TASK_TYPE], "Task Type"),
          sprintStatus: processChartData(
            results[WorkspaceChartType.SPRINT_STATUS],
            "Sprint Status"
          ),
          monthlyCompletion: processChartData(
            results[WorkspaceChartType.MONTHLY_COMPLETION],
            "Monthly Completion"
          ),
        };

        setWorkspaceState((prev) => ({
          ...prev,
          analyticsData,
          analyticsLoading: false,
          refreshingAnalytics: false,
        }));
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        const errorMessage = err?.message ? err.message : "Failed to load workspace analytics data";

        setWorkspaceState((prev) => ({
          ...prev,
          analyticsLoading: false,
          refreshingAnalytics: false,
          analyticsError: errorMessage,
        }));
      }
    },
    []
  );

  const getCurrentOrganizationId = useCallback((): string | null => {
    return workspaceApi.getCurrentOrganization();
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      ...workspaceState,

      // Workspace methods with state management
      createWorkspace: async (workspaceData: WorkspaceData): Promise<Workspace> => {
        const organizationId = getCurrentOrganizationId();
        if (!organizationId) {
          throw new Error("No organization selected. Please select an organization first.");
        }

        const createData: CreateWorkspaceData = {
          ...workspaceData,
          organizationId,
        };

        const result = await handleApiOperation(() => workspaceApi.createWorkspace(createData));

        // Add new workspace to state and clear cache
        setWorkspaceState((prev) => ({
          ...prev,
          workspaces: [...prev.workspaces, result],
        }));

        return result;
      },

      getWorkspaces: async (): Promise<Workspace[]> => {
        // Use organization context if available for better permission handling
        const orgId = getCurrentOrganizationId();

        const result = await handleApiOperation(() =>
          orgId ? workspaceApi.getWorkspacesByOrganization(orgId) : workspaceApi.getWorkspaces()
        );

        setWorkspaceState((prev) => ({
          ...prev,
          workspaces: result,
        }));

        return result;
      },

      archiveWorkspace: async (
        workspaceId: string
      ): Promise<{ success: boolean; message: string }> => {
        const result = await handleApiOperation(() => workspaceApi.archiveWorkspace(workspaceId));

        if (result.success) {
          const orgId = getCurrentOrganizationId();
          if (orgId) {
            await contextValue.getWorkspacesByOrganization(orgId);
          } else {
            console.warn("No organization ID available for workspace refresh");
          }
        }

        return result;
      },

      getWorkspacesByOrganization: async (
        organizationId?: string,
        search?: string
      ): Promise<Workspace[]> => {
        const orgId = organizationId || getCurrentOrganizationId();
        if (!orgId) {
          console.error("No organization selected. Please select an organization first.");
          return;
        }

        const result = await handleApiOperation(() =>
          workspaceApi.getWorkspacesByOrganization(orgId, search)
        );

        setWorkspaceState((prev) => ({
          ...prev,
          workspaces: result,
        }));

        return result;
      },

      getWorkspaceById: async (workspaceId: string): Promise<Workspace> => {
        const result = await handleApiOperation(
          () => workspaceApi.getWorkspaceById(workspaceId),
          false
        );

        // Update current workspace if it's the same ID
        setWorkspaceState((prev) => ({
          ...prev,
          currentWorkspace:
            prev.currentWorkspace?.id === workspaceId ? result : prev.currentWorkspace,
        }));

        return result;
      },

      getWorkspaceBySlug: async (slug: string, organizationId?: string): Promise<Workspace> => {
        const orgId = organizationId || getCurrentOrganizationId();
        if (!orgId) {
          throw new Error("No organization selected. Please select an organization first.");
        }

        try {
          const result = await handleApiOperation(
            () => workspaceApi.getWorkspaceBySlug(slug, orgId),
            false
          );

          // Update workspace in state if found
          if (result) {
            setWorkspaceState((prev) => ({
              ...prev,
              currentWorkspace: result,
              error: null,
            }));
          }

          return result;
        } catch (error) {
          // Set error state and clear current workspace on 404
          if (error instanceof Error && error.message.includes("not found")) {
            setWorkspaceState((prev) => ({
              ...prev,
              currentWorkspace: null,
              error: "Workspace not found",
            }));
          }
          throw error;
        }
      },

      updateWorkspace: async (
        workspaceId: string,
        workspaceData: Partial<WorkspaceData>
      ): Promise<Workspace> => {
        const result = await handleApiOperation(
          () => workspaceApi.updateWorkspace(workspaceId, workspaceData),
          false
        );

        // Update workspace in state
        setWorkspaceState((prev) => ({
          ...prev,
          workspaces: prev.workspaces.map((workspace) =>
            workspace.id === workspaceId ? { ...workspace, ...result } : workspace
          ),
          currentWorkspace:
            prev.currentWorkspace?.id === workspaceId
              ? { ...prev.currentWorkspace, ...result }
              : prev.currentWorkspace,
        }));

        return result;
      },

      deleteWorkspace: async (
        workspaceId: string
      ): Promise<{ success: boolean; message: string }> => {
        const result = await handleApiOperation(
          () => workspaceApi.deleteWorkspace(workspaceId),
          false
        );

        // Remove workspace from state
        setWorkspaceState((prev) => ({
          ...prev,
          workspaces: prev.workspaces.filter((workspace) => workspace.id !== workspaceId),
          currentWorkspace:
            prev.currentWorkspace?.id === workspaceId ? null : prev.currentWorkspace,
        }));

        return result;
      },

      // Workspace member methods
      getWorkspaceMembers: async (
        workspaceId: string,
        search?: string,
        page?: number,
        limit?: number
      ): Promise<{ data: WorkspaceMember[]; total: number; page: number }> => {
        const result = await handleApiOperation(
          () => workspaceApi.getWorkspaceMembers(workspaceId, search, page, limit),
          false
        );

        setWorkspaceState((prev) => ({
          ...prev,
          workspaceMembers: result.data,
        }));

        return result;
      },

      addMemberToWorkspace: async (
        memberData: AddMemberToWorkspaceData
      ): Promise<WorkspaceMember> => {
        const result = await handleApiOperation(
          () => workspaceApi.addMemberToWorkspace(memberData),
          false
        );

        // Add new member to state if it's for the current workspace's members
        if (
          workspaceState.workspaceMembers.length > 0 &&
          workspaceState.workspaceMembers.some((m) => m.workspaceId === memberData.workspaceId)
        ) {
          setWorkspaceState((prev) => ({
            ...prev,
            workspaceMembers: [...prev.workspaceMembers, result],
          }));
        }

        return result;
      },

      inviteMemberToWorkspace: (inviteData: InviteMemberToWorkspaceData): Promise<any> =>
        handleApiOperation(() => workspaceApi.inviteMemberToWorkspace(inviteData), false),

      updateMemberRole: async (
        memberId: string,
        updateData: UpdateMemberRoleData,
        requestUserId: string
      ): Promise<WorkspaceMember> => {
        const result = await handleApiOperation(
          () => workspaceApi.updateMemberRole(memberId, updateData, requestUserId),
          false
        );

        // Update member in state
        setWorkspaceState((prev) => ({
          ...prev,
          workspaceMembers: prev.workspaceMembers.map((member) =>
            member.id === memberId ? { ...member, ...result } : member
          ),
        }));

        return result;
      },

      removeMemberFromWorkspace: async (
        memberId: string,
        requestUserId: string
      ): Promise<{ success: boolean; message: string }> => {
        const result = await handleApiOperation(
          () => workspaceApi.removeMemberFromWorkspace(memberId, requestUserId),
          false
        );

        // Remove member from state
        setWorkspaceState((prev) => ({
          ...prev,
          workspaceMembers: prev.workspaceMembers.filter((member) => member.id !== memberId),
        }));

        return result;
      },

      // Stats and utility methods
      getWorkspaceStats: async (workspaceId: string): Promise<WorkspaceStats> => {
        const result = await handleApiOperation(
          () => workspaceApi.getWorkspaceStats(workspaceId),
          false
        );

        setWorkspaceState((prev) => ({
          ...prev,
          workspaceStats: result,
        }));

        return result;
      },

      // State management methods
      setCurrentWorkspace: (workspace: Workspace | null): void => {
        setWorkspaceState((prev) => ({ ...prev, currentWorkspace: workspace }));
      },

      refreshWorkspaces: async (organizationId?: string): Promise<void> => {
        if (organizationId) {
          // Clear cache first

          await contextValue.getWorkspacesByOrganization(organizationId);
        } else {
          await contextValue.getWorkspaces();
        }
      },

      clearError: (): void => {
        setWorkspaceState((prev) => ({ ...prev, error: null }));
      },

      // Helper methods
      isUserWorkspaceMember: (workspaceId: string, userId: string): boolean => {
        return workspaceState.workspaceMembers.some(
          (member) => member.workspaceId === workspaceId && member.userId === userId
        );
      },

      getUserWorkspaceRole: (workspaceId: string, userId: string): WorkspaceRole | null => {
        const member = workspaceState.workspaceMembers.find(
          (member) => member.workspaceId === workspaceId && member.userId === userId
        );
        return member?.role || null;
      },

      getCurrentOrganizationId,
      getWorkspaceRecentActivity: async (
        workspaceId: string,
        params: GetWorkspaceActivityParams = {}
      ): Promise<WorkspaceActivityResponse> => {
        return await handleApiOperation(
          () => workspaceApi.getWorkspaceRecentActivity(workspaceId, params),
          false
        );
      },
      fetchAnalyticsData,
      workspaceRoleSet,
      clearAnalyticsError: (): void => {
        setWorkspaceState((prev) => ({ ...prev, analyticsError: null }));
      },
    }),
    [workspaceState, handleApiOperation, getCurrentOrganizationId]
  );

  return <WorkspaceContext.Provider value={contextValue}>{children}</WorkspaceContext.Provider>;
}

export default WorkspaceProvider;

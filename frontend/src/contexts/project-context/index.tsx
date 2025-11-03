import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { projectApi } from "@/utils/api/projectApi";

import { taskStatusApi } from "@/utils/api/taskStatusApi";
import {
  Project,
  ProjectData,
  ProjectMember,
  InviteMemberData,
  AddMemberData,
  OrganizationMember,
  ProjectStats,
  CreateTaskStatusFromProjectDto,
  UpdateTaskStatusDto,
  TaskStatus,
  ProjectChartType,
} from "@/types";

interface AnalyticsData {
  taskStatus: any[];
  taskType: any[];
  kpiMetrics: any;
  taskPriority: any[];
  sprintVelocity: any[];
}
interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  projectMembers: ProjectMember[];
  organizationMembers: OrganizationMember[];
  projectStats: ProjectStats | null;
  isLoading: boolean;
  error: string | null;
  analyticsData: AnalyticsData | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  refreshingAnalytics: boolean;
}

interface ProjectContextType extends ProjectState {
  // Project methods
  listProjects: () => Promise<Project[]>;
  createProject: (projectData: ProjectData) => Promise<Project>;
  getProjectById: (projectId: string) => Promise<Project>;
  getProjectsByWorkspace: (
    workspaceId: string,
    filters?: {
      status?: string;
      priority?: string;
      page?: number;
      pageSize?: number;
      search?: string;
    }
  ) => Promise<Project[]>;
  getProjectBySlug: (
    slug: string,
    isAuthenticated: boolean,
    workspaceSlug?: string
  ) => Promise<Project>;
  archiveProject: (projectId: string) => Promise<{ success: boolean; message: string }>;
  getProjectsByOrganization: (
    organizationId: string,
    filters?: {
      workspaceId?: string;
      status?: string;
      priority?: string;
      page?: number;
      pageSize?: number;
      search?: string;
    }
  ) => Promise<Project[]>;

  updateProject: (projectId: string, projectData: Partial<ProjectData>) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<{ success: boolean; message: string }>;
  getProjectsByUserId: (userId: string) => Promise<Project[]>;

  // Project member methods
  inviteMemberToProject: (inviteData: InviteMemberData) => Promise<ProjectMember>;
  addMemberToProject: (memberData: AddMemberData) => Promise<ProjectMember>;
  getProjectMembers: (projectId: string, search?: string) => Promise<ProjectMember[]>;
  getProjectMembersPagination: (
    projectId: string,
    search?: string,
    page?: number,
    limit?: number
  ) => Promise<{ data: ProjectMember[]; total: number; page: number }>;
  getOrganizationMembers: (
    organizationId: string,
    search?: string
  ) => Promise<OrganizationMember[]>;
  getProjectMembersByWorkspace: (workspaceId: string) => Promise<ProjectMember[]>;
  updateProjectMemberRole: (
    memberId: string,
    requestUserId: string,
    role: string
  ) => Promise<ProjectMember>;
  removeProjectMember: (
    memberId: string,
    requestUserId: string
  ) => Promise<{ success: boolean; message: string }>;

  // Stats and utility methods
  getProjectStats: (projectId: string) => Promise<ProjectStats>;

  // State management
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: (workspaceId?: string) => Promise<void>;
  refreshProjectMembers: (projectId: string) => Promise<void>;
  clearError: () => void;

  // Helper methods
  isUserProjectMember: (projectId: string, userId: string) => boolean;
  getProjectMemberRole: (projectId: string, userId: string) => string | null;
  getTaskStatusByProject: (projectId: string) => Promise<TaskStatus[]>;
  createTaskStatusFromProject: (
    taskStatusData: CreateTaskStatusFromProjectDto
  ) => Promise<TaskStatus>;
  deleteTaskStatus: (statusId: string) => Promise<{ success: boolean; message: string }>;
  updateTaskStatus: (statusId: string, taskStatusData: UpdateTaskStatusDto) => Promise<TaskStatus>;
  fetchAnalyticsData: (organizationId: string, isAuthenticated: boolean) => Promise<void>;
  clearAnalyticsError: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};

// For backward compatibility
export const useProjectContext = useProject;

interface ProjectProviderProps {
  children: React.ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectState, setProjectState] = useState<ProjectState>({
    projects: [],
    currentProject: null,
    projectMembers: [],
    organizationMembers: [],
    projectStats: null,
    isLoading: false,
    error: null,
    analyticsData: null,
    analyticsLoading: false,
    analyticsError: null,
    refreshingAnalytics: false,
  });

  // Helper to handle API operations with error handling
  const handleApiOperation = useCallback(async function <T>(
    operation: () => Promise<T>,
    loadingState: boolean = true
  ): Promise<T> {
    try {
      if (loadingState) {
        setProjectState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      const result = await operation();

      if (loadingState) {
        setProjectState((prev) => ({ ...prev, isLoading: false }));
      }

      return result;
    } catch (error) {
      const errorMessage = error.message ? error.message : "An error occurred";
      setProjectState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);
  const fetchAnalyticsData = useCallback(
    async (projectSlug: string, isAuthenticated: boolean): Promise<void> => {
      try {
        setProjectState((prev) => ({
          ...prev,
          analyticsLoading: true,
          analyticsError: null,
          refreshingAnalytics: true,
        }));

        const results = await projectApi.getAllCharts(projectSlug, isAuthenticated);

        // Process each chart and handle individual errors
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
          taskStatus: processChartData(results[ProjectChartType.TASK_STATUS], "Task Status"),
          taskType: processChartData(results[ProjectChartType.TASK_TYPE], "Task Type"),
          kpiMetrics: processChartData(results[ProjectChartType.KPI_METRICS], "KPI Metrics"),
          taskPriority: processChartData(results[ProjectChartType.TASK_PRIORITY], "Task Priority"),
          sprintVelocity: processChartData(
            results[ProjectChartType.SPRINT_VELOCITY],
            "Sprint Velocity"
          ),
        };

        setProjectState((prev) => ({
          ...prev,
          analyticsData,
          analyticsLoading: false,
          refreshingAnalytics: false,
        }));
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        const errorMessage = err?.message ? err.message : "Failed to load project analytics data";

        setProjectState((prev) => ({
          ...prev,
          analyticsLoading: false,
          refreshingAnalytics: false,
          analyticsError: errorMessage,
        }));
      }
    },
    []
  );

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      ...projectState,

      // Project methods with state management
      listProjects: async (): Promise<Project[]> => {
        const result = await handleApiOperation(() => projectApi.listProjects());

        setProjectState((prev) => ({
          ...prev,
          projects: result,
        }));

        return result;
      },

      createProject: async (projectData: ProjectData): Promise<Project> => {
        const result = await handleApiOperation(() => projectApi.createProject(projectData));

        // Add new project to state
        setProjectState((prev) => ({
          ...prev,
          projects: [...prev.projects, result],
        }));

        return result;
      },

      getProjectById: async (projectId: string): Promise<Project> => {
        const result = await handleApiOperation(() => projectApi.getProjectById(projectId), false);

        // Update current project if it's the same ID
        setProjectState((prev) => ({
          ...prev,
          currentProject: prev.currentProject?.id === projectId ? result : prev.currentProject,
        }));

        return result;
      },
      getProjectBySlug: async (
        slug: string,
        isAuthenticated: boolean,
        workspaceSlug?: string
      ): Promise<Project> => {
        const result = await handleApiOperation(
          () => projectApi.getProjectBySlug(slug, isAuthenticated, workspaceSlug),
          false
        );
        // Optionally update currentProject if slug matches
        setProjectState((prev) => ({
          ...prev,
          currentProject: result,
        }));
        return result;
      },
      getProjectsByOrganization: async (
        organizationId: string,
        filters?: {
          workspaceId?: string;
          status?: string;
          priority?: string;
          page?: number;
          pageSize?: number;
          search?: string;
        }
      ): Promise<Project[]> => {
        const result = await handleApiOperation(() =>
          projectApi.getProjectsByOrganization(organizationId, filters)
        );

        setProjectState((prev) => ({
          ...prev,
          projects: result,
        }));

        return result;
      },
      getProjectsByWorkspace: async (
        workspaceId: string,
        filters?: {
          status?: string;
          priority?: string;
          page?: number;
          pageSize?: number;
          search?: string;
        }
      ): Promise<Project[]> => {
        const result = await handleApiOperation(() =>
          projectApi.getProjectsByWorkspace(workspaceId, filters)
        );

        setProjectState((prev) => ({
          ...prev,
          projects: result,
        }));

        return result;
      },

      updateProject: async (
        projectId: string,
        projectData: Partial<ProjectData>
      ): Promise<Project> => {
        const result = await handleApiOperation(
          () => projectApi.updateProject(projectId, projectData),
          false
        );

        // Update project in state
        setProjectState((prev) => ({
          ...prev,
          projects: prev.projects.map((project) =>
            project.id === projectId ? { ...project, ...result } : project
          ),
          currentProject:
            prev.currentProject?.id === projectId
              ? { ...prev.currentProject, ...result }
              : prev.currentProject,
        }));

        return result;
      },

      deleteProject: async (projectId: string): Promise<{ success: boolean; message: string }> => {
        const result = await handleApiOperation(() => projectApi.deleteProject(projectId), false);

        // Remove project from state
        setProjectState((prev) => ({
          ...prev,
          projects: prev.projects.filter((project) => project.id !== projectId),
          currentProject: prev.currentProject?.id === projectId ? null : prev.currentProject,
        }));

        return result;
      },

      getProjectsByUserId: (userId: string): Promise<Project[]> =>
        handleApiOperation(() => projectApi.getProjectsByUserId(userId), false),

      // Project member methods
      inviteMemberToProject: async (inviteData: InviteMemberData): Promise<ProjectMember> => {
        const result = await handleApiOperation(
          () => projectApi.inviteMemberToProject(inviteData),
          false
        );

        // Add new member to state if it's for the current project's members
        if (
          projectState.projectMembers.length > 0 &&
          projectState.projectMembers.some((m) => m.projectId === inviteData.projectId)
        ) {
          setProjectState((prev) => ({
            ...prev,
            projectMembers: [...prev.projectMembers, result],
          }));
        }

        return result;
      },

      addMemberToProject: async (memberData: AddMemberData): Promise<ProjectMember> => {
        const result = await handleApiOperation(
          () => projectApi.addMemberToProject(memberData),
          false
        );

        // Add new member to state if it's for the current project's members
        if (
          projectState.projectMembers.length > 0 &&
          projectState.projectMembers.some((m) => m.projectId === memberData.projectId)
        ) {
          setProjectState((prev) => ({
            ...prev,
            projectMembers: [...prev.projectMembers, result],
          }));
        }

        return result;
      },

      getProjectMembers: async (projectId: string, search?: string): Promise<ProjectMember[]> => {
        const result = await handleApiOperation(
          () => projectApi.getProjectMembers(projectId, search),
          false
        );

        setProjectState((prev) => ({
          ...prev,
          projectMembers: result,
        }));

        return result;
      },
      getProjectMembersPagination: async (
        projectId: string,
        search?: string,
        page?: number,
        limit?: number
      ): Promise<{ data: ProjectMember[]; total: number; page: number }> => {
        const result = await handleApiOperation(
          () => projectApi.getProjectMembersPagination(projectId, search, page, limit),
          false
        );

        setProjectState((prev) => ({
          ...prev,
          projectMembers: result.data,
        }));

        return result;
      },
      getOrganizationMembers: async (
        organizationId: string,
        search?: string
      ): Promise<OrganizationMember[]> => {
        const result = await handleApiOperation(
          () => projectApi.getOrganizationMembers(organizationId, search),
          false
        );

        setProjectState((prev) => ({
          ...prev,
          organizationMembers: result,
        }));

        return result;
      },

      getProjectMembersByWorkspace: (workspaceId: string): Promise<ProjectMember[]> =>
        handleApiOperation(() => projectApi.getProjectMembersByWorkspace(workspaceId), false),

      updateProjectMemberRole: async (
        memberId: string,
        requestUserId: string,
        role: string
      ): Promise<ProjectMember> => {
        const result = await handleApiOperation(
          () => projectApi.updateProjectMemberRole(memberId, requestUserId, role),
          false
        );

        // Update member in state
        setProjectState((prev) => ({
          ...prev,
          projectMembers: prev.projectMembers.map((member) =>
            member.id === memberId ? { ...member, ...result } : member
          ),
        }));

        return result;
      },

      removeProjectMember: async (
        memberId: string,
        requestUserId: string
      ): Promise<{ success: boolean; message: string }> => {
        const result = await handleApiOperation(
          () => projectApi.removeProjectMember(memberId, requestUserId),
          false
        );

        // Remove member from state
        setProjectState((prev) => ({
          ...prev,
          projectMembers: prev.projectMembers.filter((member) => member.id !== memberId),
        }));

        return result;
      },

      // Stats and utility methods
      getProjectStats: async (projectId: string): Promise<ProjectStats> => {
        const result = await handleApiOperation(() => projectApi.getProjectStats(projectId), false);

        setProjectState((prev) => ({
          ...prev,
          projectStats: result,
        }));

        return result;
      },

      // State management methods
      setCurrentProject: (project: Project | null): void => {
        setProjectState((prev) => ({ ...prev, currentProject: project }));
      },

      refreshProjects: async (workspaceId?: string): Promise<void> => {
        if (workspaceId) {
          await contextValue.getProjectsByWorkspace(workspaceId);
        } else {
          await contextValue.listProjects();
        }
      },

      refreshProjectMembers: async (projectId: string): Promise<void> => {
        await contextValue.getProjectMembers(projectId);
      },

      clearError: (): void => {
        setProjectState((prev) => ({ ...prev, error: null }));
      },

      // Helper methods
      isUserProjectMember: (projectId: string, userId: string): boolean => {
        return projectState.projectMembers.some(
          (member) => member.projectId === projectId && member.userId === userId
        );
      },

      getProjectMemberRole: (projectId: string, userId: string): string | null => {
        const member = projectState.projectMembers.find(
          (member) => member.projectId === projectId && member.userId === userId
        );
        return member?.role || null;
      },

      getTaskStatusByProject: async (projectId: string): Promise<TaskStatus[]> => {
        return await taskStatusApi.getTaskStatusByProject(projectId);
      },

      createTaskStatusFromProject: async (
        taskStatusData: CreateTaskStatusFromProjectDto
      ): Promise<TaskStatus> => {
        return await taskStatusApi.createTaskStatusFromProject(taskStatusData);
      },

      deleteTaskStatus: async (
        statusId: string
      ): Promise<{ success: boolean; message: string }> => {
        return await taskStatusApi.deleteTaskStatus(statusId);
      },

      updateTaskStatus: async (
        statusId: string,
        taskStatusData: UpdateTaskStatusDto
      ): Promise<TaskStatus> => {
        return await taskStatusApi.updateTaskStatus(statusId, taskStatusData);
      },
      clearAnalyticsError: (): void => {
        setProjectState((prev) => ({ ...prev, analyticsError: null }));
      },
      fetchAnalyticsData,

      archiveProject: async (projectId: string): Promise<{ success: boolean; message: string }> => {
        return handleApiOperation(async () => {
          const result = await projectApi.archiveProject(projectId);
          return result;
        });
      },
    }),
    [projectState, handleApiOperation, fetchAnalyticsData]
  );

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

export default ProjectProvider;

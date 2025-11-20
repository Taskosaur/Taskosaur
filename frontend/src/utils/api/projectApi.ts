import api from "@/lib/api";
import {
  AddMemberData,
  InviteMemberData,
  OrganizationMember,
  Project,
  ProjectChartDataResponse,
  ProjectChartType,
  ProjectData,
  ProjectMember,
  ProjectStats,
} from "@/types";
import validator from "validator";

// Utility functions for validation
function isValidUUID(id: string) {
  return validator.isUUID(id, 4);
}

function sanitizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') {
    throw new Error('Invalid slug: must be a non-empty string');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) {
    throw new Error('Invalid slug format: contains invalid characters');
  }
  if (slug.includes('..') || slug.includes('//')) {
    throw new Error('Invalid slug: path traversal detected');
  }
  return encodeURIComponent(slug);
}

export const projectApi = {
  // Project CRUD operations
  listProjects: async (): Promise<Project[]> => {
    try {
      const response = await api.get<Project[]>("/projects");
      return response.data;
    } catch (error) {
      console.error("List projects error:", error);
      throw error;
    }
  },

  createProject: async (projectData: ProjectData): Promise<Project> => {
    try {
      const response = await api.post<Project>("/projects", projectData);
      return response.data;
    } catch (error) {
      console.error("Create project error:", error);
      throw error;
    }
  },

  getProjectById: async (projectId: string): Promise<Project> => {
    try {
      const response = await api.get<Project>(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error("Get project by ID error:", error);
      throw error;
    }
  },

  getProjectBySlug: async (
    slug: string,
    isAuthenticated: boolean,
    workspaceSlug?: string
  ): Promise<Project> => {
    try {
      const sanitizedSlug = sanitizeSlug(slug);
      let response;
      if (isAuthenticated) {
        response = await api.get<Project>(`/projects/by-slug/${sanitizedSlug}`);
      } else {
        const sanitizedWorkspaceSlug = workspaceSlug ? sanitizeSlug(workspaceSlug) : '';
        response = await api.get<Project>(`/public/workspaces/${sanitizedWorkspaceSlug}/projects/${sanitizedSlug}`);
      }
      return response.data;
    } catch (error) {
      console.error("Get project by slug error:", error);
      throw error;
    }
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
    try {
      const params = new URLSearchParams({
        workspaceId,
      });
      if (filters?.status) params.append("status", filters.status);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.pageSize) params.append("pageSize", filters.pageSize.toString());
      if (filters?.search) params.append("search", filters.search.trim());
      const response = await api.get<Project[]>(`/projects?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get projects by workspace error:", error);
      throw error;
    }
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
    try {
      const params = new URLSearchParams({
        organizationId,
      });
      if (filters?.workspaceId) params.append("workspaceId", filters.workspaceId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.pageSize) params.append("pageSize", filters.pageSize.toString());
      if (filters?.search) params.append("search", filters.search.trim());
      const response = await api.get<Project[]>(`/projects/by-organization?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get projects by organization error:", error);
      throw error;
    }
  },

  updateProject: async (projectId: string, projectData: Partial<ProjectData>): Promise<Project> => {
    try {
      const response = await api.patch<Project>(`/projects/${projectId}`, projectData);
      return response.data;
    } catch (error) {
      console.error("Update project error:", error);
      throw error;
    }
  },

  deleteProject: async (projectId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(`/projects/${projectId}`);

      // Handle different response types
      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return { success: true, message: "Project deleted successfully" };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return { success: true, message: "Project deleted successfully" };
    } catch (error) {
      console.error("Delete project error:", error);
      throw error;
    }
  },

  getProjectsByUserId: async (userId: string): Promise<Project[]> => {
    try {
      const response = await api.get<Project[]>(`/project-members/user/${userId}/projects`);
      return response.data;
    } catch (error) {
      console.error("Get projects by user ID error:", error);
      throw error;
    }
  },

  // Project member operations
  inviteMemberToProject: async (inviteData: InviteMemberData): Promise<ProjectMember> => {
    try {
      const response = await api.post<ProjectMember>("/project-members/invite", inviteData);
      return response.data;
    } catch (error) {
      console.error("Invite member to project error:", error);
      throw error;
    }
  },

  addMemberToProject: async (memberData: AddMemberData): Promise<ProjectMember> => {
    try {
      const response = await api.post<ProjectMember>("/project-members", memberData);
      return response.data;
    } catch (error) {
      console.error("Add member to project error:", error);
      throw error;
    }
  },

  getProjectMembers: async (projectId: string, search?: string): Promise<ProjectMember[]> => {
    try {
      const response = await api.get<{ data: ProjectMember[]; total: number }>(
        `/project-members?projectId=${projectId}${
          search ? `&search=${encodeURIComponent(search)}` : ""
        }`
      );
      return response.data.data;
    } catch (error) {
      console.error("Get project members error:", error);
      throw error;
    }
  },
  getProjectMembersPagination: async (
    projectId: string,
    search?: string,
    page?: number,
    limit?: number
  ): Promise<{ data: ProjectMember[]; total: number; page: number }> => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append("projectId", projectId);
      if (search) params.append("search", search);
      if (page) params.append("page", page.toString());
      if (limit) params.append("limit", limit.toString());

      const response = await api.get<{ data: ProjectMember[]; total: number; page: number }>(
        `/project-members?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Get project members error:", error);
      throw error;
    }
  },
  getOrganizationMembers: async (
    organizationId: string,
    search?: string
  ): Promise<OrganizationMember[]> => {
    try {
      const response = await api.get<OrganizationMember[]>(
        `/organization-members?organizationId=${organizationId}${
          search ? `&search=${encodeURIComponent(search)}` : ""
        }`
      );
      return response.data;
    } catch (error) {
      console.error("Get organization members error:", error);
      throw error;
    }
  },

  getProjectMembersByWorkspace: async (workspaceId: string): Promise<ProjectMember[]> => {
    try {
      const response = await api.get<ProjectMember[]>(`/project-members/workspace/${workspaceId}`);
      return response.data;
    } catch (error) {
      console.error("Get project members by workspace error:", error);
      throw error;
    }
  },

  updateProjectMemberRole: async (
    memberId: string,
    requestUserId: string,
    role: string
  ): Promise<ProjectMember> => {
    try {
      const response = await api.patch<ProjectMember>(
        `/project-members/${memberId}?requestUserId=${requestUserId}`,
        { role }
      );
      return response.data;
    } catch (error) {
      console.error("Update project member role error:", error);
      throw error;
    }
  },

  removeProjectMember: async (
    memberId: string,
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(
        `/project-members/${memberId}?requestUserId=${requestUserId}`
      );

      // Handle different response types
      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return {
          success: true,
          message: "Project member removed successfully",
        };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return { success: true, message: "Project member removed successfully" };
    } catch (error) {
      console.error("Remove project member error:", error);
      throw error;
    }
  },
  getMultipleCharts: async (
    projectSlug: string,
    chartTypes: ProjectChartType[],
    isAuthenticated: boolean
  ): Promise<ProjectChartDataResponse> => {
    try {
      const params = new URLSearchParams();
      chartTypes.forEach((type) => params.append("types", type));
      let response;
      if (isAuthenticated) {
        response = await api.get(`/projects/${projectSlug}/charts?${params.toString()}`);
      } else {
        response = await api.get(`/public/workspaces/${projectSlug}/charts?${params.toString()}`);
      }

      return response.data;
    } catch (error) {
      console.error("Get multiple project charts error:", error);
      throw error;
    }
  },
  getSingleChart: async (projectSlug: string, chartType: ProjectChartType): Promise<any> => {
    try {
      const response = await api.get(`/projects/${projectSlug}/charts?types=${chartType}`);
      return response.data[chartType];
    } catch (error) {
      console.error(`Get ${chartType} chart error:`, error);
      throw error;
    }
  },
  getAllCharts: async (
    projectSlug: string,
    isAuthenticated: boolean
  ): Promise<ProjectChartDataResponse> => {
    try {
      const allChartTypes = Object.values(ProjectChartType);
      return await projectApi.getMultipleCharts(projectSlug, allChartTypes, isAuthenticated);
    } catch (error) {
      console.error("Get all project charts error:", error);
      throw error;
    }
  },
  getProjectStats: async (projectId: string): Promise<ProjectStats> => {
    try {
      const response = await api.get<ProjectStats>(`/project-members/project/${projectId}/stats`);
      return response.data;
    } catch (error) {
      console.error("Get project stats error:", error);
      throw error;
    }
  },

  archiveProject: async (projectId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.patch(`/projects/archive/${projectId}`);

      // Handle different response types
      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return { success: true, message: "Project archived successfully" };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return { success: true, message: "Project archived successfully" };
    } catch (error) {
      console.error("Archive project error:", error);
      throw error;
    }
  },
};

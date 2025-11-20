import api from "@/lib/api";
import {
  AddMemberToWorkspaceData,
  CreateWorkspaceData,
  GetWorkspaceActivityParams,
  InviteMemberToWorkspaceData,
  UpdateMemberRoleData,
  Workspace,
  WorkspaceActivityResponse,
  WorkspaceChartDataResponse,
  WorkspaceChartType,
  WorkspaceData,
  WorkspaceMember,
  WorkspaceStats,
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

export const workspaceApi = {
  // Workspace CRUD operations
  createWorkspace: async (workspaceData: CreateWorkspaceData): Promise<Workspace> => {
    try {
      // Generate slug if not provided
      const finalWorkspaceData = {
        ...workspaceData,
        slug:
          workspaceData.slug ||
          workspaceData.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
            .replace(/\s+/g, "-") // Replace spaces with hyphens
            .replace(/-+/g, "-") // Replace multiple hyphens with single
            .trim(),
      };

      const response = await api.post<Workspace>("/workspaces", finalWorkspaceData);
      return response.data;
    } catch (error) {
      console.error("Create workspace error:", error);
      throw error;
    }
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    try {
      const response = await api.get<Workspace[]>("/workspaces");
      return response.data;
    } catch (error) {
      console.error("Get workspaces error:", error);
      throw error;
    }
  },

  getWorkspacesByOrganization: async (
    organizationId: string,
    search?: string
  ): Promise<Workspace[]> => {
    try {
      // Validate organizationId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(organizationId)) {
        throw new Error(`Invalid organizationId format: ${organizationId}. Expected UUID format.`);
      }

      const response = await api.get<Workspace[]>(
        `/workspaces?organizationId=${organizationId}&search=${encodeURIComponent(search || "")}`
      );
      return response.data;
    } catch (error) {
      console.error("Get workspaces by organization error:", error);
      throw error;
    }
  },

  getWorkspaceById: async (workspaceId: string): Promise<Workspace> => {
    try {
      const response = await api.get<Workspace>(`/workspaces/${workspaceId}`);
      return response.data;
    } catch (error) {
      console.error("Get workspace by ID error:", error);
      throw error;
    }
  },

  getWorkspaceBySlug: async (slug: string, organizationId: string): Promise<Workspace> => {
    try {
      const sanitizedSlug = sanitizeSlug(slug);
      if (!isValidUUID(organizationId)) {
        throw new Error('Invalid organizationId: must be a valid UUID');
      }
      const response = await api.get<Workspace>(
        `/workspaces/organization/${organizationId}/slug/${sanitizedSlug}`
      );
      return response.data;
    } catch (error) {
      console.error("Get workspace by slug error:", error);
      throw error;
    }
  },

  updateWorkspace: async (
    workspaceId: string,
    workspaceData: Partial<WorkspaceData>
  ): Promise<Workspace> => {
    try {
      const response = await api.patch<Workspace>(`/workspaces/${workspaceId}`, workspaceData);
      return response.data;
    } catch (error) {
      console.error("Update workspace error:", error);
      throw error;
    }
  },

  deleteWorkspace: async (workspaceId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(`/workspaces/${workspaceId}`);

      // Handle different response types
      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return { success: true, message: "Workspace deleted successfully" };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return { success: true, message: "Workspace deleted successfully" };
    } catch (error) {
      console.error("Delete workspace error:", error);
      throw error;
    }
  },

  // Workspace member operations
  getWorkspaceMembers: async (
    workspaceId: string,
    search?: string,
    page?: number,
    limit?: number
  ): Promise<{ data: WorkspaceMember[]; total: number; page: number }> => {
    try {
      const params = new URLSearchParams();

      if (workspaceId) params.append("workspaceId", workspaceId);
      if (search) params.append("search", search);
      if (page !== undefined) params.append("page", page.toString());
      if (limit !== undefined) params.append("limit", limit.toString());

      const response = await api.get<{ data: WorkspaceMember[]; total: number; page: number }>(
        `/workspace-members?${params.toString()}`
      );

      // Return the paginated data structure safely
      return response.data;
    } catch (error) {
      console.error("Get workspace members error:", error);
      throw error;
    }
  },

  addMemberToWorkspace: async (memberData: AddMemberToWorkspaceData): Promise<WorkspaceMember> => {
    try {
      const response = await api.post<WorkspaceMember>("/workspace-members", memberData);
      return response.data;
    } catch (error) {
      console.error("Add member to workspace error:", error);
      throw error;
    }
  },

  inviteMemberToWorkspace: async (inviteData: InviteMemberToWorkspaceData): Promise<any> => {
    try {
      const response = await api.post("/workspace-members/invite", inviteData);
      return response.data;
    } catch (error) {
      console.error("Invite member to workspace error:", error);
      throw error;
    }
  },

  updateMemberRole: async (
    memberId: string,
    updateData: UpdateMemberRoleData,
    requestUserId: string
  ): Promise<WorkspaceMember> => {
    try {
      const response = await api.patch<WorkspaceMember>(
        `/workspace-members/${memberId}?requestUserId=${requestUserId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      console.error("Update member role error:", error);
      throw error;
    }
  },

  removeMemberFromWorkspace: async (
    memberId: string,
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(
        `/workspace-members/${memberId}?requestUserId=${requestUserId}`
      );

      // Handle different response types
      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return {
          success: true,
          message: "Member removed from workspace successfully",
        };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return {
        success: true,
        message: "Member removed from workspace successfully",
      };
    } catch (error) {
      console.error("Remove member from workspace error:", error);
      throw error;
    }
  },

  getWorkspaceStats: async (workspaceId: string): Promise<WorkspaceStats> => {
    try {
      const response = await api.get<WorkspaceStats>(
        `/workspace-members/workspace/${workspaceId}/stats`
      );
      return response.data;
    } catch (error) {
      console.error("Get workspace stats error:", error);
      throw error;
    }
  },

  // Helper function to get current organization from localStorage
  getCurrentOrganization: (): string | null => {
    try {
      if (typeof window === "undefined") return null;

      const orgId = localStorage.getItem("currentOrganizationId");
      return orgId;
    } catch (error) {
      console.error("Error getting current organization:", error);
      return null;
    }
  },

  getWorkspaceRecentActivity: async (
    workspaceId: string,
    params: GetWorkspaceActivityParams = {}
  ): Promise<WorkspaceActivityResponse> => {
    try {
      const response = await api.get<WorkspaceActivityResponse>(
        `/workspaces/recent/${workspaceId}`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error("Get workspace recent activity error:", error);
      throw error;
    }
  },
  getMultipleCharts: async (
    organizationId: string,
    workspaceSlug: string,
    chartTypes: WorkspaceChartType[]
  ): Promise<WorkspaceChartDataResponse> => {
    try {
      const params = new URLSearchParams();
      chartTypes.forEach((type) => params.append("types", type));

      const response = await api.get(
        `/workspaces/organization/${organizationId}/workspace/${workspaceSlug}/charts?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Get multiple workspace charts error:", error);
      throw error;
    }
  },
  getSingleChart: async (
    organizationId: string,
    workspaceSlug: string,
    chartType: WorkspaceChartType
  ): Promise<any> => {
    try {
      const response = await api.get(
        `/workspaces/organization/${organizationId}/workspace/${workspaceSlug}/charts?types=${chartType}`
      );
      return response.data[chartType];
    } catch (error) {
      console.error(`Get ${chartType} chart error:`, error);
      throw error;
    }
  },
  getAllCharts: async (
    organizationId: string,
    workspaceSlug: string
  ): Promise<WorkspaceChartDataResponse> => {
    try {
      const allChartTypes = Object.values(WorkspaceChartType);
      return await workspaceApi.getMultipleCharts(organizationId, workspaceSlug, allChartTypes);
    } catch (error) {
      console.error("Get all workspace charts error:", error);
      throw error;
    }
  },

  archiveWorkspace: async (workspaceId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.patch(`/workspaces/archive/${workspaceId}`);

      // Handle different response types
      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return { success: true, message: "Workspace archived successfully" };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return { success: true, message: "Workspace archived successfully" };
    } catch (error) {
      console.error("Archive workspace error:", error);
      throw error;
    }
  },
};

import api from "@/lib/api";
import { authApi } from "./authApi";
import {
  ActivityFilters,
  ActivityResponse,
  CreateOrganizationData,
  Organization,
  OrganizationMember,
  OrganizationResponse,
  OrganizationRole,
  OrganizationSettings,
  OrganizationStats,
  UpdateMemberRoleData,
  Workflow,
} from "@/types";

export const organizationApi = {
  getUserOrganizations: async (userId: string): Promise<Organization[]> => {
    try {
      const response = await api.get<OrganizationResponse>(
        `/organization-members/user/${userId}/organizations`
      );

      // Handle different response structures
      let organizationsArray: Organization[] = [];

      if (Array.isArray(response.data)) {
        organizationsArray = response.data;
      } else if (response.data && Array.isArray(response.data.organizations)) {
        organizationsArray = response.data.organizations;
      } else if (response.data && Array.isArray(response.data.data)) {
        organizationsArray = response.data.data;
      } else if (response.data && response.data.organization) {
        organizationsArray = Array.isArray(response.data.organization)
          ? response.data.organization
          : [response.data.organization];
      } else {
        organizationsArray = [];
      }

      return organizationsArray;
    } catch (error) {
      console.error("Get organizations by user error:", error);
      throw error;
    }
  },

  createOrganization: async (organizationData: CreateOrganizationData): Promise<Organization> => {
    try {
      const currentUser = authApi.getCurrentUser();

      if (!currentUser?.id) {
        throw new Error("User not authenticated or user ID not found");
      }

      const defaultSettings: OrganizationSettings = {
        allowInvites: true,
        requireEmailVerification: false,
        defaultRole: OrganizationRole.MEMBER,
        features: {
          timeTracking: true,
          customFields: true,
          automation: true,
          integrations: true,
        },
      };

      const finalOrganizationData = {
        name: organizationData.name.trim(),
        description: organizationData.description?.trim() || "",
        ownerId: currentUser.id,
        settings: organizationData.settings || defaultSettings,
        ...(organizationData.website?.trim() && {
          website: organizationData.website.trim(),
        }),
        ...(organizationData.defaultWorkspace && {
          defaultWorkspace: {
            name: organizationData.defaultWorkspace.name.trim(),
          },
        }),
        ...(organizationData.defaultProject && {
          defaultProject: {
            name: organizationData.defaultProject.name.trim(),
          },
        }),
      };

      const response = await api.post<Organization>("/organizations", finalOrganizationData);

      return response.data;
    } catch (error) {
      console.error("Create organization error:", error);
      throw error;
    }
  },

  getOrganizationById: async (organizationId: string): Promise<Organization> => {
    try {
      const response = await api.get<Organization>(`/organizations/${organizationId}`);
      return response.data;
    } catch (error) {
      console.error("Get organization by ID error:", error);
      throw error;
    }
  },
  getOrganizationBySlug: async (slug: string): Promise<Organization> => {
    try {
      const response = await api.get<Organization>(`/organizations/slug/${slug}`);
      return response.data;
    } catch (error) {
      console.error("Get organization by slug error:", error);
      throw error;
    }
  },
  getOrganizationMembers: async (
    slug: string,
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{
    data: OrganizationMember[];
    total: number;
    page: number;
    roleCounts: {
      OWNER: number;
      MANAGER: number;
      MEMBER: number;
      VIEWER: number;
    };
  }> => {
    try {
      const params = new URLSearchParams({ slug });

      if (page !== undefined) params.append("page", page.toString());
      if (limit !== undefined) params.append("limit", limit.toString());
      if (search) params.append("search", search.trim());

      const response = await api.get<{
        data: OrganizationMember[];
        total: number;
        page: number;
        roleCounts: {
          OWNER: number;
          MANAGER: number;
          MEMBER: number;
          VIEWER: number;
        };
      }>(`/organization-members/slug?${params.toString()}`);

      return response.data;
    } catch (error) {
      console.error("Get organization members by slug error:", error);
      throw error;
    }
  },
  getOrganizationWorkFlows: async (slug: string): Promise<Workflow[]> => {
    try {
      const response = await api.get<Workflow[]>(
        `/workflows/slug?slug=${encodeURIComponent(slug)}`
      );
      return response.data;
    } catch (error) {
      console.error("Get organization members by slug error:", error);
      throw error;
    }
  },

  updateOrganization: async (
    organizationId: string,
    updateData: Partial<CreateOrganizationData>
  ): Promise<Organization> => {
    try {
      const response = await api.patch<Organization>(
        `/organizations/${organizationId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      console.error("Update organization error:", error);
      throw error;
    }
  },

  updatedOrganizationMemberRole: async (
    memberId: string,
    updateData: UpdateMemberRoleData,
    requestUserId: string
  ): Promise<OrganizationMember> => {
    try {
      const response = await api.patch<OrganizationMember>(
        `/organization-members/${memberId}?requestUserId=${requestUserId}`,
        {
          role: updateData.role,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Update organization member role error:", error);
      throw error;
    }
  },

  setDefaultOrganization: async (organizationId: string): Promise<any> => {
    try {
      const response = await api.patch<any>(
        `/organization-members/set-default?organizationId=${organizationId}`
      );
      return response.data;
    } catch (error) {
      console.error("Set default organization error:", error);
      throw error;
    }
  },
  removeOrganizationMember: async (
    memberId: string,
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      await api.delete(`/organization-members/${memberId}?requestUserId=${requestUserId}`);

      return {
        success: true,
        message: "Member removed from organization successfully",
      };
    } catch (error) {
      console.error("Delete organization member error:", error);
      throw error;
    }
  },

  deleteOrganization: async (organizationId: string): Promise<void> => {
    try {
      await api.delete(`/organizations/${organizationId}`);
    } catch (error) {
      console.error("Delete organization error:", error);
      throw error;
    }
  },

  // Helper function to get current organization from localStorage
  getCurrentOrganization: (): Organization | null => {
    try {
      if (typeof window === "undefined") return null;

      const currentOrgId = localStorage.getItem("currentOrganizationId");
      if (!currentOrgId) return null;

      // You might want to cache organizations or fetch from API
      // For now, return null and let the component handle the fetch
      return null;
    } catch (error) {
      console.error("Error getting current organization:", error);
      return null;
    }
  },
  getOrganizationStats: async (organizationId: string): Promise<OrganizationStats> => {
    try {
      // Validate organizationId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(organizationId)) {
        throw new Error(`Invalid organizationId format: ${organizationId}. Expected UUID format.`);
      }

      const response = await api.get<OrganizationStats>(`/organizations/${organizationId}/stats`);
      return response.data;
    } catch (error) {
      console.error("Get organization stats error:", error);
      throw error;
    }
  },

  getOrganizationRecentActivity: async (
    organizationId: string,
    filters: ActivityFilters = {}
  ): Promise<ActivityResponse> => {
    try {
      const params = new URLSearchParams();

      // Add filters as query parameters
      if (filters.limit !== undefined) {
        params.append("limit", Math.min(Math.max(1, filters.limit), 50).toString());
      }

      if (filters.page !== undefined) {
        params.append("page", Math.max(1, filters.page).toString());
      }

      if (filters.entityType) {
        params.append("entityType", filters.entityType);
      }

      if (filters.userId) {
        params.append("userId", filters.userId);
      }
      const response = await api.get(
        `/activity-logs/organization/${organizationId}/recent?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error("Failed to fetch organization activity:", error);
      throw error;
    }
  },

  universalSearch: async (
    query: string,
    organizationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> => {
    try {
      const params = new URLSearchParams({
        q: query,
        organizationId,
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await api.get(`/organizations/universal-search?${params.toString()}`);

      return response.data;
    } catch (error) {
      console.error("Universal search API error:", error);
      throw error;
    }
  },

  showPendingInvitations: async (
    entityType: "organization" | "workspace" | "project",
    entityId: string
  ) => {
    try {
      if (!entityType || !entityId) {
        return new Error("Both entityType and entityId are required");
      }

      const response = await api.get(
        `/invitations/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`
      );
      return response.data;
    } catch (error) {
      console.error("Show pending invitations error:", error);
      throw error;
    }
  },
};

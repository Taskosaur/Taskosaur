import api from "@/lib/api";
import {
  AcceptInvitationResponse,
  CreateInvitationData,
  DeclineInvitationResponse,
  EntityType,
  Invitation,
  InvitationFilters,
  InvitationStatus,
  VerifyInvitationResponse,
} from "@/types";
import validator from "validator";

// Utility functions for validation
function isValidUUID(id: string) {
  return validator.isUUID(id, 4);
}

function sanitizeToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: must be a non-empty string');
  }
  // Tokens should be alphanumeric and may include hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    throw new Error('Invalid token format');
  }
  return encodeURIComponent(token);
}

export const invitationApi = {
  // Updated invitation creation to match backend DTO
  createInvitation: async (invitationData: CreateInvitationData): Promise<Invitation> => {
    try {
      const response = await api.post<Invitation>("/invitations", invitationData);
      return response.data;
    } catch (error) {
      console.error("Create invitation error:", error);
      throw error;
    }
  },

  // Helper function to create invitation with entity type and ID
  createInvitationByEntity: async (
    email: string,
    entityType: EntityType,
    entityId: string,
    role: string
  ): Promise<Invitation> => {
    const invitationData: CreateInvitationData = {
      inviteeEmail: email,
      role,
    };

    // Set the appropriate entity ID based on type
    switch (entityType) {
      case "organization":
        invitationData.organizationId = entityId;
        break;
      case "workspace":
        invitationData.workspaceId = entityId;
        break;
      case "project":
        invitationData.projectId = entityId;
        break;
      default:
        throw new Error(`Invalid entity type: ${entityType}`);
    }

    return invitationApi.createInvitation(invitationData);
  },

  getUserInvitations: async (filters: InvitationFilters = {}): Promise<Invitation[]> => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.entityType) params.append("entityType", filters.entityType);
      if (filters.entityId) params.append("entityId", filters.entityId);

      const response = await api.get<Invitation[]>(`/invitations/user?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Get user invitations error:", error);
      throw error;
    }
  },

  acceptInvitation: async (token: string): Promise<AcceptInvitationResponse> => {
    try {
      const sanitizedToken = sanitizeToken(token);
      const response = await api.patch<AcceptInvitationResponse>(`/invitations/${sanitizedToken}/accept`);
      return response.data;
    } catch (error) {
      console.error("Accept invitation error:", error);
      throw error;
    }
  },

  declineInvitation: async (token: string): Promise<DeclineInvitationResponse> => {
    try {
      const sanitizedToken = sanitizeToken(token);
      const response = await api.patch<DeclineInvitationResponse>(`/invitations/${sanitizedToken}/decline`);
      return response.data;
    } catch (error) {
      console.error("Decline invitation error:", error);
      throw error;
    }
  },

  // Invitation filtering and querying
  getPendingInvitations: async (): Promise<Invitation[]> => {
    try {
      return await invitationApi.getUserInvitations({ status: "PENDING" });
    } catch (error) {
      console.error("Get pending invitations error:", error);
      throw error;
    }
  },

  getOrganizationInvitations: async (organizationId: string): Promise<Invitation[]> => {
    try {
      return await invitationApi.getUserInvitations({
        entityType: "organization",
        entityId: organizationId,
      });
    } catch (error) {
      console.error("Get organization invitations error:", error);
      throw error;
    }
  },

  getWorkspaceInvitations: async (workspaceId: string): Promise<Invitation[]> => {
    try {
      return await invitationApi.getUserInvitations({
        entityType: "workspace",
        entityId: workspaceId,
      });
    } catch (error) {
      console.error("Get workspace invitations error:", error);
      throw error;
    }
  },

  getProjectInvitations: async (projectId: string): Promise<Invitation[]> => {
    try {
      return await invitationApi.getUserInvitations({
        entityType: "project",
        entityId: projectId,
      });
    } catch (error) {
      console.error("Get project invitations error:", error);
      throw error;
    }
  },

  // Status utilities
  getStatusColor: (status: InvitationStatus): string => {
    switch (status) {
      case "PENDING":
        return "#f59e0b"; // yellow
      case "ACCEPTED":
        return "#22c55e"; // green
      case "DECLINED":
        return "#ef4444"; // red
      case "EXPIRED":
        return "#6b7280"; // gray
      default:
        return "#6b7280"; // gray
    }
  },

  getStatusLabel: (status: InvitationStatus): string => {
    switch (status) {
      case "PENDING":
        return "Pending";
      case "ACCEPTED":
        return "Accepted";
      case "DECLINED":
        return "Declined";
      case "EXPIRED":
        return "Expired";
      default:
        return "Unknown";
    }
  },

  getStatusVariant: (status: InvitationStatus): string => {
    switch (status) {
      case "PENDING":
        return "default";
      case "ACCEPTED":
        return "secondary";
      case "DECLINED":
        return "destructive";
      case "EXPIRED":
        return "outline";
      default:
        return "secondary";
    }
  },

  getEntityTypeLabel: (entityType: EntityType): string => {
    switch (entityType) {
      case "organization":
        return "Organization";
      case "workspace":
        return "Workspace";
      case "project":
        return "Project";
      default:
        return "Unknown";
    }
  },

  // Get entity name from invitation
  getEntityName: (invitation: Invitation): string => {
    if (invitation.organization) {
      return invitation.organization.name;
    } else if (invitation.workspace) {
      return invitation.workspace.name;
    } else if (invitation.project) {
      return invitation.project.name;
    }
    return "Unknown";
  },

  // Invitation state checks
  isPending: (invitation: Invitation): boolean => {
    return invitation.status === "PENDING";
  },

  isAccepted: (invitation: Invitation): boolean => {
    return invitation.status === "ACCEPTED";
  },

  isDeclined: (invitation: Invitation): boolean => {
    return invitation.status === "DECLINED";
  },

  isExpired: (invitation: Invitation): boolean => {
    if (invitation.status === "EXPIRED") return true;
    if (invitation.status !== "PENDING") return false;

    const expiresAt = new Date(invitation.expiresAt);
    return expiresAt < new Date();
  },

  canRespond: (invitation: Invitation): boolean => {
    return invitation.status === "PENDING" && !invitationApi.isExpired(invitation);
  },

  // Date formatting utilities
  formatInvitationDate: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  getTimeUntilExpiry: (invitation: Invitation): string => {
    const expiresAt = new Date(invitation.expiresAt);
    const now = new Date();
    const diffInMs = expiresAt.getTime() - now.getTime();

    if (diffInMs < 0) return "Expired";

    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} remaining`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} remaining`;
    } else {
      return "Expiring soon";
    }
  },

  // Bulk operations - updated to use new structure
  bulkCreateInvitations: async (invitations: CreateInvitationData[]): Promise<Invitation[]> => {
    try {
      const createPromises = invitations.map((invitation) =>
        invitationApi.createInvitation(invitation)
      );
      return await Promise.all(createPromises);
    } catch (error) {
      console.error("Bulk create invitations error:", error);
      throw error;
    }
  },

  // Updated validation utilities
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  validateInvitationData: (data: CreateInvitationData): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data.inviteeEmail) {
      errors.push("Email is required");
    } else if (!invitationApi.validateEmail(data.inviteeEmail)) {
      errors.push("Invalid email format");
    }

    // Check that at least one entity ID is provided
    const hasEntity = data.organizationId || data.workspaceId || data.projectId;
    if (!hasEntity) {
      errors.push("At least one entity ID (organization, workspace, or project) is required");
    }

    // Check that only one entity ID is provided
    const entityCount = [data.organizationId, data.workspaceId, data.projectId].filter(
      Boolean
    ).length;
    if (entityCount > 1) {
      errors.push("Only one entity ID should be provided");
    }

    if (!data.role) {
      errors.push("Role is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  // Statistics and counts
  getInvitationStats: (
    invitations: Invitation[]
  ): {
    total: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  } => {
    return {
      total: invitations.length,
      pending: invitations.filter((inv) => inv.status === "PENDING").length,
      accepted: invitations.filter((inv) => inv.status === "ACCEPTED").length,
      declined: invitations.filter((inv) => inv.status === "DECLINED").length,
      expired: invitations.filter((inv) => invitationApi.isExpired(inv)).length,
    };
  },
  verifyInvitation: async (token: string): Promise<VerifyInvitationResponse> => {
    try {
      const sanitizedToken = sanitizeToken(token);
      const response = await api.get<VerifyInvitationResponse>(`/invitations/verify/${sanitizedToken}`);
      return response.data;
    } catch (error: any) {
      console.error("Verify invitation error:", error);

      if (error?.response?.status === 404) {
        throw new Error("Invitation not found");
      }

      if (error?.response?.status === 400) {
        throw new Error(error.response.data?.message || "Invalid invitation");
      }

      throw error;
    }
  },

  resendInvitation: async (
    invitationId: string
  ): Promise<{
    message: string;
    invitation: Invitation;
    emailSent: boolean;
    emailError?: string;
  }> => {
    try {
      const response = await api.post<{
        message: string;
        invitation: Invitation;
        emailSent: boolean;
        emailError?: string;
      }>(`/invitations/${invitationId}/resend`);
      return response.data;
    } catch (error: any) {
      console.error("Resend invitation error:", error);

      if (error?.response?.status === 404) {
        throw new Error("Invitation not found");
      }

      if (error?.response?.status === 400) {
        throw new Error(error.response.data?.message || "Cannot resend this invitation");
      }

      throw error;
    }
  },
  deleteInvitation: async (
    invitationId: string
  ): Promise<{ message: string }> => {
    try {
      const response = await api.delete<{ message: string }>(
        `/invitations/${invitationId}`
      );

      return response.data;
    } catch (error: any) {
      console.error("Delete invitation error:", error);

      if (error?.response?.status === 404) {
        throw new Error("Invitation not found");
      }

      if (error?.response?.status === 400) {
        throw new Error(error.response.data?.message || "Cannot delete this invitation");
      }

      throw error;
    }
  },

};

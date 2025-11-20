import api from "@/lib/api";
import {
  CreateSprintData,
  Sprint,
  SprintFilters,
  SprintStats,
  SprintStatus,
  UpdateSprintData,
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

export const sprintApi = {
  // Sprint CRUD operations
  createSprint: async (sprintData: CreateSprintData): Promise<Sprint> => {
    try {
      const response = await api.post<Sprint>("/sprints", sprintData);
      return response.data;
    } catch (error) {
      console.error("Create sprint error:", error);
      throw error;
    }
  },

  getSprints: async (
    filters: SprintFilters = {},
    isAuthenticated: boolean,
    workspaceSlug?: string
  ): Promise<Sprint[]> => {
    try {
      const params = new URLSearchParams();

      if (filters.slug) params.append("slug", filters.slug);
      if (filters.status) params.append("status", filters.status);

      let response;
      if (isAuthenticated) {
        response = await api.get<Sprint[]>(`/sprints/slug?${params.toString()}`);
      } else {
        if (!workspaceSlug || !filters.slug) {
          throw new Error(
            "workspaceSlug and projectSlug (filters.slug) are required for public access"
          );
        }
        const sanitizedWorkspaceSlug = sanitizeSlug(workspaceSlug);
        const sanitizedProjectSlug = sanitizeSlug(filters.slug);
        response = await api.get<Sprint[]>(
          `/public/workspaces/${sanitizedWorkspaceSlug}/projects/${sanitizedProjectSlug}/sprints`
        );
      }

      return response.data;
    } catch (error) {
      console.error("Get sprints error:", error);
      throw error;
    }
  },

  getSprintById: async (sprintId: string): Promise<Sprint> => {
    try {
      const response = await api.get<Sprint>(`/sprints/${sprintId}`);
      return response.data;
    } catch (error) {
      console.error("Get sprint by ID error:", error);
      throw error;
    }
  },

  getActiveSprint: async (projectId: string): Promise<Sprint | null> => {
    try {
      // Validate projectId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(projectId)) {
        throw new Error(`Invalid projectId format: ${projectId}. Expected UUID format.`);
      }

      const response = await api.get<Sprint>(`/sprints/project/${projectId}/active`);
      return response.data;
    } catch (error) {
      // Return null if no active sprint found (404)
      if (error) {
        return null;
      }
      console.error("Get active sprint error:", error);
      throw error;
    }
  },

  updateSprint: async (sprintId: string, sprintData: UpdateSprintData): Promise<Sprint> => {
    try {
      const response = await api.patch<Sprint>(`/sprints/${sprintId}`, sprintData);
      return response.data;
    } catch (error) {
      console.error("Update sprint error:", error);
      throw error;
    }
  },

  startSprint: async (sprintId: string): Promise<Sprint> => {
    try {
      const response = await api.patch<Sprint>(`/sprints/${sprintId}/start`);
      return response.data;
    } catch (error) {
      console.error("Start sprint error:", error);
      throw error;
    }
  },

  completeSprint: async (sprintId: string): Promise<Sprint> => {
    try {
      const response = await api.patch<Sprint>(`/sprints/${sprintId}/complete`);
      return response.data;
    } catch (error) {
      console.error("Complete sprint error:", error);
      throw error;
    }
  },

  deleteSprint: async (sprintId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.delete(`/sprints/${sprintId}`);

      const contentType = response.headers?.["content-type"] || "";
      const status = response.status;

      if (status === 204 || status === 200) {
        return { success: true, message: "Sprint deleted successfully" };
      }

      if (contentType.includes("application/json") && response.data) {
        return response.data;
      }

      return { success: true, message: "Sprint deleted successfully" };
    } catch (error) {
      console.error("Delete sprint error:", error);
      throw error;
    }
  },

  // Sprint filtering and querying
  getSprintsByProject: async (
    slug: string,
    isAuthenticated: boolean,
    workspaceSlug?: string
  ): Promise<Sprint[]> => {
    try {
      return await sprintApi.getSprints({ slug }, isAuthenticated, workspaceSlug);
    } catch (error) {
      console.error("Get sprints by project error:", error);
      throw error;
    }
  },

  getSprintsByStatus: async (
    status: SprintStatus,
    isAuthenticated: boolean,
    workspaceSlug?: string,
    projectSlug?: string
  ): Promise<Sprint[]> => {
    try {
      return await sprintApi.getSprints(
        { status, slug: projectSlug },
        isAuthenticated,
        workspaceSlug
      );
    } catch (error) {
      console.error("Get sprints by status error:", error);
      throw error;
    }
  },

  // Sprint status utilities
  getStatusColor: (status: SprintStatus): string => {
    switch (status) {
      case "PLANNING":
        return "#6b7280"; // gray
      case "ACTIVE":
        return "#22c55e"; // green
      case "COMPLETED":
        return "#3b82f6"; // blue
      case "CANCELLED":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  },

  getStatusLabel: (status: SprintStatus): string => {
    switch (status) {
      case "PLANNING":
        return "Planning";
      case "ACTIVE":
        return "Active";
      case "COMPLETED":
        return "Completed";
      case "CANCELLED":
        return "Cancelled";
      default:
        return "Unknown";
    }
  },

  getStatusVariant: (status: SprintStatus): string => {
    switch (status) {
      case "PLANNING":
        return "secondary";
      case "ACTIVE":
        return "default";
      case "COMPLETED":
        return "outline";
      case "CANCELLED":
        return "destructive";
      default:
        return "secondary";
    }
  },

  // Sprint calculations and utilities
  calculateSprintStats: (sprint: Sprint): SprintStats => {
    const totalTasks = sprint._count?.tasks || 0;
    const completedTasks = sprint._count?.completedTasks || 0;
    const inProgressTasks = sprint._count?.inProgressTasks || 0;
    const todoTasks = sprint._count?.todoTasks || 0;

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    let daysRemaining: number | undefined;
    let isOverdue = false;

    if (sprint.endDate) {
      const endDate = new Date(sprint.endDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isOverdue = daysRemaining < 0;
    }

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      completionRate: Math.round(completionRate * 100) / 100,
      daysRemaining,
      isOverdue,
    };
  },

  isSprintActive: (sprint: Sprint): boolean => {
    return sprint.status === "ACTIVE";
  },

  isSprintCompleted: (sprint: Sprint): boolean => {
    return sprint.status === "COMPLETED";
  },

  isSprintOverdue: (sprint: Sprint): boolean => {
    if (!sprint.endDate || sprint.status === "COMPLETED") return false;
    return new Date(sprint.endDate) < new Date();
  },

  canStartSprint: (sprint: Sprint): boolean => {
    return sprint.status === "PLANNING";
  },

  canCompleteSprint: (sprint: Sprint): boolean => {
    return sprint.status === "ACTIVE";
  },

  canEditSprint: (sprint: Sprint): boolean => {
    return sprint.status === "PLANNING" || sprint.status === "ACTIVE";
  },

  canDeleteSprint: (sprint: Sprint): boolean => {
    return sprint.status === "PLANNING" || sprint.status === "COMPLETED";
  },

  // Date formatting utilities
  formatSprintDuration: (sprint: Sprint): string => {
    if (!sprint.startDate || !sprint.endDate) return "No dates set";

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);

    const startFormatted = start.toLocaleDateString();
    const endFormatted = end.toLocaleDateString();

    return `${startFormatted} - ${endFormatted}`;
  },

  getSprintDurationInDays: (sprint: Sprint): number | null => {
    if (!sprint.startDate || !sprint.endDate) return null;

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const diffTime = end.getTime() - start.getTime();

    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  // Validation utilities
  validateSprintDates: (
    startDate: string,
    endDate: string
  ): { isValid: boolean; error?: string } => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: "Invalid date format" };
    }

    if (start >= end) {
      return { isValid: false, error: "Start date must be before end date" };
    }

    if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
      return { isValid: false, error: "Start date cannot be in the past" };
    }

    return { isValid: true };
  },

  // Bulk operations
  bulkUpdateSprints: async (
    sprintIds: string[],
    updateData: UpdateSprintData
  ): Promise<Sprint[]> => {
    try {
      const updatePromises = sprintIds.map((id) => sprintApi.updateSprint(id, updateData));
      return await Promise.all(updatePromises);
    } catch (error) {
      console.error("Bulk update sprints error:", error);
      throw error;
    }
  },

  bulkDeleteSprints: async (sprintIds: string[]): Promise<void> => {
    try {
      const deletePromises = sprintIds.map((id) => sprintApi.deleteSprint(id));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Bulk delete sprints error:", error);
      throw error;
    }
  },

  // Helper function to get current project from localStorage
  getCurrentProject: (): string | null => {
    try {
      if (typeof window === "undefined") return null;

      const projectId = localStorage.getItem("currentProjectId");
      return projectId;
    } catch (error) {
      console.error("Error getting current project:", error);
      return null;
    }
  },
};

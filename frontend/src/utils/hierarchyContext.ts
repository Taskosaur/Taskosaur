/**
 * Hierarchy Context Utilities
 *
 * This module provides utilities to automatically inject the appropriate
 * organization, workspace, and project IDs based on the current context hierarchy.
 */

import { usePathname } from "next/navigation";

// Get current organization ID from localStorage
export const getCurrentOrganizationId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("currentOrganizationId");
};

// Get current workspace ID from context (you might need to implement this)
export const getCurrentWorkspaceId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("currentWorkspaceId");
};

// Get current project ID from context (you might need to implement this)
export const getCurrentProjectId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("currentProjectId");
};

// Hook to automatically get hierarchy context from URL and localStorage
export const useHierarchyContext = () => {
  const pathname = usePathname();

  const getHierarchyFromUrl = () => {
    const segments = pathname.split("/").filter(Boolean);
    const globalRoutes = ["dashboard", "workspaces", "activity", "settings", "tasks"];

    // Check if we're in a global route
    if (segments.length === 0 || globalRoutes.includes(segments[0])) {
      return {
        organizationId: getCurrentOrganizationId(),
        workspaceSlug: null,
        projectSlug: null,
        workspaceId: null,
        projectId: null,
        contextLevel: "global",
      };
    }

    // We're in a workspace or project context
    const workspaceSlug = segments[0];
    const workspaceRoutes = ["projects", "members", "activity", "tasks", "analytics", "settings"];

    let projectSlug = null;
    let contextLevel = "workspace";

    if (segments.length >= 2 && !workspaceRoutes.includes(segments[1])) {
      // We're in a project context
      projectSlug = segments[1];
      contextLevel = "project";
    }

    return {
      organizationId: getCurrentOrganizationId(),
      workspaceSlug,
      projectSlug,
      workspaceId: getCurrentWorkspaceId(), // You might need to derive this from workspaceSlug
      projectId: getCurrentProjectId(), // You might need to derive this from projectSlug
      contextLevel,
    };
  };

  return getHierarchyFromUrl();
};

// Utility functions to enhance API calls with hierarchy context
export const withOrganizationContext = <T extends any[]>(
  fn: (organizationId: string, ...args: T) => Promise<any>
) => {
  return (...args: T) => {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error("No organization selected. Please select an organization first.");
    }
    return fn(organizationId, ...args);
  };
};

export const withWorkspaceContext = <T extends any[]>(
  fn: (workspaceId: string, ...args: T) => Promise<any>
) => {
  return (...args: T) => {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      throw new Error("No workspace selected. Please select a workspace first.");
    }
    return fn(workspaceId, ...args);
  };
};

export const withProjectContext = <T extends any[]>(
  fn: (projectId: string, ...args: T) => Promise<any>
) => {
  return (...args: T) => {
    const projectId = getCurrentProjectId();
    if (!projectId) {
      throw new Error("No project selected. Please select a project first.");
    }
    return fn(projectId, ...args);
  };
};

// Store current workspace/project IDs in localStorage when navigating
export const setCurrentWorkspaceId = (workspaceId: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("currentWorkspaceId", workspaceId);
  }
};

export const setCurrentProjectId = (projectId: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("currentProjectId", projectId);
  }
};

export const clearCurrentWorkspaceId = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("currentWorkspaceId");
    localStorage.removeItem("currentProjectId"); // Also clear project when workspace changes
  }
};

export const clearCurrentProjectId = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("currentProjectId");
  }
};

// Clear all hierarchy context when organization changes
export const clearAllHierarchyContext = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("currentWorkspaceId");
    localStorage.removeItem("currentProjectId");
  }
};

// Set organization and clear downstream context
export const setCurrentOrganizationId = (organizationId: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("currentOrganizationId", organizationId);
    // Clear downstream context when organization changes
    clearAllHierarchyContext();
  }
};

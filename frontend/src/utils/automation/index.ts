/**
 * Taskosaur Browser Automation System
 *
 * This module provides comprehensive browser-based automation for the Taskosaur application.
 * It can be used for testing, browser console manipulation, and MCP system integration.
 */

// Import all automation modules
import * as AuthAutomation from "./auth";
import * as WorkspaceAutomation from "./workspace";
import * as ProjectAutomation from "./project";
import * as TaskAutomation from "./tasks";
import * as Helpers from "./helpers";
import * as MemberAutomation from "./members";
import * as SprintAutomation from "./sprints";

// Re-export types and interfaces
export type { AutomationResult } from "./helpers";

/**
 * Main Taskosaur Automation class
 */
export class TaskosaurAutomation {
  // Helper functions
  public helpers = Helpers;

  // Authentication methods
  public login = AuthAutomation.login;
  public logout = AuthAutomation.logout;
  public register = AuthAutomation.register;
  public forgotPassword = AuthAutomation.forgotPassword;
  public checkAuthenticationStatus = AuthAutomation.checkAuthenticationStatus;

  // Workspace management methods
  public createWorkspace = WorkspaceAutomation.createWorkspace;
  public navigateToWorkspace = WorkspaceAutomation.navigateToWorkspace;
  public listWorkspaces = WorkspaceAutomation.listWorkspaces;
  public deleteWorkspace = WorkspaceAutomation.deleteWorkspace;
  public editWorkspace = WorkspaceAutomation.editWorkspace;
  public getCurrentWorkspace = WorkspaceAutomation.getCurrentWorkspace;
  public searchWorkspaces = WorkspaceAutomation.searchWorkspaces;

  // Project management methods
  public createProject = ProjectAutomation.createProject;
  public navigateToProject = ProjectAutomation.navigateToProject;
  public listProjects = ProjectAutomation.listProjects;
  public deleteProject = ProjectAutomation.deleteProject;
  public editProject = ProjectAutomation.editProject;
  public getCurrentProject = ProjectAutomation.getCurrentProject;
  public searchProjects = ProjectAutomation.searchProjects;

  // Task management methods
  public createTask = TaskAutomation.createTask;
  public updateTaskStatus = TaskAutomation.updateTaskStatus;
  public navigateToTasksView = TaskAutomation.navigateToTasksView;
  public searchTasks = TaskAutomation.searchTasks;
  public filterTasksByPriority = TaskAutomation.filterTasksByPriority;
  public filterTasksByStatus = TaskAutomation.filterTasksByStatus;
  public filterTasks = TaskAutomation.filterTasks;
  public clearTaskFilters = TaskAutomation.clearTaskFilters;
  public getTaskDetails = TaskAutomation.getTaskDetails;
  public deleteTask = TaskAutomation.deleteTask;

  // Member management methods
  public inviteMember = MemberAutomation.inviteMember;

  // Sprint Management;
  public createSprint = SprintAutomation.createSprint;

  // Secondary Navigation Management
  public async navigateToDashboard() {
    try {
      await Helpers.navigateTo("/");
      await Helpers.waitForElement(".dashboard-container, .space-y-6", 10000);
      await Helpers.waitFor(1000);
      return {
        success: true,
        message: "Navigated to dashboard",
        data: { currentPath: window.location.pathname },
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to navigate to dashboard",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
  /**
   * Utility methods for common operations
   */
  public utils = {
    waitFor: Helpers.waitFor,
    generateSlug: Helpers.generateSlug,
    navigateTo: Helpers.navigateTo,
    getCurrentContext: Helpers.getCurrentContext,
    isAuthenticated: Helpers.isAuthenticated,
  };

  /**
   * High-level workflow methods
   */
  public workflows = {
    /**
     * Complete project setup workflow
     */
    completeProjectSetup: async (
      workspaceName: string,
      workspaceDescription: string,
      projectName: string,
      projectDescription: string,
      tasks: Array<{
        title: string;
        priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
        description?: string;
        dueDate?: string;
        labels?: string[];
      }>
    ) => {
      try {
        // Create workspace
        const workspaceResult = await WorkspaceAutomation.createWorkspace(
          workspaceName,
          workspaceDescription
        );

        if (!workspaceResult.success) {
          throw new Error(`Workspace creation failed: ${workspaceResult.error}`);
        }

        const workspaceSlug = workspaceResult.data.slug;

        // Create project
        const projectResult = await ProjectAutomation.createProject(
          workspaceSlug,
          projectName,
          projectDescription
        );

        if (!projectResult.success) {
          throw new Error(`Project creation failed: ${projectResult.error}`);
        }

        const projectSlug = projectResult.data.slug;

        // Create tasks
        const taskResults = [];
        for (const taskData of tasks) {
          await Helpers.waitFor(500); // Brief pause between task creation

          const taskResult = await TaskAutomation.createTask(
            workspaceSlug,
            projectSlug,
            taskData.title,
            taskData
          );

          taskResults.push(taskResult);
        }

        const successfulTasks = taskResults.filter((result) => result.success).length;
        const failedTasks = taskResults.filter((result) => !result.success);

        return {
          success: true,
          message: `Complete project setup finished. Created ${successfulTasks}/${tasks.length} tasks successfully.`,
          data: {
            workspace: { name: workspaceName, slug: workspaceSlug },
            project: { name: projectName, slug: projectSlug },
            tasks: {
              total: tasks.length,
              successful: successfulTasks,
              failed: failedTasks.length,
              failures: failedTasks,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          message: "Complete project setup failed",
          error: error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },

    /**
     * Bulk task management workflow
     */
    bulkTaskOperations: async (
      workspaceSlug: string,
      projectSlug: string,
      operations: Array<{
        type: "create" | "update" | "delete";
        taskId?: string;
        taskTitle?: string;
        newStatus?: string;
        taskData?: any;
      }>
    ) => {
      const results = [];

      for (const operation of operations) {
        await Helpers.waitFor(300); // Brief pause between operations

        let result;
        switch (operation.type) {
          case "create":
            if (operation.taskTitle) {
              result = await TaskAutomation.createTask(
                workspaceSlug,
                projectSlug,
                operation.taskTitle,
                operation.taskData || {}
              );
            } else {
              result = {
                success: false,
                message: "Task title required for create operation",
                error: "Missing taskTitle",
              };
            }
            break;
          case "update":
            if (operation.taskId && operation.newStatus) {
              result = await TaskAutomation.updateTaskStatus(
                workspaceSlug,
                projectSlug,
                operation.taskId,
                operation.newStatus
              );
            } else {
              result = {
                success: false,
                message: "Task ID and new status required for update operation",
                error: "Missing taskId or newStatus",
              };
            }
            break;
          case "delete":
            if (operation.taskId) {
              result = await TaskAutomation.deleteTask(
                workspaceSlug,
                projectSlug,
                operation.taskId
              );
            } else {
              result = {
                success: false,
                message: "Task ID required for delete operation",
                error: "Missing taskId",
              };
            }
            break;
          default:
            result = {
              success: false,
              message: `Unknown operation type: ${operation.type}`,
              error: "Invalid operation type",
            };
        }

        results.push({ operation, result });
      }

      const successful = results.filter((r) => r.result.success).length;
      const failed = results.filter((r) => !r.result.success).length;

      return {
        success: failed === 0,
        message: `Bulk operations completed. ${successful} successful, ${failed} failed.`,
        data: {
          total: operations.length,
          successful,
          failed,
          results,
        },
      };
    },
  };

  /**
   * Initialize automation system
   */
  public async initialize(): Promise<Helpers.AutomationResult> {
    try {
      // Check if we're in a browser environment
      if (typeof window === "undefined") {
        throw new Error("Automation system requires browser environment");
      }

      // Check if we're on a Taskosaur domain
      const hostname = window.location.hostname;

      // Perform initial checks
      const authStatus = await AuthAutomation.checkAuthenticationStatus();
      const currentContext = Helpers.getCurrentContext();

      return {
        success: true,
        message: "Automation system initialized successfully",
        data: {
          domain: hostname,
          authenticated: authStatus.data?.authenticated || false,
          context: currentContext,
          version: "1.0.0",
        },
      };
    } catch (error) {
      console.error("❌ Failed to initialize automation system:", error);
      return {
        success: false,
        message: "Failed to initialize automation system",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

// Create and export the main automation instance
export const automation = new TaskosaurAutomation();

// Export individual modules for direct import
export {
  AuthAutomation as auth,
  WorkspaceAutomation as workspace,
  ProjectAutomation as project,
  TaskAutomation as task,
  Helpers as helpers,
};

// Export direct function access for convenience
export const {
  // Auth functions
  login,
  logout,
  register,
  forgotPassword,
  checkAuthenticationStatus,

  // Workspace functions
  createWorkspace,
  navigateToWorkspace,
  listWorkspaces,
  deleteWorkspace,
  editWorkspace,
  getCurrentWorkspace,
  searchWorkspaces,

  // Project functions
  createProject,
  navigateToProject,
  listProjects,
  deleteProject,
  editProject,
  getCurrentProject,
  searchProjects,

  // Task functions
  createTask,
  updateTaskStatus,
  navigateToTasksView,
  searchTasks,
  filterTasksByPriority,
  filterTasksByStatus,
  filterTasks,
  clearTaskFilters,
  getTaskDetails,
  deleteTask,

  // Member function
  inviteMember,

  // Sprint Management
  createSprint,

  //Secondary Navigation Management
  navigateToDashboard,
} = automation;

/**
 * Browser console integration
 * Makes automation functions available globally in browser console
 */
export function enableBrowserConsoleAccess(): void {
  if (typeof window !== "undefined") {
    // Make main automation instance available globally
    (window as any).TaskosaurAutomation = automation;

    // Make individual modules available
    (window as any).taskosaurAuth = AuthAutomation;
    (window as any).taskosaurWorkspace = WorkspaceAutomation;
    (window as any).taskosaurProject = ProjectAutomation;
    (window as any).taskosaurTask = TaskAutomation;
    (window as any).taskosaurHelpers = Helpers;

    // Make workflows available
    (window as any).taskosaurWorkflows = automation.workflows;
  }
}

/**
 * MCP (Model Context Protocol) integration wrapper
 */
export const MCPIntegration = {
  /**
   * Wrap automation functions for MCP system consumption
   */
  wrapForMCP: () => {
    return {
      // Authentication
      login: automation.login,
      logout: automation.logout,
      checkAuth: automation.checkAuthenticationStatus,

      // Workspace Management
      createWorkspace: automation.createWorkspace,
      listWorkspaces: automation.listWorkspaces,
      navigateToWorkspace: automation.navigateToWorkspace,

      // Project Management
      createProject: automation.createProject,
      listProjects: automation.listProjects,
      navigateToProject: automation.navigateToProject,

      // Task Management
      createTask: automation.createTask,
      updateTaskStatus: automation.updateTaskStatus,
      searchTasks: automation.searchTasks,
      filterTasks: automation.filterTasks,
      filterTasksByPriority: automation.filterTasksByPriority,
      filterTasksByStatus: automation.filterTasksByStatus,
      clearTaskFilters: automation.clearTaskFilters,
      navigateToTasksView: automation.navigateToTasksView,

      // Workflows
      completeProjectSetup: automation.workflows.completeProjectSetup,
      bulkTaskOperations: automation.workflows.bulkTaskOperations,

      // Utilities
      getCurrentContext: Helpers.getCurrentContext,
      waitFor: Helpers.waitFor,
    };
  },

  /**
   * Get function metadata for MCP system
   */
  getFunctionMetadata: () => {
    return {
      functions: [
        {
          name: "login",
          description: "Log into Taskosaur application",
          parameters: ["email", "password"],
          returns: "AutomationResult",
        },
        {
          name: "createWorkspace",
          description: "Create a new workspace",
          parameters: ["name", "description"],
          returns: "AutomationResult",
        },
        {
          name: "createProject",
          description: "Create a new project in a workspace",
          parameters: ["workspaceSlug", "name", "description", "options?"],
          returns: "AutomationResult",
        },
        {
          name: "createTask",
          description: "Create a new task in a project",
          parameters: ["workspaceSlug", "projectSlug", "taskTitle", "options?"],
          returns: "AutomationResult",
        },
        {
          name: "completeProjectSetup",
          description: "Complete workflow to create workspace, project, and tasks",
          parameters: [
            "workspaceName",
            "workspaceDescription",
            "projectName",
            "projectDescription",
            "tasks",
          ],
          returns: "AutomationResult",
        },
      ],
    };
  },
};

// Default export
export default automation;

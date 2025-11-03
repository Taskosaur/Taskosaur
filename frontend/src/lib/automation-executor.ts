import { automation } from "@/utils/automation";
import { capabilitiesManager } from "./capabilities-loader";
import type { AutomationResult } from "@/utils/automation/helpers";

export interface ExecutionContext {
  workspaceSlug?: string;
  projectSlug?: string;
  userId?: string;
}

export interface ParsedIntent {
  action: string;
  parameters: Record<string, any>;
  confidence: number;
}

class AutomationExecutor {
  // Map action names to actual automation functions
  private actionMap: Record<string, (...args: any[]) => any> = {
    // Authentication
    login: automation.login,
    logout: automation.logout,
    checkAuthenticationStatus: automation.checkAuthenticationStatus,

    // Workspace Management
    createWorkspace: automation.createWorkspace,
    listWorkspaces: automation.listWorkspaces,
    navigateToWorkspace: automation.navigateToWorkspace,
    editWorkspace: automation.editWorkspace,
    deleteWorkspace: automation.deleteWorkspace,
    searchWorkspaces: automation.searchWorkspaces,

    // Project Management
    createProject: automation.createProject,
    listProjects: automation.listProjects,
    navigateToProject: automation.navigateToProject,
    editProject: automation.editProject,
    deleteProject: automation.deleteProject,
    searchProjects: automation.searchProjects,

    // Task Management
    createTask: automation.createTask,
    updateTaskStatus: automation.updateTaskStatus,
    searchTasks: automation.searchTasks,
    filterTasks: automation.filterTasks,
    filterTasksByPriority: automation.filterTasksByPriority,
    filterTasksByStatus: automation.filterTasksByStatus,
    clearTaskFilters: automation.clearTaskFilters,
    getTaskDetails: automation.getTaskDetails,
    deleteTask: automation.deleteTask,
    navigateToTasksView: automation.navigateToTasksView,

    // Member Management;
    inviteMember: automation.inviteMember,

    // Secondary Navigation Management
    navigateToDashboard: automation.navigateToDashboard,

    // Sprint Management
    createSprint: automation.createSprint,

    // Navigation
    navigateTo: async (url: string): Promise<AutomationResult> => {
      await automation.utils.navigateTo(url);
      return {
        success: true,
        message: `Navigated to ${url}`,
        data: { url },
      };
    },
    getCurrentContext: (): AutomationResult => {
      const context = automation.utils.getCurrentContext();
      return {
        success: true,
        message: "Retrieved current context",
        data: context,
      };
    },
    isAuthenticated: (): AutomationResult => {
      const authenticated = automation.utils.isAuthenticated();
      return {
        success: true,
        message: authenticated ? "User is authenticated" : "User is not authenticated",
        data: { authenticated },
      };
    },

    // Workflows
    completeProjectSetup: automation.workflows.completeProjectSetup,
    bulkTaskOperations: automation.workflows.bulkTaskOperations,
  };

  /**
   * Parse user intent from natural language
   */
  parseUserIntent(message: string, context: ExecutionContext): ParsedIntent | null {
    // Enhanced intent patterns with more natural language variations
    const intentPatterns: Array<{
      pattern: RegExp;
      action: string;
      extractor: (match: RegExpMatchArray) => Record<string, any>;
    }> = [
      // Task creation patterns
      {
        pattern:
          /(?:create|add|make|new)\s+(?:a\s+)?task\s+(?:called|named|titled)?\s*["\']?([^"'\n]+)["\']?/i,
        action: "createTask",
        extractor: (match) => ({
          taskTitle: match[1].trim(),
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },
      {
        pattern: /task:\s*["\']?([^"'\n]+)["\']?/i,
        action: "createTask",
        extractor: (match) => ({
          taskTitle: match[1].trim(),
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },

      // Task status update patterns
      {
        pattern:
          /(?:mark|update|change|set)\s+(?:task\s+)?["\']?([^"']+)["\']?\s+(?:as|to)\s+["\']?([^"']+)["\']?/i,
        action: "updateTaskStatus",
        extractor: (match) => ({
          taskTitle: match[1].trim(),
          newStatus: match[2].trim(),
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },

      // Workspace creation
      {
        pattern:
          /(?:create|add|make|new)\s+(?:a\s+)?workspace\s+(?:called|named)?\s*["\']?([^"'\n]+)["\']?/i,
        action: "createWorkspace",
        extractor: (match) => ({
          name: match[1].trim(),
        }),
      },

      // Workspace renaming - simplified patterns
      {
        pattern: /rename workspace (\w+) to (.+)$/i,
        action: "editWorkspace",
        extractor: (match) => {
          const extractedName = match[2] ? match[2].trim() : "";
          return {
            workspaceSlug: match[1].trim(),
            name: extractedName,
          };
        },
      },
      {
        pattern: /edit workspace (\w+) to (.+)/i,
        action: "editWorkspace",
        extractor: (match) => ({
          workspaceSlug: match[1].trim(),
          name: match[2].trim(),
        }),
      },

      // Project creation
      {
        pattern:
          /(?:create|add|make|new)\s+(?:a\s+)?project\s+(?:called|named)?\s*["\']?([^"'\n]+)["\']?/i,
        action: "createProject",
        extractor: (match) => ({
          name: match[1].trim(),
          workspaceSlug: context.workspaceSlug,
        }),
      },

      // Navigation patterns
      {
        pattern: /(?:go to|navigate to|open|show)\s+(?:the\s+)?([^\s]+)\s+workspace/i,
        action: "navigateToWorkspace",
        extractor: (match) => ({
          workspaceSlug: match[1].trim(),
        }),
      },
      {
        pattern: /(?:go to|navigate to|open|show)\s+(?:the\s+)?([^\s]+)\s+project/i,
        action: "navigateToProject",
        extractor: (match) => ({
          projectSlug: match[1].trim(),
          workspaceSlug: context.workspaceSlug,
        }),
      },

      // List/Show patterns
      {
        pattern: /(?:list|show|display|get)\s+(?:all\s+)?(?:my\s+)?workspaces/i,
        action: "listWorkspaces",
        extractor: () => ({}),
      },
      {
        pattern: /(?:list|show|display|get)\s+(?:all\s+)?(?:my\s+)?projects/i,
        action: "listProjects",
        extractor: () => ({
          workspaceSlug: context.workspaceSlug,
        }),
      },

      // Filter patterns
      {
        pattern:
          /(?:show|filter|find)\s+(?:all\s+)?(?:tasks?\s+)?(?:with\s+)?(?:priority|priority\s+level)\s+([^\s]+)/i,
        action: "filterTasksByPriority",
        extractor: (match) => ({
          priority: match[1].toUpperCase(),
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },
      {
        pattern:
          /(?:show|filter|find)\s+(?:all\s+)?(?:tasks?\s+)?(?:with\s+)?status\s+["\']?([^"'\n]+)["\']?/i,
        action: "filterTasksByStatus",
        extractor: (match) => ({
          status: match[1].trim(),
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },
      {
        pattern: /(?:clear|remove|reset)\s+(?:all\s+)?(?:task\s+)?filters/i,
        action: "clearTaskFilters",
        extractor: () => ({
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },

      // Search patterns
      {
        pattern: /(?:search|find|look for)\s+(?:tasks?\s+)?(?:for\s+)?["\']?([^"'\n]+)["\']?/i,
        action: "searchTasks",
        extractor: (match) => ({
          query: match[1].trim(),
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },

      // Delete patterns
      {
        pattern: /(?:delete|remove)\s+task\s+["\']?([^"'\n]+)["\']?/i,
        action: "deleteTask",
        extractor: (match) => ({
          taskId: match[1].trim(), // This will need to be resolved to actual ID
          workspaceSlug: context.workspaceSlug,
          projectSlug: context.projectSlug,
        }),
      },

      // Authentication
      {
        pattern: /(?:log\s*out|logout|sign\s*out)/i,
        action: "logout",
        extractor: () => ({}),
      },
      {
        pattern: /(?:am\s+i|check\s+if\s+i['']?m)\s+(?:logged\s+in|authenticated|signed\s+in)/i,
        action: "checkAuthenticationStatus",
        extractor: () => ({}),
      },
    ];

    // Try to match patterns
    for (const { pattern, action, extractor } of intentPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          action,
          parameters: extractor(match),
          confidence: 0.8,
        };
      }
    }

    return null;
  }

  /**
   * Execute an automation action
   */
  async executeAction(action: string, parameters: Record<string, any>): Promise<AutomationResult> {
    // Check if action is supported
    if (!capabilitiesManager.isActionSupported(action)) {
      return {
        success: false,
        message: `Action "${action}" is not supported`,
        error: capabilitiesManager.getErrorMessage("unsupported_action"),
      };
    }

    // Get the function to execute
    const fn = this.actionMap[action];
    if (!fn) {
      return {
        success: false,
        message: `Action "${action}" is not implemented`,
        error: "Action mapping not found",
      };
    }

    try {
      // Execute the action with parameters
      const actionDetails = capabilitiesManager.getActionDetails(action);
      if (!actionDetails) {
        return {
          success: false,
          message: `Action details not found for "${action}"`,
          error: "Missing action configuration",
        };
      }

      // Validate required parameters
      const missingParams = actionDetails.parameters
        .filter((p) => p.required && !parameters[p.name])
        .map((p) => p.name);

      if (missingParams.length > 0) {
        return {
          success: false,
          message: `Missing required parameters: ${missingParams.join(", ")}`,
          error: capabilitiesManager.getErrorMessage("insufficient_context"),
        };
      }

      // Convert parameters to positional arguments based on action
      const args = this.prepareArguments(action, parameters);

      // Execute the automation function
      const result = await fn(...args);

      return result;
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
      return {
        success: false,
        message: `Failed to execute ${action}`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Prepare arguments for function call based on action type
   */
  private prepareArguments(action: string, parameters: Record<string, any>): any[] {
    // Map parameters to function arguments based on action
    switch (action) {
      case "createTask":
        return [
          parameters.workspaceSlug,
          parameters.projectSlug,
          parameters.taskTitle,
          parameters.options || {},
        ];

      case "updateTaskStatus":
        return [
          parameters.workspaceSlug,
          parameters.projectSlug,
          parameters.taskTitle,
          parameters.newStatus,
        ];

      case "createWorkspace":
        return [parameters.name, parameters.description || ""];

      case "editWorkspace":
        // Handle both formats: direct name or updates object
        const cleanName = parameters.updates?.name || parameters.name || "";
        const cleanDescription = parameters.updates?.description || parameters.description || "";
        return [
          parameters.workspaceSlug,
          {
            name: cleanName.toString().trim(),
            description: cleanDescription.toString().trim(),
          },
        ];

      case "createProject":
        return [
          parameters.workspaceSlug,
          parameters.name,
          parameters.description || "",
          parameters.options || {},
        ];

      case "navigateToWorkspace":
        return [parameters.workspaceSlug];

      case "navigateToProject":
        return [parameters.workspaceSlug, parameters.projectSlug];

      case "navigateTo":
        if (parameters.destination === "workspace") {
          return [parameters.workspaceSlug];
        } else if (parameters.destination === "project") {
          return [parameters.workspaceSlug, parameters.projectSlug];
        }
        return [parameters.destination];

      case "filterTasksByPriority":
        return [parameters.workspaceSlug, parameters.projectSlug, parameters.priority];

      case "filterTasksByStatus":
        return [parameters.workspaceSlug, parameters.projectSlug, parameters.status];

      case "searchTasks":
        return [parameters.workspaceSlug, parameters.projectSlug, parameters.query];

      case "deleteTask":
        return [parameters.workspaceSlug, parameters.projectSlug, parameters.taskId];

      case "clearTaskFilters":
        return [parameters.workspaceSlug, parameters.projectSlug];

      case "listWorkspaces":
      case "logout":
      case "checkAuthenticationStatus":
      case "getCurrentContext":
      case "isAuthenticated":
        return [];

      case "listProjects":
        return parameters.workspaceSlug ? [parameters.workspaceSlug] : [];

      default:
        // For other actions, try to match parameters to expected order
        return Object.values(parameters);
    }
  }

  /**
   * Format automation result for user display
   */
  formatResult(result: AutomationResult): string {
    if (result.success) {
      let response = `✅ ${result.message || "Action completed successfully"}`;

      if (result.data) {
        // Format data based on type
        if (Array.isArray(result.data)) {
          response += `\n\nFound ${result.data.length} items`;
          if (result.data.length > 0 && result.data.length <= 10) {
            response +=
              ":\n" +
              result.data.map((item: any) => `• ${item.name || item.title || item}`).join("\n");
          }
        } else if (typeof result.data === "object") {
          // Handle specific data types
          if (result.data.workspaces && Array.isArray(result.data.workspaces)) {
            // Handle workspace list results
            response += `\n\nFound ${result.data.workspaces.length} workspace(s):`;
            result.data.workspaces.forEach((workspace: any) => {
              response += `\n📁 ${workspace.name || workspace.slug}`;
              if (workspace.description) {
                response += ` - ${workspace.description}`;
              }
              if (workspace.projectCount !== undefined) {
                response += ` (${workspace.projectCount} projects)`;
              }
            });
          } else if (result.data.projects && Array.isArray(result.data.projects)) {
            // Handle project list results
            response += `\n\nFound ${result.data.projects.length} project(s):`;
            result.data.projects.forEach((project: any) => {
              response += `\n🎯 ${project.name || project.slug}`;
              if (project.description) {
                response += ` - ${project.description}`;
              }
            });
          } else if (result.data.workspace) {
            response += `\n📁 Workspace: ${result.data.workspace.name}`;
          } else if (result.data.project) {
            response += `\n🎯 Project: ${result.data.project.name}`;
          } else if (result.data.task) {
            response += `\n✅ Task: ${result.data.task.title}`;
          } else if (result.data.authenticated !== undefined) {
            response = result.data.authenticated
              ? "✅ You are currently logged in"
              : "❌ You are not logged in";
          }
        }
      }

      return response;
    } else {
      return `❌ ${result.message || "Action failed"}\n${result.error || ""}`;
    }
  }
}

export const automationExecutor = new AutomationExecutor();

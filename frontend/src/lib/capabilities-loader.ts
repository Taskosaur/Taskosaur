// Define types for the capabilities structure
export interface CapabilityAction {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    options?: string[];
    properties?: string[];
  }>;
  example: string;
}

export interface CapabilityCategory {
  category: string;
  description: string;
  actions: CapabilityAction[];
}

export interface AutomationCapabilities {
  name: string;
  version: string;
  description: string;
  capabilities: Record<string, CapabilityCategory>;
  limitations: {
    general: string[];
    data: string[];
    communication: string[];
    infrastructure: string[];
  };
  error_messages: Record<string, string>;
  response_templates: Record<string, string>;
}

// Capabilities data (embedded to avoid file loading issues)
const CAPABILITIES_DATA: AutomationCapabilities = {
  name: "Taskosaur AI Assistant Capabilities",
  version: "1.0.0",
  description: "Defines the available automation capabilities for the Taskosaur AI Assistant",

  capabilities: {
    authentication: {
      category: "Authentication Management",
      description: "Handle user authentication and session management",
      actions: [
        {
          name: "login",
          description: "Log into Taskosaur with email and password",
          parameters: [
            { name: "email", type: "string", required: true },
            { name: "password", type: "string", required: true },
          ],
          example: "I can help you log in to Taskosaur if you provide your credentials.",
        },
        {
          name: "logout",
          description: "Log out of the current session",
          parameters: [],
          example: "I can log you out of your current Taskosaur session.",
        },
        {
          name: "checkAuthenticationStatus",
          description: "Check if user is currently authenticated",
          parameters: [],
          example: "I can check if you're currently logged in to Taskosaur.",
        },
      ],
    },

    workspace: {
      category: "Workspace Management",
      description: "Create, manage, and navigate workspaces",
      actions: [
        {
          name: "createWorkspace",
          description: "Create a new workspace",
          parameters: [
            { name: "name", type: "string", required: true },
            { name: "description", type: "string", required: false },
          ],
          example: "I can create a new workspace for you. Just tell me the name and description.",
        },
        {
          name: "listWorkspaces",
          description: "List all available workspaces",
          parameters: [],
          example: "I can show you all your available workspaces.",
        },
        {
          name: "navigateToWorkspace",
          description: "Navigate to a specific workspace",
          parameters: [{ name: "workspaceSlug", type: "string", required: true }],
          example: "I can navigate you to any workspace you specify.",
        },
        {
          name: "editWorkspace",
          description: "Edit workspace details",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "updates", type: "object", required: true },
          ],
          example: "I can help you edit workspace details like name or description.",
        },
        {
          name: "deleteWorkspace",
          description: "Delete a workspace (with confirmation)",
          parameters: [{ name: "workspaceSlug", type: "string", required: true }],
          example: "I can delete a workspace, but I'll need confirmation first.",
        },
        {
          name: "searchWorkspaces",
          description: "Search workspaces by name or description",
          parameters: [{ name: "query", type: "string", required: true }],
          example: "I can help you find workspaces by searching for keywords.",
        },
      ],
    },

    project: {
      category: "Project Management",
      description: "Create, manage, and navigate projects within workspaces",
      actions: [
        {
          name: "createProject",
          description: "Create a new project in a workspace",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "name", type: "string", required: true },
            { name: "description", type: "string", required: false },
            { name: "options", type: "object", required: false },
          ],
          example:
            "I can create a new project in any workspace. Just tell me the workspace and project details.",
        },
        {
          name: "listProjects",
          description: "List all projects in a workspace",
          parameters: [{ name: "workspaceSlug", type: "string", required: false }],
          example: "I can show you all projects in a workspace or across all workspaces.",
        },
        {
          name: "navigateToProject",
          description: "Navigate to a specific project",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
          ],
          example: "I can take you to any specific project.",
        },
        {
          name: "editProject",
          description: "Edit project details",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "updates", type: "object", required: true },
          ],
          example: "I can help you update project information like name, description, or settings.",
        },
        {
          name: "deleteProject",
          description: "Delete a project (with confirmation)",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
          ],
          example: "I can delete projects, but I'll ask for confirmation first.",
        },
        {
          name: "searchProjects",
          description: "Search projects by name or description",
          parameters: [
            { name: "query", type: "string", required: true },
            { name: "workspaceSlug", type: "string", required: false },
          ],
          example: "I can help you find projects by searching for keywords.",
        },
      ],
    },

    task: {
      category: "Task Management",
      description: "Create, manage, and organize tasks within projects",
      actions: [
        {
          name: "createTask",
          description: "Create a new task in a project",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "taskTitle", type: "string", required: true },
            {
              name: "options",
              type: "object",
              required: false,
              properties: ["priority", "description", "dueDate", "labels", "assignee"],
            },
          ],
          example:
            "I can create tasks for you. Just tell me the workspace, project, and task details.",
        },
        {
          name: "updateTaskStatus",
          description: "Update task status (To Do, In Progress, Done, etc.)",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "taskTitle", type: "string", required: true },
            { name: "newStatus", type: "string", required: true },
          ],
          example: "I can update task statuses to help you track progress.",
        },
        {
          name: "searchTasks",
          description: "Search tasks by title or description",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "query", type: "string", required: true },
          ],
          example: "I can help you find tasks by searching for keywords.",
        },
        {
          name: "filterTasks",
          description: "Filter tasks by various criteria",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            {
              name: "filters",
              type: "object",
              required: true,
              properties: ["priorities", "statuses", "labels", "assignees"],
            },
          ],
          example: "I can filter tasks by priority, status, labels, or assignees.",
        },
        {
          name: "filterTasksByPriority",
          description: "Filter tasks by priority level",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            {
              name: "priority",
              type: "string",
              required: true,
              options: ["LOW", "MEDIUM", "HIGH", "HIGHEST"],
            },
          ],
          example: "I can show you tasks filtered by priority (LOW, MEDIUM, HIGH, HIGHEST).",
        },
        {
          name: "filterTasksByStatus",
          description: "Filter tasks by status",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "status", type: "string", required: true },
          ],
          example: "I can filter tasks by their current status (To Do, In Progress, Done, etc.).",
        },
        {
          name: "clearTaskFilters",
          description: "Clear all applied task filters",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
          ],
          example: "I can clear all filters to show all tasks.",
        },
        {
          name: "getTaskDetails",
          description: "Get detailed information about a specific task",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "taskId", type: "string", required: true },
          ],
          example: "I can show you detailed information about any task.",
        },
        {
          name: "deleteTask",
          description: "Delete a task (with confirmation)",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "taskId", type: "string", required: true },
          ],
          example: "I can delete tasks, but I'll ask for confirmation first.",
        },
        {
          name: "navigateToTasksView",
          description: "Navigate to the tasks view of a project",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
          ],
          example: "I can take you to the tasks view of any project.",
        },
      ],
    },

    navigation: {
      category: "Navigation & Utilities",
      description: "Navigate through the application and perform utility functions",
      actions: [
        {
          name: "navigateTo",
          description: "Navigate to any URL within Taskosaur",
          parameters: [{ name: "url", type: "string", required: true }],
          example: "I can navigate you to any page within Taskosaur.",
        },
        {
          name: "getCurrentContext",
          description: "Get current page context (workspace, project, etc.)",
          parameters: [],
          example: "I can tell you where you are in the application.",
        },
        {
          name: "isAuthenticated",
          description: "Check if user is authenticated",
          parameters: [],
          example: "I can check your authentication status.",
        },
        {
          name: "navigateToDashboard",
          description: "Navigate to the home page or dashboard page",
          parameters: [],
          example: "I can navigate you to Taskosaur dashboard.",
        },
      ],
    },

    workflows: {
      category: "Advanced Workflows",
      description: "Execute complex multi-step operations",
      actions: [
        {
          name: "completeProjectSetup",
          description: "Create workspace, project, and initial tasks in one workflow",
          parameters: [
            { name: "workspaceName", type: "string", required: true },
            { name: "workspaceDescription", type: "string", required: true },
            { name: "projectName", type: "string", required: true },
            { name: "projectDescription", type: "string", required: true },
            { name: "tasks", type: "array", required: true },
          ],
          example:
            "I can set up a complete project structure including workspace, project, and initial tasks.",
        },
        {
          name: "bulkTaskOperations",
          description: "Perform multiple task operations at once",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "operations", type: "array", required: true },
          ],
          example:
            "I can perform multiple task operations like creating, updating, or deleting several tasks at once.",
        },
      ],
    },

    inviteMember: {
      category: "Member Management",
      description: "Create, manage, and organize member within projects",
      actions: [
        {
          name: "inviteMember",
          description: "Invite a member who belongs to the current organization",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "email", type: "string", required: true },
            { name: "role", type: "string", required: true },
          ],
          example: "I can invite a member to any task.",
        },
      ],
    },

    sprint: {
      category: "Sprint Management",
      description: "Create, manage, and organize sprint within projects",
      actions: [
        {
          name: "createSprint",
          description: "Create a new sprint within projects",
          parameters: [
            { name: "workspaceSlug", type: "string", required: true },
            { name: "projectSlug", type: "string", required: true },
            { name: "name", type: "string", required: true },
            { name: "status", type: "string", required: true },
            { name: "startDate", type: "string", required: true },
            { name: "endDate", type: "string", required: true },
            { name: "goalDescription", type: "string", required: false },
          ],
          example: "I can create a new sprint within the current project",
        },
      ],
    },
  },

  limitations: {
    general: [
      "I cannot access external systems or APIs outside of Taskosaur",
      "I cannot modify system settings or user permissions",
      "I cannot access sensitive data like passwords or private information",
      "I cannot perform actions that require admin privileges",
      "I cannot integrate with external tools unless specifically configured",
    ],
    data: [
      "I cannot backup or restore data",
      "I cannot export data to external formats",
      "I cannot import data from external sources",
      "I cannot recover deleted items",
    ],
    communication: [
      "I cannot send emails or notifications outside the system",
      "I cannot access or manage user accounts",
      "I cannot invite or manage team members",
    ],
    infrastructure: [
      "I cannot deploy or manage servers",
      "I cannot configure databases",
      "I cannot manage hosting or domain settings",
      "I cannot access server logs or system metrics",
    ],
  },

  error_messages: {
    unsupported_action: `I'm sorry, but I cannot perform that action. I'm specifically designed to help with Taskosaur project management tasks.

Here's what I CAN help you with:
• Create and manage workspaces, projects, and tasks
• Navigate through the Taskosaur interface
• Filter and search your content
• Update task statuses and details
• Set up project workflows

Is there a project management task I can help you with instead?`,

    insufficient_context: `I need more information to help you with that. Could you please specify:
• Which workspace you're working with
• Which project (if applicable)
• What specific action you'd like me to perform`,

    authentication_required: `I need you to be logged in to Taskosaur to perform that action. Would you like me to help you log in first?`,

    permission_denied: `I don't have permission to perform that action. This might require admin privileges or special access that I don't have.`,
  },

  response_templates: {
    capability_list: `Here are the main things I can help you with in Taskosaur:

📁 **Workspace Management**
• Create, edit, delete workspaces
• Navigate between workspaces
• Search for workspaces

🎯 **Project Management**
• Create, edit, delete projects
• Navigate to projects
• Search and organize projects

✅ **Task Management**
• Create, edit, delete tasks
• Update task statuses
• Filter tasks by priority, status, or labels
• Search for specific tasks

🔄 **Advanced Workflows**
• Complete project setup (workspace + project + tasks)
• Bulk task operations

What would you like me to help you with?`,

    getting_started: `Great! I'm here to help you manage your projects in Taskosaur. To get started, I can:

1. **Set up a new project** - I'll create the workspace, project, and initial tasks
2. **Navigate to existing content** - Help you find and open your workspaces/projects
3. **Manage your tasks** - Create, update, or organize your task list

What would you like to work on today?`,
  },
};

class CapabilitiesManager {
  private capabilities: AutomationCapabilities;

  constructor() {
    this.capabilities = CAPABILITIES_DATA;
  }

  // Get all capabilities
  getCapabilities(): AutomationCapabilities {
    return this.capabilities;
  }

  // Check if an action is supported
  isActionSupported(actionName: string): boolean {
    for (const category of Object.values(this.capabilities.capabilities)) {
      if (category.actions.some((action) => action.name === actionName)) {
        return true;
      }
    }
    return false;
  }

  // Get action details
  getActionDetails(actionName: string): CapabilityAction | null {
    for (const category of Object.values(this.capabilities.capabilities)) {
      const action = category.actions.find((action) => action.name === actionName);
      if (action) {
        return action;
      }
    }
    return null;
  }

  // Get all available actions by category
  getActionsByCategory(): Record<string, CapabilityAction[]> {
    const result: Record<string, CapabilityAction[]> = {};
    for (const [key, category] of Object.entries(this.capabilities.capabilities)) {
      result[key] = category.actions;
    }
    return result;
  }

  // Get error message for unsupported actions
  getErrorMessage(errorType: string): string {
    return (
      this.capabilities.error_messages[errorType] ||
      this.capabilities.error_messages.unsupported_action
    );
  }

  // Get response template
  getResponseTemplate(templateName: string): string {
    return this.capabilities.response_templates[templateName] || "";
  }

  // Get limitations
  getLimitations(): AutomationCapabilities["limitations"] {
    return this.capabilities.limitations;
  }

  // Generate concise capability summary for system prompt
  generateCapabilitySummary(): string {
    const categories = Object.values(this.capabilities.capabilities);
    let summary = "Available actions:\n\n";

    for (const category of categories) {
      summary += `**${category.category}**: `;
      const actions = category.actions.map((action) => action.name);
      summary += `${actions.join(", ")}\n`;
    }

    summary +=
      "\nLimitations: Cannot access external systems, modify permissions, or perform admin tasks.\n";
    summary += "For unsupported requests, explain limitations and suggest alternatives.";

    return summary;
  }
}

// Export singleton instance
export const capabilitiesManager = new CapabilitiesManager();

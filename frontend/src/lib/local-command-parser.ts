export interface ParsedCommand {
  action: string;
  params: Record<string, any>;
  confidence: number;
}

export class LocalCommandParser {
  // Parse user input and return command if it matches known patterns
  parseCommand(input: string): ParsedCommand | null {
    const lower = input.toLowerCase().trim();

    // List workspaces - much more flexible patterns
    if (
      (lower.includes("list") && lower.includes("workspace")) ||
      (lower.includes("show") && lower.includes("workspace")) ||
      (lower.includes("display") && lower.includes("workspace")) ||
      (lower.includes("get") && lower.includes("workspace")) ||
      (lower.includes("all") && lower.includes("workspace")) ||
      (lower.includes("my") && lower.includes("workspace"))
    ) {
      return {
        action: "listWorkspaces",
        params: {},
        confidence: 1.0,
      };
    }

    // List projects - more flexible
    if (
      (lower.includes("list") && lower.includes("project")) ||
      (lower.includes("show") && lower.includes("project")) ||
      (lower.includes("display") && lower.includes("project")) ||
      (lower.includes("get") && lower.includes("project")) ||
      (lower.includes("all") && lower.includes("project")) ||
      (lower.includes("my") && lower.includes("project"))
    ) {
      return {
        action: "listProjects",
        params: {},
        confidence: 1.0,
      };
    }

    // Create task - various formats
    const createTaskPatterns = [
      /^create\s+task\s+(.+)$/i,
      /^add\s+task\s+(.+)$/i,
      /^new\s+task\s+(.+)$/i,
      /^task:\s*(.+)$/i,
      /^create\s+a?\s*task\s+(?:called\s+)?(.+)$/i,
      /^add\s+a?\s*task\s+(?:called\s+)?(.+)$/i,
    ];

    for (const pattern of createTaskPatterns) {
      const match = input.match(pattern);
      if (match) {
        return {
          action: "createTask",
          params: { taskTitle: match[1].trim() },
          confidence: 0.95,
        };
      }
    }

    // Update task status
    const statusPatterns = [
      /^mark\s+["\']?([^"']+)["\']?\s+as\s+([^\s]+)$/i,
      /^update\s+["\']?([^"']+)["\']?\s+to\s+([^\s]+)$/i,
      /^change\s+["\']?([^"']+)["\']?\s+to\s+([^\s]+)$/i,
      /^set\s+["\']?([^"']+)["\']?\s+(?:to|as)\s+([^\s]+)$/i,
    ];

    for (const pattern of statusPatterns) {
      const match = input.match(pattern);
      if (match) {
        return {
          action: "updateTaskStatus",
          params: {
            taskTitle: match[1].trim(),
            newStatus: match[2].trim(),
          },
          confidence: 0.9,
        };
      }
    }

    // Filter by priority
    if (
      lower.match(
        /(show|filter|display|get)\s*(all)?\s*(high|medium|low|highest)\s*priority\s*tasks?/
      )
    ) {
      const priorityMatch = lower.match(/(high|medium|low|highest)/);
      if (priorityMatch) {
        return {
          action: "filterTasksByPriority",
          params: { priority: priorityMatch[1].toUpperCase() },
          confidence: 0.95,
        };
      }
    }

    // Filter by status
    const statusFilterMatch = lower.match(/(show|filter|display|get)\s*(all)?\s*([^\s]+)\s+tasks?/);
    if (statusFilterMatch) {
      const status = statusFilterMatch[3];
      if (["done", "completed", "in-progress", "todo", "pending"].includes(status)) {
        return {
          action: "filterTasksByStatus",
          params: { status: status.replace("-", " ") },
          confidence: 0.9,
        };
      }
    }

    // Clear filters
    if (lower.match(/^(clear|remove|reset)\s*(all)?\s*(task)?\s*filters?$/)) {
      return {
        action: "clearTaskFilters",
        params: {},
        confidence: 1.0,
      };
    }

    // Search tasks
    const searchMatch = input.match(
      /^(search|find|look)\s+(?:for\s+)?(?:tasks?\s+)?["\']?([^"']+)["\']?$/i
    );
    if (searchMatch) {
      return {
        action: "searchTasks",
        params: { query: searchMatch[2].trim() },
        confidence: 0.85,
      };
    }

    // Navigate to workspace - with specific name
    const navWorkspaceMatch = input.match(
      /^(go|navigate|switch|redirect)\s+to\s+([^\s]+)\s+workspace$/i
    );
    if (navWorkspaceMatch) {
      return {
        action: "navigateToWorkspace",
        params: { workspaceSlug: navWorkspaceMatch[2].trim() },
        confidence: 0.95,
      };
    }

    // Navigate to workspace - general request (should list workspaces first)
    if (
      (lower.includes("redirect") && lower.includes("workspace")) ||
      (lower.includes("go to") && lower.includes("workspace")) ||
      (lower.includes("navigate") && lower.includes("workspace")) ||
      (lower.includes("switch") && lower.includes("workspace"))
    ) {
      // If no specific workspace mentioned, list them
      if (!lower.match(/\b(development|marketing|personal|operations|dev|prod|staging|test)\b/)) {
        return {
          action: "listWorkspaces",
          params: {},
          confidence: 0.9,
        };
      }
    }

    // Navigate to project
    const navProjectMatch = input.match(/^(go|navigate|switch)\s+to\s+([^\s]+)\s+project$/i);
    if (navProjectMatch) {
      return {
        action: "navigateToProject",
        params: { projectSlug: navProjectMatch[2].trim() },
        confidence: 0.95,
      };
    }

    // Create workspace
    const createWorkspaceMatch = input.match(/^create\s+(?:a\s+)?workspace\s+(?:called\s+)?(.+)$/i);
    if (createWorkspaceMatch) {
      return {
        action: "createWorkspace",
        params: { name: createWorkspaceMatch[1].trim() },
        confidence: 0.95,
      };
    }

    // Create project
    const createProjectMatch = input.match(/^create\s+(?:a\s+)?project\s+(?:called\s+)?(.+)$/i);
    if (createProjectMatch) {
      return {
        action: "createProject",
        params: { name: createProjectMatch[1].trim() },
        confidence: 0.95,
      };
    }

    // Delete task (careful!)
    const deleteTaskMatch = input.match(/^delete\s+task\s+["\']?([^"']+)["\']?$/i);
    if (deleteTaskMatch) {
      return {
        action: "deleteTask",
        params: { taskId: deleteTaskMatch[1].trim() },
        confidence: 0.8, // Lower confidence for destructive actions
      };
    }

    // Check auth status
    if (lower.match(/^(am\s+i|check\s+if\s+i['']?m)\s+(logged\s+in|authenticated|signed\s+in)$/)) {
      return {
        action: "checkAuthenticationStatus",
        params: {},
        confidence: 1.0,
      };
    }

    // Logout
    if (lower.match(/^(log\s*out|logout|sign\s*out)$/)) {
      return {
        action: "logout",
        params: {},
        confidence: 1.0,
      };
    }

    return null;
  }

  // Get suggested commands based on partial input
  getSuggestions(partial: string): string[] {
    const suggestions = [
      "list workspaces",
      "list projects",
      "create task [name]",
      "mark [task] as done",
      "show high priority tasks",
      "clear filters",
      "search [keyword]",
      "create workspace [name]",
      "create project [name]",
      "go to [workspace] workspace",
    ];

    const lower = partial.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().startsWith(lower));
  }
}

export const commandParser = new LocalCommandParser();

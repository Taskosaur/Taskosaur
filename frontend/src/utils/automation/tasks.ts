/**
 * Task management automation functions
 */

import {
  AutomationResult,
  waitForElement,
  simulateClick,
  simulateTyping,
  navigateTo,
  waitFor,
  generateSlug,
} from "./helpers";
import { taskStatusApi } from "../api/taskStatusApi";
import { projectApi } from "../api/projectApi";
function buildTasksUrl(workspaceSlug?: string, projectSlug?: string, suffix?: string): string {
  let baseUrl = "";

  if (workspaceSlug && projectSlug) {
    baseUrl = `/${workspaceSlug}/${projectSlug}/tasks`;
  } else if (workspaceSlug) {
    baseUrl = `/${workspaceSlug}/tasks`;
  } else {
    baseUrl = "/tasks";
  }

  return suffix ? `${baseUrl}/${suffix}` : baseUrl;
}

// Helper for PointerEvent click sequence (works better with React)
function pointerClick(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse", clientX: x, clientY: y, buttons: 1 }));
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse", clientX: x, clientY: y, buttons: 0 }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y, detail: 1 }));
}

/**
 * Create a new task with enhanced DOM automation
 */
export async function createTask(
  workspaceSlug: string,
  projectSlug: string,
  taskTitle: string,
  options: {
    priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
    description?: string;
    dueDate?: string;
    assignee?: string;
    reporter?: string;
    labels?: string[];
    timeout?: number;
  } = {}
): Promise<AutomationResult> {
  const {
    priority = "MEDIUM",
    description = "",
    dueDate,
    assignee,
    labels = [],
    timeout = 5000,
  } = options;

  try {
    // Navigate directly to the new task creation page
    const createTaskUrl = `/${workspaceSlug}/${projectSlug}/tasks/new`;
    await navigateTo(createTaskUrl);

    // Wait for the task creation page to load
    try {
      await waitForElement(".dashboard-container", timeout);
      // Additional check for the form elements
      await waitForElement("form, input#title", timeout / 2);
    } catch (error) {
      await waitFor(2000); // Give page time to load

      // Check if we're on the task creation page
      const isTaskCreationPage =
        window.location.pathname.includes("/tasks/new") ||
        Array.from(document.querySelectorAll("h1")).some((h1) =>
          h1.textContent?.includes("Create New Task")
        );
      if (!isTaskCreationPage) {
        throw new Error("Task creation page did not load properly", error);
      }
    }

    await waitFor(1000); // Give page time to stabilize

    // Since we're now on the task creation page directly, no need to click a button
    // Wait for the form to be ready
    await waitFor(1000);

    // The form should be immediately available on this page
    const taskForm = document.querySelector("form");
    if (!taskForm) {
      throw new Error("Task creation form not found on the page");
    }

    // Find the specific title input field (from the HTML: input#title)
    const titleSelectors = [
      "input#title",
      'input[name="title"]',
      'input[placeholder*="What needs to be done"]',
      'input[placeholder*="title" i]',
      'input[id*="title"]',
      'input[class*="title"]',
      'input[data-testid*="title"]',
      'input[type="text"]:first-of-type',
    ];

    let titleInput: HTMLInputElement | null = null;

    for (const selector of titleSelectors) {
      titleInput = document.querySelector(selector) as HTMLInputElement;
      if (titleInput) {
        break;
      }
    }

    if (!titleInput) {
      // Log available inputs for debugging
      throw new Error("Task title input field not found");
    }

    // Fill title with React-compatible approach
    titleInput.focus();
    titleInput.click();
    await waitFor(200);

    // Clear any existing value first (HTML shows it has "My 1st Task" as default)
    titleInput.select(); // Select all existing text
    titleInput.value = "";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(200);

    // Use React-compatible value setting
    const titleValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (titleValueSetter) {
      titleValueSetter.call(titleInput, taskTitle);
    } else {
      titleInput.value = taskTitle;
    }

    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(500);

    // Set mandatory Status field (default to first status, usually "To Do")
    const statusSelectors = [
      'button[role="combobox"]', // Will check text content manually
      '[data-slot="select-trigger"]',
      'button[aria-expanded="false"]',
      'select[name="status"]',
      'select[id*="status"]',
    ];

    let statusButton: Element | null = null;

    // Find status dropdown by checking text content
    const allComboboxes = document.querySelectorAll('button[role="combobox"]');
    for (const combobox of allComboboxes) {
      const text = combobox.textContent?.toLowerCase() || "";
      if (text.includes("select a status") || text.includes("status")) {
        statusButton = combobox;
        break;
      }
    }

    // Fallback to other selectors if not found by text
    if (!statusButton) {
      for (const selector of statusSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          // Skip if this looks like priority or assignee dropdown
          const text = element.textContent?.toLowerCase() || "";
          if (
            !text.includes("medium") &&
            !text.includes("assignee") &&
            !text.includes("reporter")
          ) {
            statusButton = element;
            break;
          }
        }
        if (statusButton) break;
      }
    }

    if (statusButton) {
      await simulateClick(statusButton);
      await waitFor(1000);

      // Look for status options (usually "To Do", "In Progress", "Done")
      const statusOptions = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [data-slot="item"], .select-item, .option'
      );

      for (const option of statusOptions) {
        const optionText = option.textContent?.trim().toLowerCase() || "";
        if (
          optionText === "to do" ||
          optionText === "todo" ||
          optionText === "open" ||
          optionText === "new" ||
          optionText === "backlog"
        ) {
          await simulateClick(option);
          await waitFor(500);
          break;
        }
      }

      // If no specific status found, just click the first option
      if (statusOptions.length > 0) {
        await simulateClick(statusOptions[0]);
        await waitFor(500);
      }
    }

    // Set mandatory Priority field (default to Medium if not already set)

    // Find priority dropdown by checking if it contains "Medium" or "Select" text
    const allButtons = document.querySelectorAll('button[role="combobox"]');
    let priorityButton: Element | null = null;

    for (const button of allButtons) {
      const text = button.textContent?.toLowerCase() || "";
      if (text.includes("medium") || text.includes("priority")) {
        priorityButton = button;
        break;
      }
    }

    // Check if priority needs to be set (if it doesn't already show "Medium")
    if (priorityButton && !priorityButton.textContent?.includes("Medium")) {
      await simulateClick(priorityButton);
      await waitFor(1000);

      const priorityOptions = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [data-slot="item"]'
      );

      for (const option of priorityOptions) {
        const optionText = option.textContent?.trim().toLowerCase() || "";
        if (optionText === "medium") {
          await simulateClick(option);
          await waitFor(500);
          break;
        }
      }
    }

    // Find assignee dropdown by text content
    let assigneeButton: Element | null = null;
    const assigneeComboboxes = document.querySelectorAll('button[role="combobox"]');

    for (const combobox of assigneeComboboxes) {
      const text = combobox.textContent?.toLowerCase() || "";
      if (text.includes("select assignee") || text.includes("assignee")) {
        assigneeButton = combobox;
        break;
      }
    }

    // Also check for reporter dropdown as fallback
    if (!assigneeButton) {
      for (const combobox of assigneeComboboxes) {
        const text = combobox.textContent?.toLowerCase() || "";
        if (text.includes("select reporter") || text.includes("reporter")) {
          continue;
        }

        // If we can't find specific assignee dropdown, use any remaining dropdown
        if (!text.includes("status") && !text.includes("medium") && !text.includes("priority")) {
          assigneeButton = combobox;
          break;
        }
      }
    }

    if (assigneeButton) {
      await simulateClick(assigneeButton);
      await waitFor(1000);

      // Look for current user in the options (usually first option or "Me" or current user name)
      const assigneeOptions = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [data-slot="item"], .select-item, .option'
      );

      let assigneeSet = false;
      for (const option of assigneeOptions) {
        const optionText = option.textContent?.trim().toLowerCase() || "";
        if (
          optionText === "me" ||
          optionText.includes("jane smith") ||
          optionText.includes("current user") ||
          optionText.includes("assign to me")
        ) {
          await simulateClick(option);
          await waitFor(500);
          assigneeSet = true;
          break;
        }
      }

      // If no specific assignee found, just click the first option (usually current user)
      if (!assigneeSet && assigneeOptions.length > 0) {
        await simulateClick(assigneeOptions[0]);
        await waitFor(500);
      }
    }

    // Optional: Set description if provided (using the specific markdown editor)
    if (description) {
      const descSelectors = [
        ".w-md-editor-text-input", // Specific to the markdown editor
        'textarea[placeholder*="Describe the task"]',
        ".w-md-editor textarea",
        'textarea[name="description"]',
        'textarea[placeholder*="description" i]',
        'textarea[id*="description"]',
      ];

      for (const selector of descSelectors) {
        const descInput = document.querySelector(selector) as HTMLTextAreaElement;
        if (descInput) {
          descInput.focus();
          descInput.click();
          await waitFor(200);

          // Clear any existing content
          descInput.value = "";
          descInput.dispatchEvent(new Event("input", { bubbles: true }));
          await waitFor(100);

          // Set new content
          descInput.value = description;
          descInput.dispatchEvent(new Event("input", { bubbles: true }));
          descInput.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(300);
          break;
        }
      }
    }

    // Find the submit button (from HTML: button[type="submit"] with "Create Task")
    let submitButton: Element | null = null;

    const submitSelectors = [
      "#submit-form-button button:last-of-type", // The "Create Task" button is the last button in the container
      'button[type="submit"]',
      "#submit-form-button button",
    ];

    for (const selector of submitSelectors) {
      submitButton = document.querySelector<HTMLButtonElement>(selector);
      if (submitButton) {
        break;
      }
    }

    // Fallback: look for any button with "Create Task" text
    if (!submitButton) {
      const allButtons = document.querySelectorAll("button");
      for (const button of allButtons) {
        const text = button.textContent?.trim() || "";
        if (text === "Create Task" || text.includes("Creating")) {
          submitButton = button;
          break;
        }
      }
    }

    // Additional fallback: look for disabled submit button (may become enabled after filling fields)
    if (!submitButton) {
      const disabledButtons = document.querySelectorAll("button[disabled]");
      for (const button of disabledButtons) {
        const text = button.textContent?.trim() || "";
        if (text === "Create Task") {
          submitButton = button;
          break;
        }
      }
    }

    if (!submitButton) {
      throw new Error("Submit button not found");
    }

    // If button is still disabled, try to enable it by triggering form validation
    if (submitButton.hasAttribute("disabled")) {
      // Focus on the form to trigger validation
      const form = document.querySelector("form");
      if (form) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await waitFor(500);
      }
    }
    if (submitButton instanceof HTMLButtonElement && submitButton.disabled) {
      console.warn("⚠️ Submit button is still disabled. Validation might not have run yet.");
    }

    await simulateClick(submitButton);

    // Wait for task creation to complete
    await waitFor(3000);

    // Check if we've navigated away from the /new page (success indicator)
    const currentPath = window.location.pathname;
    const navigatedAway = !currentPath.includes("/tasks/new");

    if (!navigatedAway) {
      // Look for specific error messages (exclude page titles and form labels)
      const errorSelectors = [
        ".alert-destructive",
        ".error-message",
        ".form-error",
        '[role="alert"][class*="error"]',
        ".text-destructive:not(h1):not(h2):not(h3):not(label)",
        ".bg-destructive",
        ".border-destructive",
      ];

      let hasErrors = false;
      let errorText = "";

      for (const selector of errorSelectors) {
        const errorElements = document.querySelectorAll(selector);
        if (errorElements.length > 0) {
          errorText = Array.from(errorElements)
            .map((e) => e.textContent?.trim())
            .filter(
              (text) =>
                text &&
                text.length > 3 &&
                !text.includes("Create New Task") &&
                !text.includes("Task Title") &&
                !text.includes("What needs to be done")
            )
            .join("; ");

          if (errorText) {
            hasErrors = true;
            break;
          }
        }
      }

      if (hasErrors) {
        throw new Error(`Task creation failed: ${errorText}`);
      }
    }

    // Final success determination - if we made it here without throwing an error, it's successful
    const creationSuccess = true;

    const taskSlug = generateSlug(taskTitle);

    return {
      success: true,
      message: `Task "${taskTitle}" created successfully`,
      data: {
        taskTitle,
        slug: taskSlug,
        priority,
        description,
        dueDate,
        assignee,
        labels,
        workspaceSlug,
        projectSlug,
        creationSuccess,
        currentPath: window.location.pathname,
      },
    };
  } catch (error) {
    console.error("Task creation failed:", error);
    return {
      success: false,
      message: "Failed to create task",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  workspaceSlug: string,
  projectSlug: string,
  taskTitle: string,
  newStatus: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to the tasks page first
    const tasksUrl = buildTasksUrl(workspaceSlug, projectSlug);
    await navigateTo(tasksUrl);

    // Wait for page to load
    await waitForElement(".dashboard-container, .space-y-6", timeout);
    await waitFor(1000);

    // Find the task by title
    const taskRows = document.querySelectorAll('.tasktable-row, tbody tr[data-slot="table-row"]');
    let targetTaskRow: Element | null = null;

    for (const row of taskRows) {
      const titleElement = row.querySelector(".tasktable-task-title, .task-title");
      const title = titleElement?.textContent?.trim();

      if (title && title.toLowerCase() === taskTitle.toLowerCase()) {
        targetTaskRow = row;
        break;
      }
    }

    if (!targetTaskRow) {
      throw new Error(`Task with title "${taskTitle}" not found`);
    }

    // Click on the task to open the detail view
    const taskTitleElement = targetTaskRow.querySelector(".tasktable-task-title, .task-title");
    if (taskTitleElement) {
      await simulateClick(taskTitleElement);
      await waitFor(1500); // Wait for modal/detail view to open
    }

    // Find the status dropdown in the detail view (look specifically under "Status" label)
    let statusDropdown: Element | null = null;

    // First, find the Status label and then look for the dropdown button below it
    const allLabels = document.querySelectorAll("label");
    let statusSection: Element | null = null;

    for (const label of allLabels) {
      if (label.textContent?.trim() === "Status") {
        statusSection = label.closest("div")?.parentElement || label.parentElement;
        break;
      }
    }

    if (statusSection) {
      const editButton = statusSection.querySelector('button[aria-label="Edit Status"]');
      if (editButton) {
        await simulateClick(editButton);
        await waitFor(500);
      }

      statusDropdown = statusSection.querySelector(
        'button[data-slot="dropdown-menu-trigger"], button[aria-haspopup="menu"]'
      );
    }

    // Fallback: look for dropdown button that contains status text
    if (!statusDropdown) {
      const buttons = document.querySelectorAll(
        'button[data-slot="dropdown-menu-trigger"], button[aria-haspopup="menu"]'
      );
      for (const button of buttons) {
        const buttonText = button.textContent?.trim().toLowerCase() || "";
        // Check if this button contains status-related text
        if (
          buttonText.includes("to do") ||
          buttonText.includes("in progress") ||
          buttonText.includes("done") ||
          buttonText.includes("completed") ||
          buttonText.includes("open") ||
          buttonText.includes("closed")
        ) {
          statusDropdown = button;
          break;
        }
      }
    }

    if (!statusDropdown) {
      throw new Error("Status dropdown button not found in task detail view");
    }

    let statusOptions: Element[] = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (statusOptions.length <= 1 && attempts < maxAttempts) {
      attempts++;

      await simulateClick(statusDropdown);
      await waitFor(800);

      if (attempts > 1) {
        // Try mousedown/mouseup events
        statusDropdown.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        await waitFor(100);
        statusDropdown.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        await waitFor(500);

        // Try focus + enter
        if (statusDropdown instanceof HTMLElement) {
          statusDropdown.focus();
          await waitFor(100);
          statusDropdown.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
          );
          await waitFor(500);
        }
      }

      // Look for status options with increasingly broad searches
      const selectors = [
        // Standard dropdown patterns
        '[role="option"], [data-slot="item"], [role="menuitem"]',

        // Radix UI patterns - look in body for portal-rendered content
        'body [data-radix-dropdown-menu-content] [role="menuitem"], ' +
        'body [data-radix-dropdown-menu-content] [data-slot="item"], ' +
        "body [data-radix-dropdown-menu-content] div[data-value], " +
        "body [data-radix-dropdown-menu-content] button",

        // Look for any recently appeared dropdown content
        '[data-state="open"] [role="menuitem"], ' +
        '[aria-expanded="true"] + * [role="menuitem"], ' +
        '.dropdown-menu [role="menuitem"], ' +
        '.popover-content [role="menuitem"]',

        // Look for elements that appeared after our click (using mutation observer approach)
        'body > div[style*="position"], body > div[data-radix-portal]',
      ];

      for (const selector of selectors) {
        const options = Array.from(document.querySelectorAll(selector));

        if (options.length > 0) {
          // Filter for elements that look like status options
          const filteredOptions: Element[] = [];
          for (const option of options) {
            const text = option.textContent?.trim() || "";

            // Check if this looks like a status option
            if (
              text &&
              ([
                "To Do",
                "In Progress",
                "Done",
                "Completed",
                "Open",
                "Closed",
                "Backlog",
                "Review",
                "Todo",
                "In-Progress",
              ].some(
                (status) =>
                  text.toLowerCase() === status.toLowerCase() ||
                  text.toLowerCase().includes(status.toLowerCase()) ||
                  status.toLowerCase().includes(text.toLowerCase())
              ) ||
                // Also accept if it contains the current status we're looking for
                text.toLowerCase() === newStatus.toLowerCase())
            ) {
              filteredOptions.push(option);
            }
          }

          if (filteredOptions.length > statusOptions.length) {
            statusOptions = filteredOptions;
            break;
          }
        }
      }

      // If we still only have 1 or no options, wait a bit more and try again
      if (statusOptions.length <= 1) {
        await waitFor(1000);
      }
    }

    let statusFound = false;

    for (const option of statusOptions) {
      const optionText = option.textContent?.trim();
      if (optionText && optionText.toLowerCase() === newStatus.toLowerCase()) {
        await simulateClick(option);
        statusFound = true;
        await waitFor(500);
        break;
      }
    }

    if (!statusFound) {
      // Log available options for debugging
      const availableOptions = Array.from(statusOptions)
        .map((o) => o.textContent?.trim())
        .filter((t) => t);
      throw new Error(
        `Status option "${newStatus}" not found in dropdown. Available options: ${availableOptions.join(", ")}`
      );
    }

    // Close the modal
    const closeButton = document.querySelector('[aria-label="Close modal"]');
    if (closeButton) {
      await simulateClick(closeButton);
    } else {
      const overlay = document.querySelector(".fixed.inset-0.z-50");
      if (overlay) {
        await simulateClick(overlay);
      }
    }

    await waitFor(500);

    return {
      success: true,
      message: `Task "${taskTitle}" status updated to "${newStatus}"`,
      data: {
        workspaceSlug,
        projectSlug,
        taskTitle,
        newStatus,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update task status`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Navigate to tasks view (list, kanban, gantt)
 */
export async function navigateToTasksView(
  workspaceSlug: string,
  projectSlug: string,
  view: "list" | "kanban" | "gantt" = "list",
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    const validViews = ["list", "kanban", "gantt"];
    if (!validViews.includes(view)) {
      throw new Error(`Invalid view: ${view}. Must be one of: ${validViews.join(", ")}`);
    }

    // Construct URL for the view
    const tasksUrl =
      view === "list"
        ? buildTasksUrl(workspaceSlug, projectSlug)
        : buildTasksUrl(workspaceSlug, projectSlug, view);

    await navigateTo(tasksUrl);

    // Wait for view to load - more specific selectors for task page
    const viewSelectors = [
      ".tasktable-container",
      ".space-y-6",
      ".bg-\\[var\\(--background\\)\\]",
      ".tasks-page",
    ];

    let loaded = false;
    for (const selector of viewSelectors) {
      try {
        await waitForElement(selector, timeout);
        loaded = true;
        break;
      } catch {
        continue;
      }
    }

    if (!loaded) {
      // Wait a bit more and check for any task-related content
      await waitFor(2000);
      const hasTaskContent = document.querySelector(
        '.tasktable-container, [data-slot="table"], .task-card, .kanban'
      );
      if (!hasTaskContent) {
        throw new Error("Tasks page did not load properly");
      }
    }

    return {
      success: true,
      message: `Navigated to ${view} view for ${workspaceSlug}/${projectSlug}`,
      data: { workspaceSlug, projectSlug, view, currentPath: window.location.pathname },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to navigate to ${view} view`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Search for tasks using URL parameters
 */
export async function searchTasks(
  workspaceSlug: string,
  projectSlug: string,
  query: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to tasks page first
    const baseUrl = buildTasksUrl(workspaceSlug, projectSlug);
    await navigateTo(baseUrl);

    // Wait for page to load
    await waitForElement(".dashboard-container, .space-y-6", timeout);
    await waitFor(1000);

    // Find and fill the search input to trigger filtering
    const searchInput = document.querySelector(
      'input[placeholder*="Search"], input[type="search"], input[placeholder*="search"]'
    ) as HTMLInputElement;

    if (!searchInput) {
      throw new Error("Search input not found on the page");
    }

    // Clear existing value and type the new query
    await simulateTyping(searchInput, query || "", { clearFirst: true });
    await waitFor(1500);

    // Count search results (UI should have already filtered them)
    const taskElements = document.querySelectorAll(
      '.tasktable-row, tbody tr[data-slot="table-row"]'
    );
    const resultCount = taskElements.length;

    // Extract task information from filtered results
    const tasks = Array.from(taskElements).map((row, index) => {
      const titleElement = row.querySelector(".tasktable-task-title, .task-title");
      const title = titleElement?.textContent?.trim() || `Task ${index + 1}`;

      // Get all badges in the row
      const badges = row.querySelectorAll('[data-slot="badge"]');
      let status = "Unknown";
      let priority = "Unknown";

      // Iterate through badges to identify status vs priority
      badges.forEach((badge) => {
        const text = badge.textContent?.trim() || "";
        const badgeClasses = badge.className || "";

        // Check if it's a priority badge (these are typically uppercase)
        if (["LOW", "MEDIUM", "HIGH", "HIGHEST"].includes(text.toUpperCase())) {
          priority = text.toUpperCase();
        }
        // Check if it's a status badge (look for status-related classes or common status names)
        else if (
          badgeClasses.includes("status") ||
          ["To Do", "In Progress", "Done", "Completed", "Open", "Closed"].some((s) =>
            text.toLowerCase().includes(s.toLowerCase())
          )
        ) {
          status = text;
        }
      });

      return {
        title,
        status,
        priority,
      };
    });

    // Build search URL for reference
    const searchUrl = query
      ? `${buildTasksUrl(workspaceSlug, projectSlug)}?search=${encodeURIComponent(query)}`
      : buildTasksUrl(workspaceSlug, projectSlug);

    return {
      success: true,
      message: query
        ? `Found ${resultCount} task(s) matching "${query}"`
        : `Showing all ${resultCount} tasks`,
      data: {
        query,
        resultCount,
        tasks,
        searchUrl,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to search tasks`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Filter tasks by priority using UI interaction
 */
export async function filterTasksByPriority(
  workspaceSlug: string,
  projectSlug: string,
  priority: "all" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST",
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 5000 } = options;

  try {
    const tasksUrl = buildTasksUrl(workspaceSlug, projectSlug);
    await navigateTo(tasksUrl);

    await waitForElement(".dashboard-container, .space-y-6", timeout);
    await waitFor(500);

    const filterButton = document.getElementById("filter-dropdown-trigger") as HTMLElement;
    if (!filterButton) {
      throw new Error("Filter dropdown button not found");
    }

    filterButton.click();
    await waitFor(500);

    const dropdownContent = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!dropdownContent) {
      throw new Error("Filter dropdown did not open");
    }

    const sectionHeaders = dropdownContent.querySelectorAll('.cursor-pointer');
    let prioritySectionFound = false;

    for (const header of sectionHeaders) {
      const labelText = header.textContent?.toLowerCase() || "";
      if (labelText.includes("priority")) {
        (header as HTMLElement).click();
        await waitFor(300);
        prioritySectionFound = true;
        break;
      }
    }

    if (!prioritySectionFound) {
      throw new Error("Priority section not found in filter dropdown");
    }

    if (priority === "all") {
      const priorityItems = dropdownContent.querySelectorAll('[data-slot="checkbox"]');
      for (const checkbox of priorityItems) {
        const isChecked = checkbox.getAttribute("data-state") === "checked";
        if (isChecked) {
          const itemRow = checkbox.closest('.cursor-pointer');
          if (itemRow) {
            (itemRow as HTMLElement).click();
            await waitFor(200);
          }
        }
      }
    } else {
      const targetLabel = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
      const allSpans = dropdownContent.querySelectorAll('span');
      let priorityClicked = false;

      for (const span of allSpans) {
        const spanText = span.textContent?.trim() || "";
        if (spanText.toLowerCase() === targetLabel.toLowerCase()) {
          const clickableRow = span.closest('.rounded-md') || span.closest('[class*="cursor"]') || span.parentElement?.parentElement;
          if (clickableRow) {
            (clickableRow as HTMLElement).click();
            await waitFor(500);
            priorityClicked = true;
            break;
          }
        }
      }

      if (!priorityClicked) {
        throw new Error(`Priority option "${priority}" not found`);
      }
    }

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(500);

    // Count and collect filtered results
    const taskElements = document.querySelectorAll(
      '.tasktable-row, tbody tr[data-slot="table-row"]'
    );

    const filteredTasks = Array.from(taskElements).map((row, index) => {
      const titleElement = row.querySelector(".tasktable-task-title, .task-title");

      const badges = row.querySelectorAll('[data-slot="badge"]');
      let taskPriority = "Unknown";

      badges.forEach((badge) => {
        const text = badge.textContent?.trim() || "";
        if (["LOW", "MEDIUM", "HIGH", "HIGHEST"].includes(text.toUpperCase())) {
          taskPriority = text.toUpperCase();
        }
      });

      return {
        title: titleElement?.textContent?.trim() || `Task ${index + 1}`,
        priority: taskPriority,
      };
    });

    return {
      success: true,
      message: `Applied priority filter: ${priority}. Showing ${filteredTasks.length} tasks.`,
      data: {
        priority,
        resultCount: filteredTasks.length,
        filteredTasks,
        workspaceSlug,
        projectSlug,
      },
    };
  } catch (error) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    return {
      success: false,
      message: `Failed to filter tasks by priority: ${priority}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Filter tasks by status using URL parameters (with status name to ID mapping)
 */
export async function filterTasksByStatus(
  workspaceSlug: string,
  projectSlug: string,
  statusName: "all" | string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 5000 } = options;

  try {
    const tasksUrl = buildTasksUrl(workspaceSlug, projectSlug);

    // 1. Ensure we are on the tasks page
    if (window.location.pathname !== tasksUrl) {
      await navigateTo(tasksUrl);
      await waitForElement(".dashboard-container, .space-y-6", timeout);
      await waitFor(500);
    }
    // 2. Open Filter Dropdown
    const filterButton = document.getElementById("filter-dropdown-trigger") as HTMLElement;
    if (!filterButton) {
      const buttons = Array.from(document.querySelectorAll("button"));
      const filterBtn = buttons.find(
        (b) => b.textContent?.includes("Filter") || b.querySelector(".lucide-list-filter")
      );
      if (!filterBtn) throw new Error("Filter dropdown button not found");
      filterBtn.click();
    } else {
      filterButton.click();
    }
    await waitFor(500);

    // 3. Find dropdown content
    const dropdownContent = document.querySelector(
      '[data-slot="dropdown-menu-content"], [role="menu"]'
    );
    if (!dropdownContent) {
      throw new Error("Filter dropdown did not open");
    }

    // 4. Find and expand Status section if needed
    // 5. Click the specific status option
    if (statusName === "all") {
    } else {
      const normalizedStatus = statusName.toLowerCase().trim();

      // Helper to find option
      const findOption = () => {
        const currentOptions = Array.from(
          dropdownContent.querySelectorAll(
            '[role="menuitemcheckbox"], [role="menuitem"], label, span'
          )
        );
        return currentOptions.find((opt) => {
          const text = opt.textContent?.trim().toLowerCase() || "";
          return text === normalizedStatus;
        });
      };

      let targetOption = findOption();

      // If not found, try toggling the status section
      if (!targetOption) {
        const sectionHeaders = Array.from(
          dropdownContent.querySelectorAll('.cursor-pointer, [role="menuitem"]')
        );
        const statusHeader = sectionHeaders.find(
          (h) => h.textContent?.trim().toLowerCase() === "status"
        );

        if (statusHeader) {
          (statusHeader as HTMLElement).click();
          await waitFor(300);
          targetOption = findOption();
        }
      }

      if (targetOption) {
        // Check if already selected
        const checkbox = targetOption.closest('[role="menuitemcheckbox"]') || targetOption;
        const isChecked =
          checkbox.getAttribute("data-state") === "checked" ||
          checkbox.getAttribute("aria-checked") === "true";

        if (!isChecked) {
          (targetOption as HTMLElement).click();
          await waitFor(500);
        }
      } else {
        throw new Error(`Status option "${statusName}" not found in filter menu`);
      }
    }

    // 6. Close dropdown
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(500);

    const taskElements = document.querySelectorAll(
      '.tasktable-row, tbody tr[data-slot="table-row"]'
    );

    const filteredTasks = Array.from(taskElements).map((row, index) => {
      const titleElement = row.querySelector(".tasktable-task-title, .task-title");

      const badges = row.querySelectorAll('[data-slot="badge"]');
      let status = "Unknown";

      badges.forEach((badge) => {
        const text = badge.textContent?.trim() || "";
        const badgeClasses = badge.className || "";

        // Check if it's a status badge
        if (
          badgeClasses.includes("status") ||
          ["To Do", "In Progress", "Done", "Completed", "Open", "Closed"].some((s) =>
            text.toLowerCase().includes(s.toLowerCase())
          )
        ) {
          status = text;
        }
      });

      return {
        title: titleElement?.textContent?.trim() || `Task ${index + 1}`,
        status,
      };
    });

    return {
      success: true,
      message: `Applied status filter: ${statusName}. Showing ${filteredTasks.length} tasks.`,
      data: {
        status: statusName,
        resultCount: filteredTasks.length,
        filteredTasks,
        workspaceSlug,
        projectSlug,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to filter tasks by status: ${statusName}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Filter tasks by both priority and status using URL parameters
 */
export async function filterTasks(
  workspaceSlug: string,
  projectSlug: string,
  filters: any,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 15000 } = options;

  try {
    // Navigate to the tasks page first
    const tasksUrl = buildTasksUrl(workspaceSlug, projectSlug);
    await navigateTo(tasksUrl);

    // Wait for tasks page to load
    await waitForElement(".dashboard-container, .space-y-6", timeout);
    await waitFor(1000);

    // Apply priority filters if provided
    if (filters.priorities && filters.priorities.length > 0) {
      // Apply priority filter using the existing function
      const priorityResult = await filterTasksByPriority(
        workspaceSlug,
        projectSlug,
        filters.priorities,
        { timeout }
      );

      if (!priorityResult.success) {
        throw new Error(`Failed to apply priority filter: ${priorityResult.message}`);
      }

      await waitFor(1000); // Wait for filter to apply
    }

    // Apply status filters if provided
    if (filters.statuses && filters.statuses.length > 0) {
      // Apply status filter using the existing function
      const statusResult = await filterTasksByStatus(workspaceSlug, projectSlug, filters.statuses, {
        timeout,
      });

      if (!statusResult.success) {
        throw new Error(`Failed to apply status filter: ${statusResult.message}`);
      }

      await waitFor(1000); // Wait for filter to apply
    }

    // Count and collect filtered results
    const taskElements = document.querySelectorAll(
      '.tasktable-row, tbody tr[data-slot="table-row"]'
    );

    const filteredTasks = Array.from(taskElements).map((row, index) => {
      const titleElement = row.querySelector(".tasktable-task-title, .task-title");
      const title = titleElement?.textContent?.trim() || `Task ${index + 1}`;

      // Get all badges in the row to identify priority and status
      const badges = row.querySelectorAll('[data-slot="badge"]');
      let status = "Unknown";
      let priority = "Unknown";

      badges.forEach((badge) => {
        const text = badge.textContent?.trim() || "";

        // Check if it's a priority badge
        if (["LOW", "MEDIUM", "HIGH", "HIGHEST"].includes(text.toUpperCase())) {
          priority = text.toUpperCase();
        }
        // Check if it's a status badge
        else if (
          badge.className.includes("status") ||
          ["To Do", "In Progress", "Done", "Completed", "Open", "Closed"].some((s) =>
            text.toLowerCase().includes(s.toLowerCase())
          )
        ) {
          status = text;
        }
      });

      return {
        title,
        priority,
        status,
      };
    });

    // Build a summary message
    const filterSummary: string[] = [];
    if (filters.priorities && filters.priorities.length > 0) {
      filterSummary.push(`priorities: ${filters.priorities.join(", ")}`);
    }
    if (filters.statuses && filters.statuses.length > 0) {
      filterSummary.push(`statuses: ${filters.statuses.join(", ")}`);
    }

    const message =
      filterSummary.length > 0
        ? `Applied filters (${filterSummary.join(", ")}). Showing ${filteredTasks.length} task(s).`
        : `Showing all ${filteredTasks.length} tasks.`;

    return {
      success: true,
      message,
      data: {
        filters,
        resultCount: filteredTasks.length,
        tasks: filteredTasks,
        workspaceSlug,
        projectSlug,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to filter tasks",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Clear all task filters
 */
export async function clearTaskFilters(
  workspaceSlug?: string,
  projectSlug?: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // If slugs not provided, extract from current URL
    let workspace = workspaceSlug;
    let project = projectSlug;

    if (!workspace) {
      const currentPath = window.location.pathname;
      const pathParts = currentPath.split("/").filter((p) => p);

      if (pathParts[0] === "tasks") {
        workspace = undefined;
        project = undefined;
      } else if (pathParts.length >= 2 && pathParts[1] === "tasks") {
        workspace = pathParts[0];
        project = undefined;
      } else if (pathParts.length >= 3 && pathParts[2] === "tasks") {
        workspace = pathParts[0];
        project = pathParts[1];
      } else if (pathParts.length >= 1 && pathParts[0] !== "tasks") {
        workspace = pathParts[0];
        project = pathParts.length >= 2 && pathParts[1] !== "tasks" ? pathParts[1] : undefined;
      }
    }

    const tasksUrl = buildTasksUrl(workspace, project);
    await navigateTo(tasksUrl);

    await waitForElement(".dashboard-container, .space-y-6", timeout);
    await waitFor(1000);

    const filterButton = document.getElementById("filter-dropdown-trigger") as HTMLElement;
    if (!filterButton) {
      throw new Error("Filter dropdown button not found");
    }

    filterButton.click();
    await waitFor(500);

    const clearButton = document.querySelector(
      '[data-slot="dropdown-menu-content"] button.h-5'
    ) as HTMLElement;

    if (!clearButton) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await waitFor(300);

      const taskElements = document.querySelectorAll(
        '.tasktable-row, tbody tr[data-slot="table-row"]'
      );
      const resultCount = taskElements.length;

      return {
        success: true,
        message: `No filters are currently applied. Showing ${resultCount} tasks.`,
        data: {
          workspace,
          project,
          resultCount,
          filtersCleared: false,
          currentUrl: window.location.href,
        },
      };
    }

    clearButton.click();
    await waitFor(500);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(500);

    const taskElements = document.querySelectorAll(
      '.tasktable-row, tbody tr[data-slot="table-row"]'
    );
    const resultCount = taskElements.length;

    return {
      success: true,
      message: `Filters cleared. Showing ${resultCount} total tasks.`,
      data: {
        workspace,
        project,
        resultCount,
        filtersCleared: true,
        currentUrl: window.location.href,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to clear task filters",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get task details by task name/title
 */
export async function getTaskDetails(
  workspaceSlug: string,
  projectSlug: string,
  taskIdentifier: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to tasks page if needed
    const currentPath = window.location.pathname;
    const expectedPath = buildTasksUrl(workspaceSlug, projectSlug);

    if (!currentPath.startsWith(expectedPath)) {
      await navigateTo(expectedPath);
      await waitForElement(".dashboard-container, .space-y-6", timeout);
      await waitFor(500);
    }

    let taskElement: Element | null = null;

    const taskCards = document.querySelectorAll(
      '.task-card, .task-item, [data-testid^="task-"], .cursor-pointer'
    );
    for (const card of taskCards) {
      const titleElement = card.querySelector(".task-title, h3, h4, .font-medium");
      if (titleElement?.textContent?.includes(taskIdentifier)) {
        taskElement = card;
        break;
      }
    }

    if (!taskElement) {
      throw new Error(`Task "${taskIdentifier}" not found`);
    }

    await simulateClick(taskElement);

    await waitForElement('.fixed.inset-0.z-50, [role="dialog"], .task-detail', timeout);
    await waitFor(500);

    const titleElement = document.querySelector(
      'h1.text-xl.font-bold, .task-title, [data-testid="task-title"]'
    );

    const badges = document.querySelectorAll('[data-slot="badge"]');
    let status = "Unknown";
    let priority = "Unknown";

    badges.forEach((badge) => {
      const text = badge.textContent?.trim() || "";
      if (text.includes("To Do") || text.includes("In Progress") || text.includes("Done")) {
        status = text;
      } else if (text.includes("Priority")) {
        priority = text.replace(" Priority", "");
      }
    });

    // Description from the description section
    const descriptionElement = document.querySelector(
      '.wmde-markdown p, .task-description, [data-testid="task-description"]'
    );
    let description = descriptionElement?.textContent?.trim() || "";
    if (description === "No description provided") {
      description = "";
    }

    // Assignee from dropdown button text (if assigned)
    const assigneeDropdowns = document.querySelectorAll('button[aria-haspopup="menu"] span');
    let assignee = "Unassigned";

    for (const dropdown of assigneeDropdowns) {
      const text = dropdown.textContent?.trim() || "";
      if (text.includes("Select assignee")) {
        assignee = "Unassigned";
        break;
      } else if (text && text !== "Select assignee..." && !text.includes("Select")) {
        assignee = text;
        break;
      }
    }

    // Due date (if available)
    const dueDateElement = document.querySelector('.task-due-date, [data-testid="task-due-date"]');
    const dueDate = dueDateElement?.textContent?.trim() || null;

    const taskDetails = {
      title: titleElement?.textContent?.trim() || taskIdentifier,
      description,
      status,
      priority,
      assignee,
      dueDate,
      workspaceSlug,
      projectSlug,
    };

    return {
      success: true,
      message: `Retrieved details for task: ${taskDetails.title}`,
      data: { task: taskDetails },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get task details for: ${taskIdentifier}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Delete a task
 */
export async function deleteTask(
  workspaceSlug: string,
  projectSlug: string,
  taskIdentifier: string, // Can be task title or ID
  options: { timeout?: number; confirmDeletion?: boolean } = {}
): Promise<AutomationResult> {
  const { timeout = 10000, confirmDeletion = true } = options;

  try {
    const currentPath = window.location.pathname;
    const expectedPath = buildTasksUrl(workspaceSlug, projectSlug);

    if (!currentPath.startsWith(expectedPath)) {
      await navigateTo(expectedPath);
      await waitForElement(".dashboard-container, .space-y-6", timeout);
      await waitFor(500);
    }

    let taskElement: Element | null = null;

    const taskCards = document.querySelectorAll(
      '.task-card, .task-item, [data-testid^="task-"], .cursor-pointer'
    );
    for (const card of taskCards) {
      const titleElement = card.querySelector(".task-title, h3, h4, .font-medium");
      if (titleElement?.textContent?.includes(taskIdentifier)) {
        taskElement = card;
        break;
      }
    }

    if (!taskElement) {
      throw new Error(`Task "${taskIdentifier}" not found`);
    }

    await simulateClick(taskElement);

    await waitForElement('.fixed.inset-0.z-50, [role="dialog"], .task-detail', timeout);
    await waitFor(1000);

    let deleteButton: HTMLElement | null = null;
    for (let i = 0; i < 10 && !deleteButton; i++) {
      deleteButton = document.getElementById("delete-task-button");
      if (!deleteButton) await waitFor(200);
    }
    if (!deleteButton) throw new Error("Delete button not found");

    pointerClick(deleteButton);
    await waitFor(500);

    if (confirmDeletion) {
      let confirmBtn: HTMLElement | null = null;
      for (let i = 0; i < 10 && !confirmBtn; i++) {
        confirmBtn = Array.from(document.querySelectorAll('button[type="submit"]'))
          .find(b => b.textContent?.includes('Delete')) as HTMLElement | null;
        if (!confirmBtn) await waitFor(200);
      }
      if (confirmBtn) pointerClick(confirmBtn);
      await waitFor(100);

      window.location.reload();

      return {
        success: true,
        message: `Task "${taskIdentifier}" deleted successfully`,
        data: { taskIdentifier, workspaceSlug, projectSlug },
      };
    } else {
      const cancelButton =
        document.querySelector(".confirmationmodal-cancel") ||
        document.querySelector(".confirmationmodal-footer button:last-child");

      if (cancelButton) {
        await simulateClick(cancelButton);
      }

      return {
        success: true,
        message: "Task deletion cancelled",
        data: {
          taskIdentifier,
          action: "cancelled",
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete task: ${taskIdentifier}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

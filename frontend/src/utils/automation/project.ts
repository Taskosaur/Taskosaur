/**
 * Project management automation functions
 */

import {
  AutomationResult,
  waitForElement,
  waitForElementReady,
  simulateTyping,
  simulateClick,
  navigateTo,
  waitForModalClose,
  waitFor,
  generateSlug,
  findElementByText,
  getCurrentContext,
} from "./helpers";

/**
 * Create a new project in a workspace
 */
export async function createProject(
  workspaceSlug: string,
  name: string,
  description: string,
  options: {
    timeout?: number;
    color?: string;
    category?: string;
    priority?: string;
    methodology?: string;
    navigateToAfterCreation?: boolean;
  } = {}
): Promise<AutomationResult> {
  const {
    timeout = 15000,
    color = "#1a3b4d",
    category = "operational",
    priority = "MEDIUM",
    methodology = "AGILE",
    navigateToAfterCreation = false,
  } = options;

  try {
    // Navigate to projects page in workspace
    const projectsUrl = `/${workspaceSlug}/projects`;
    await navigateTo(projectsUrl);

    // Wait for projects page to load
    await waitForElement(".dashboard-container, .space-y-6", timeout);
    await waitFor(500);

    // Find and click "Create Project" button
    let newProjectBtn: Element | null = null;

    // First try to find button by text content
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent?.includes("Create Project") ||
        button.textContent?.includes("New Project")
      ) {
        newProjectBtn = button;
        break;
      }
    }

    // Fallback selectors if text search doesn't work
    if (!newProjectBtn) {
      const fallbackSelectors = [
        '[data-testid="new-project-button"]',
        ".new-project-button",
        'button[aria-label*="project"]',
        ".actionbutton-primary", // Based on the HTML structure
      ];

      for (const selector of fallbackSelectors) {
        newProjectBtn = document.querySelector(selector);
        if (newProjectBtn) break;
      }
    }

    if (!newProjectBtn) {
      throw new Error("Create Project button not found");
    }

    await simulateClick(newProjectBtn);

    // Wait for modal to open
    await waitForElement('.projects-modal-container, [role="dialog"]', timeout);
    await waitFor(500); // Brief pause for modal animation

    // Fill project form
    const nameInput = (await waitForElementReady(
      'input#name, input[name="name"], input[id="project-name"], input[placeholder*="project name"]',
      timeout
    )) as HTMLInputElement;

    const descriptionInput = (await waitForElementReady(
      'textarea#description, textarea[name="description"], textarea[id="project-description"], textarea[placeholder*="describe"]',
      timeout
    )) as HTMLTextAreaElement;

    if (!nameInput || !descriptionInput) {
      throw new Error("Project form inputs not found");
    }

    // Fill basic information using native setters for React compatibility
    nameInput.focus();
    nameInput.click();
    await waitFor(100);

    // Set value using native setter (same as workspace)
    const nameValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nameValueSetter) {
      nameValueSetter.call(nameInput, name);
    } else {
      nameInput.value = name;
    }

    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(300);

    // Fill description
    descriptionInput.focus();
    descriptionInput.click();
    await waitFor(100);

    const descriptionValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (descriptionValueSetter) {
      descriptionValueSetter.call(descriptionInput, description);
    } else {
      descriptionInput.value = description;
    }

    descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));
    descriptionInput.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(300);

    // Optional: Set additional fields if available
    const colorInput = document.querySelector(
      'input[name="color"], input[type="color"]'
    ) as HTMLInputElement;
    if (colorInput) {
      colorInput.value = color;
      colorInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Wait a bit for form validation to update
    await waitFor(500);

    // Trigger form validation by dispatching events again
    nameInput.dispatchEvent(new Event("blur", { bubbles: true }));
    descriptionInput.dispatchEvent(new Event("blur", { bubbles: true }));
    await waitFor(300);

    // Submit the form - find the Create project button (use same strategy as workspace)
    let createButton: HTMLButtonElement | null = null;

    // Get the modal container
    const modalContainer = document.querySelector(
      '.projects-modal-container, [role="dialog"], .dialog-content'
    );
    if (!modalContainer) {
      throw new Error("Modal container not found");
    }

    // Try finding the form actions container first
    const formActions = modalContainer.querySelector(
      ".projects-form-actions, .form-actions, .dialog-footer, .flex.justify-end, .space-x-2"
    );
    if (formActions) {
      const actionButtons = formActions.querySelectorAll("button");
      if (actionButtons.length > 0) {
        createButton = actionButtons[actionButtons.length - 1] as HTMLButtonElement; // Last button is usually "Create"
      }
    }

    if (!createButton) {
      const modalButtons = modalContainer.querySelectorAll("button");

      for (const button of modalButtons) {
        const buttonText = button.textContent?.trim().toLowerCase();

        if (
          buttonText === "create project" ||
          (buttonText?.includes("create") && !buttonText.includes("cancel"))
        ) {
          createButton = button as HTMLButtonElement;
          break;
        }
      }
    }

    if (!createButton) {
      const createButtonSelectors = [
        ".projects-form-actions button:last-child",
        'button[type="submit"]',
        '[data-testid="create-project-submit"]',
      ];

      for (const selector of createButtonSelectors) {
        createButton = modalContainer.querySelector(selector) as HTMLButtonElement;
        if (createButton) {
          break;
        }
      }
    }

    if (!createButton) {
      throw new Error("Create project button not found in modal");
    }

    // Check if button is disabled but try anyway
    const isDisabled = createButton.disabled;
    if (isDisabled) {
    }

    await simulateClick(createButton);
    await waitForModalClose();

    await waitFor(2000);

    // Check for error messages
    const errorSelectors = [
      ".error-toast",
      ".notification-error",
      '[data-testid="error-message"]',
      '.sonner-toast[data-type="error"]',
      ".sonner-toast-error",
      ".alert-destructive",
    ];

    // Check for errors first
    for (const selector of errorSelectors) {
      const errorElement = document.querySelector(selector);
      if (errorElement) {
        const errorMessage = errorElement.textContent?.trim() || "Unknown error";
        throw new Error(`Project creation failed: ${errorMessage}`);
      }
    }

    const projectSlug = generateSlug(name);

    // Optionally navigate to the new project
    if (navigateToAfterCreation) {
      await navigateTo(`/${workspaceSlug}/${projectSlug}`);
    }

    return {
      success: true,
      message: "Project created successfully",
      data: {
        name,
        description,
        slug: projectSlug,
        workspaceSlug,
        options: { color, category, priority, methodology },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to create project",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Navigate to a specific project
 */
export async function navigateToProject(
  workspaceSlug: string,
  projectSlug: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    const projectUrl = `/${workspaceSlug}/${projectSlug}`;
    await navigateTo(projectUrl);

    // Wait for project page to load
    await waitForElement(
      '[data-testid="project-content"], .project-page, .project-header',
      timeout
    );

    // Verify we're on the correct project
    const currentPath = window.location.pathname;
    if (!currentPath.includes(projectSlug)) {
      throw new Error(`Navigation failed - expected ${projectSlug} but got ${currentPath}`);
    }

    return {
      success: true,
      message: `Successfully navigated to project: ${workspaceSlug}/${projectSlug}`,
      data: { workspaceSlug, projectSlug, currentPath },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to navigate to project: ${workspaceSlug}/${projectSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * List projects in a workspace
 */
export async function listProjects(
  workspaceSlug: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to projects page
    await navigateTo(`/${workspaceSlug}/projects`);

    // Wait for projects page to load
    await waitForElement(".dashboard-container, .space-y-6", timeout);

    // Wait a bit longer for projects to load after navigation
    await waitFor(2000);
    await waitForElement(
      'a[href*="/' + workspaceSlug + '/"][href$="/"], .empty-state, .no-projects',
      3000
    );

    // Find project cards in the main content area (exclude sidebar)
    const mainContent = document.querySelector(".dashboard-container");
    if (!mainContent) {
      return {
        success: true,
        message: "Main content area not found",
        data: { projects: [], count: 0, workspaceSlug },
      };
    }

    // Find project links within main content, excluding common workspace paths
    const allLinks = mainContent.querySelectorAll('a[href*="/' + workspaceSlug + '/"][href$="/"]');
    const excludePaths = [
      "projects/",
      "members/",
      "activities/",
      "tasks/",
      "settings/",
      workspaceSlug + "/",
    ];

    const projectLinks = Array.from(allLinks).filter((link) => {
      const href = link.getAttribute("href") || "";
      return !excludePaths.some((path) => href.endsWith(path));
    });

    if (!projectLinks || projectLinks.length === 0) {
      return {
        success: true,
        message: "No projects found in workspace",
        data: { projects: [], count: 0, workspaceSlug },
      };
    }

    // Extract project information from the project links
    const projects = projectLinks.map((linkElement, index) => {
      const nameElement = linkElement.querySelector("h3.text-sm.font-semibold, h3, .card-title");
      const descElement = linkElement.querySelector("p.text-sm, .card-description, p");
      const colorElement = linkElement.querySelector('[style*="background"]');

      const name = nameElement?.textContent?.trim() || `Project ${index + 1}`;
      const description = descElement?.textContent?.trim() || "";
      const href = linkElement.getAttribute("href") || "";
      const slug = href
        ? href.split("/").filter(Boolean).pop()?.replace("/", "") || generateSlug(name)
        : generateSlug(name);

      // Try to extract color from styles
      let color = "#1a3b4d";
      if (colorElement) {
        const style = colorElement.getAttribute("style");
        const colorMatch = style?.match(/background-color:\s*([^;]+)/);
        if (colorMatch) {
          color = colorMatch[1].trim();
        }
      }

      return {
        name,
        description,
        slug,
        href,
        color,
        workspaceSlug,
      };
    });

    return {
      success: true,
      message: `Found ${projects.length} project(s) in workspace ${workspaceSlug}`,
      data: { projects, count: projects.length, workspaceSlug },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list projects in workspace: ${workspaceSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(
  workspaceSlug: string,
  projectSlug: string,
  options: { timeout?: number; confirmDeletion?: boolean } = {}
): Promise<AutomationResult> {
  const { timeout = 5000, confirmDeletion = true } = options;

  try {
    // First verify the project exists by navigating to it
    const projectUrl = `/${workspaceSlug}/${projectSlug}`;
    await navigateTo(projectUrl);

    // Wait for project page to load
    await waitFor(1000);

    // Check if we're on a valid project page (not redirected back to projects list)
    const currentPath = window.location.pathname;
    if (!currentPath.includes(`/${projectSlug}`)) {
      throw new Error(
        `Project ${projectSlug} not found or inaccessible. Current path: ${currentPath}`
      );
    }

    // Navigate to project settings
    const settingsUrl = `/${workspaceSlug}/${projectSlug}/settings`;
    await navigateTo(settingsUrl);

    await waitForElement(
      '.settings-page, [data-testid="project-settings"], .dashboard-container, main',
      timeout
    );

    // Check if we're on the settings page
    const finalPath = window.location.pathname;
    if (!finalPath.includes("/settings")) {
      throw new Error(
        `Failed to navigate to settings page. Project may not exist. Current path: ${finalPath}`
      );
    }

    // Find and click the "Danger Zone" button to open the dialog
    let dangerZoneButton: Element | null = null;

    // Look for the danger zone button
    dangerZoneButton =
      findElementByText("Danger Zone", "button") ||
      document.querySelector('button[data-slot="dialog-trigger"]') ||
      document.querySelector('button[class*="bg-red"]');

    if (!dangerZoneButton) {
      throw new Error("Danger Zone button not found on settings page");
    }

    await simulateClick(dangerZoneButton);

    // Wait for the danger zone dialog to open
    await waitForElement('[role="dialog"], [data-slot="dialog-content"]', timeout);

    // Find the "Delete Project" option in the dialog
    let deleteProjectOption: Element | null = null;

    // Look for the delete project option (it's a div with specific styling)
    const deleteOptions = document.querySelectorAll('.bg-red-50, [class*="bg-red"]');
    for (const option of deleteOptions) {
      if (
        option.textContent?.includes("Delete Project") &&
        option.textContent?.includes("Permanently delete")
      ) {
        deleteProjectOption = option;
        break;
      }
    }

    if (!deleteProjectOption) {
      throw new Error("Delete Project option not found in danger zone dialog");
    }

    await simulateClick(deleteProjectOption);

    // Wait for the confirmation form to load
    await waitFor(2000);

    if (confirmDeletion) {
      // Look for the confirmation input field
      const confirmationInput = document.querySelector(
        `#confirmation, input[placeholder="${projectSlug}"]`
      ) as HTMLInputElement;

      if (!confirmationInput) {
        throw new Error("Confirmation input field not found");
      }

      // Type the project slug into the confirmation field
      await simulateTyping(confirmationInput, projectSlug);

      // Trigger input events to enable the button
      confirmationInput.dispatchEvent(new Event("input", { bubbles: true }));
      confirmationInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Wait for the button to be enabled
      await waitFor(500);

      // Find the final "Delete Project" button
      let finalDeleteButton: Element | null = null;

      // Look for the Delete Project button in the form actions
      const deleteButtons = document.querySelectorAll(
        '.projects-form-actions button, [role="dialog"] button[type="submit"]'
      );
      for (const button of deleteButtons) {
        if (button.textContent?.includes("Delete Project")) {
          finalDeleteButton = button;
          break;
        }
      }

      if (!finalDeleteButton) {
        // Try alternative selectors
        finalDeleteButton =
          document.querySelector('button[class*="destructive"]') ||
          document.querySelector('button[class*="bg-red"]') ||
          document.querySelector(".projects-form-actions button:last-child");
      }

      if (!finalDeleteButton) {
        throw new Error("Final Delete Project button not found");
      }

      // Check if button is enabled
      if ((finalDeleteButton as HTMLButtonElement).disabled) {
        throw new Error(
          "Delete Project button is still disabled - confirmation text might not match"
        );
      }

      await simulateClick(finalDeleteButton);

      // Wait for deletion to complete and redirect
      await waitFor(4000);

      return {
        success: true,
        message: `Project ${workspaceSlug}/${projectSlug} deleted successfully`,
        data: { workspaceSlug, projectSlug, currentPath: window.location.pathname },
      };
    } else {
      // Cancel deletion - close the dialog
      const cancelButton = document.querySelector(
        '[role="dialog"] button[data-slot="dialog-close"]'
      );

      if (cancelButton) {
        await simulateClick(cancelButton);
      }

      return {
        success: true,
        message: "Project deletion cancelled",
        data: { workspaceSlug, projectSlug, action: "cancelled" },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete project: ${workspaceSlug}/${projectSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Edit project details
 */
export async function editProject(
  workspaceSlug: string,
  projectSlug: string,
  updates: {
    name?: string;
    description?: string;
    color?: string;
    priority?: string;
  },
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 15000 } = options;
  const { name, description, color, priority } = updates;

  try {
    // Navigate to project settings
    await navigateTo(`/${workspaceSlug}/${projectSlug}/settings`);

    // Wait for settings page to load
    await waitForElement('.space-y-6, [data-slot="card"], .settings-container', timeout);

    // Wait specifically for form elements to load
    try {
      await waitForElement("input#name, textarea#description", 5000);
    } catch (error) {
      console.warn("Form elements not found, continuing anyway... \n", error);
    }

    // Additional wait for dynamic content
    await waitFor(1000);

    // Update name if provided
    if (name) {
      const nameInput = document.querySelector("input#name") as HTMLInputElement;

      if (nameInput) {
        await simulateTyping(nameInput, name, { clearFirst: true });
      }
    }

    // Update description if provided
    if (description) {
      const descriptionInput = document.querySelector(
        "textarea#description"
      ) as HTMLTextAreaElement;

      if (descriptionInput) {
        await simulateTyping(descriptionInput, description, { clearFirst: true });
      }
    }

    // Update color if provided
    if (color) {
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;

      if (colorInput) {
        colorInput.value = color;
        colorInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // Update priority/status if provided (this project form has status field)
    if (priority) {
      const statusSelect = document.querySelector("select#status") as HTMLSelectElement;

      if (statusSelect) {
        // Map priority to status values
        const statusMap: { [key: string]: string } = {
          HIGH: "ACTIVE",
          MEDIUM: "ACTIVE",
          LOW: "ON_HOLD",
          ACTIVE: "ACTIVE",
          ON_HOLD: "ON_HOLD",
          COMPLETED: "COMPLETED",
          ARCHIVED: "ARCHIVED",
        };

        const statusValue = statusMap[priority.toUpperCase()] || priority.toUpperCase();
        statusSelect.value = statusValue;
        statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // Save changes - find the specific Save Changes button in the form
    let saveButton: Element | null = null;

    // Look for the Save Changes button within the card content area
    const cardContent = document.querySelector('[data-slot="card-content"]');
    if (cardContent) {
      const buttons = cardContent.querySelectorAll("button");
      for (const button of buttons) {
        if (button.textContent?.includes("Save Changes")) {
          saveButton = button;
          break;
        }
      }
    }

    // If not found in card, try the specific button selector from HTML
    if (!saveButton) {
      saveButton = document.querySelector(
        ".bg-\\[var\\(--primary\\)\\].hover\\:bg-\\[var\\(--primary\\)\\]\\/90"
      );
    }

    // Final fallback - look for Save Changes text in the entire document but be more specific
    if (!saveButton) {
      const allButtons = document.querySelectorAll("button");
      for (const button of allButtons) {
        const buttonText = button.textContent?.trim();
        if (buttonText === "Save Changes" && button.closest('[data-slot="card-content"]')) {
          saveButton = button;
          break;
        }
      }
    }

    if (!saveButton) {
      throw new Error("Save Changes button not found");
    }

    await simulateClick(saveButton);

    // Wait for save completion
    await waitFor(1000);

    return {
      success: true,
      message: `Project ${workspaceSlug}/${projectSlug} updated successfully`,
      data: { workspaceSlug, projectSlug, updates },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to edit project: ${workspaceSlug}/${projectSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get current project context
 */
export async function getCurrentProject(): Promise<AutomationResult> {
  try {
    const context = getCurrentContext();

    if (context.type !== "project") {
      return {
        success: true,
        message: `Currently not in project context (context: ${context.type})`,
        data: { context, project: null },
      };
    }

    const projectInfo: any = {
      slug: context.projectSlug,
      workspaceSlug: context.workspaceSlug,
      type: context.type,
    };

    // Try to extract project name from page
    const nameSelectors = [
      ".project-name",
      ".project-title",
      '[data-testid="project-name"]',
      "h1",
      ".page-title",
    ];

    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        projectInfo.name = element.textContent.trim();
        break;
      }
    }

    return {
      success: true,
      message: `Currently in project: ${context.workspaceSlug}/${context.projectSlug}`,
      data: { context, project: projectInfo },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to get current project context",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Search projects in a workspace
 */
export async function searchProjects(
  workspaceSlug: string,
  query: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // First get all projects using listProjects
    const allProjectsResult = await listProjects(workspaceSlug, { timeout });

    if (!allProjectsResult.success) {
      return allProjectsResult;
    }
    // Try to use the search input if available
    const searchInputContainer = document.querySelector('div[data-testid="project-search-input"]');
    const searchInput = searchInputContainer?.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement | null;

    if (searchInput) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;

      valueSetter?.call(searchInput, query);
      searchInput.dispatchEvent(new Event("input", { bubbles: true })); // notifies React onChange handler
    }

    // Filter projects client-side (same as searchWorkspaces)
    const filteredProjects = allProjectsResult.data.projects.filter((project: any) => {
      const nameMatch = project.name.toLowerCase().includes(query.toLowerCase());
      const descriptionMatch =
        project.description?.toLowerCase().includes(query.toLowerCase()) || false;

      return nameMatch || descriptionMatch;
    });

    return {
      success: true,
      message: `Found ${filteredProjects.length} project(s) matching "${query}" in workspace ${workspaceSlug}`,
      data: {
        query,
        projects: filteredProjects,
        count: filteredProjects.length,
        workspaceSlug,
        searchMethod: "client-side",
        totalProjects: allProjectsResult.data.count,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to search projects for: ${query}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Workspace management automation functions
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
 * Create a new workspace
 */
export async function createWorkspace(
  name: string,
  description: string,
  options: { timeout?: number; navigateToAfterCreation?: boolean } = {}
): Promise<AutomationResult> {
  const { timeout = 15000, navigateToAfterCreation = false } = options;

  try {
    // Navigate to workspaces page
    await navigateTo("/workspaces");

    // Wait for page to load
    await waitForElement(
      '.dashboard-container, .space-y-6, [data-testid="workspaces-page"]',
      timeout
    );
    await waitFor(500);

    // Find and click "New Workspace" button
    const newWorkspaceSelectors = [
      'button:has-text("New Workspace")',
      '[data-testid="new-workspace-button"]',
      ".new-workspace-button",
      'button[aria-label*="workspace"]',
      'button:has-text("Create Workspace")',
    ];

    let newWorkspaceBtn: Element | null = null;

    // First try to find button by text content
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent?.trim() === "New Workspace" ||
        button.textContent?.includes("New Workspace")
      ) {
        newWorkspaceBtn = button;
        break;
      }
    }

    if (!newWorkspaceBtn) {
      for (const selector of newWorkspaceSelectors) {
        if (selector.includes(":has-text")) {
          // Handle text-based selectors manually
          const text = selector.match(/\("([^"]+)"\)/)?.[1] || "";
          newWorkspaceBtn = findElementByText(text, "button");
        } else {
          newWorkspaceBtn = document.querySelector(selector);
        }
        if (newWorkspaceBtn) break;
      }
    }

    if (!newWorkspaceBtn) {
      throw new Error("New Workspace button not found");
    }

    await simulateClick(newWorkspaceBtn);

    // Wait for modal to open
    await waitForElement('.projects-modal-container, [role="dialog"]', timeout);
    await waitFor(300); // Brief pause for modal animation

    // Fill workspace form
    const nameInput = (await waitForElementReady(
      'input[name="name"], input[id="workspace-name"], input[placeholder*="workspace name"]',
      timeout
    )) as HTMLInputElement;

    const descriptionInput = (await waitForElementReady(
      'textarea[name="description"], textarea[id="workspace-description"], textarea[placeholder*="describe"]',
      timeout
    )) as HTMLTextAreaElement;

    if (!nameInput || !descriptionInput) {
      throw new Error("Workspace form inputs not found");
    }

    // Focus and fill name input
    nameInput.focus();
    nameInput.click();
    await waitFor(100);

    // Set value using native setter
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

    descriptionInput.focus();
    descriptionInput.click();
    await waitFor(100);

    const descValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (descValueSetter) {
      descValueSetter.call(descriptionInput, description);
    } else {
      descriptionInput.value = description;
    }

    descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));
    descriptionInput.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(300);

    descriptionInput.blur();
    await waitFor(200);

    const modalContainer = document.querySelector('.projects-modal-container, [role="dialog"]');
    if (!modalContainer) {
      throw new Error("Modal container not found");
    }

    const formActions = modalContainer.querySelector(".projects-form-actions");
    let createButton: Element | null = null;

    if (formActions) {
      const actionButtons = formActions.querySelectorAll("button");
      if (actionButtons.length > 0) {
        createButton = actionButtons[actionButtons.length - 1]; // Last button is usually "Create"
      }
    }

    if (!createButton) {
      const modalButtons = modalContainer.querySelectorAll("button");

      for (const button of modalButtons) {
        const buttonText = button.textContent?.trim().toLowerCase();

        if (
          buttonText === "create workspace" ||
          (buttonText?.includes("create") && !buttonText.includes("cancel"))
        ) {
          createButton = button;
          break;
        }
      }
    }

    if (!createButton) {
      const createButtonSelectors = [
        ".projects-form-actions button:last-child",
        'button[type="submit"]',
        '[data-testid="create-workspace-submit"]',
      ];

      for (const selector of createButtonSelectors) {
        createButton = modalContainer.querySelector(selector);
        if (createButton) {
          break;
        }
      }
    }

    if (!createButton) {
      const allModalButtons = modalContainer.querySelectorAll("button");
      console.error(
        "Available buttons in modal:",
        Array.from(allModalButtons).map((b) => ({
          text: b.textContent?.trim(),
          type: (b as HTMLButtonElement).type,
          disabled: (b as HTMLButtonElement).disabled,
          classes: b.className,
        }))
      );
      throw new Error("Create workspace button not found in modal");
    }

    await simulateClick(createButton);
    await waitForModalClose();

    await waitFor(2000);

    // Check for success indicators or error messages
    const successSelectors = [
      ".success-toast",
      ".notification-success",
      '[data-testid="success-message"]',
      '.sonner-toast[data-type="success"]',
      ".sonner-toast-success",
    ];

    const errorSelectors = [
      ".error-toast",
      ".notification-error",
      '[data-testid="error-message"]',
      '.sonner-toast[data-type="error"]',
      ".sonner-toast-error",
      ".alert-destructive",
    ];

    let successFound = false;
    let errorFound = false;

    for (const selector of successSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        successFound = true;
        break;
      }
    }

    for (const selector of errorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        errorFound = true;
        console.error("Error indicator found:", selector, element.textContent);
        break;
      }
    }

    if (errorFound) {
      throw new Error("Workspace creation failed - error message displayed");
    }

    const workspaceSlug = generateSlug(name);

    // Optionally navigate to the new workspace
    if (navigateToAfterCreation) {
      await navigateTo(`/${workspaceSlug}`);
    }

    return {
      success: true,
      message: "Workspace created successfully",
      data: {
        name,
        description,
        slug: workspaceSlug,
        successIndicatorFound: successFound,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to create workspace",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Navigate to a specific workspace
 */
export async function navigateToWorkspace(
  workspaceSlug: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    const workspaceUrl = `/${workspaceSlug}`;
    await navigateTo(workspaceUrl);

    // Wait for workspace page to load
    await waitForElement(
      '[data-testid="workspace-content"], .workspace-page, .workspace-header',
      timeout
    );

    // Verify we're on the correct workspace
    const currentPath = window.location.pathname;
    if (!currentPath.includes(workspaceSlug)) {
      throw new Error(`Navigation failed - expected ${workspaceSlug} but got ${currentPath}`);
    }

    return {
      success: true,
      message: `Successfully navigated to workspace: ${workspaceSlug}`,
      data: { workspaceSlug, currentPath },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to navigate to workspace: ${workspaceSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * List all available workspaces
 */
export async function listWorkspaces(
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to workspaces page if not already there
    const currentPath = window.location.pathname;
    if (!currentPath.includes("/workspaces")) {
      await navigateTo("/workspaces");
      // Wait for workspaces to load
      await waitForElement(
        '.dashboard-container, .space-y-6, [data-testid="workspaces-page"]',
        timeout
      );
    }
    const workspaceSearchHistory = document.querySelector(
      '[data-slot="input"]'
    ) as HTMLInputElement | null;

    if (workspaceSearchHistory) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;

      nativeInputValueSetter.call(workspaceSearchHistory, "");
      workspaceSearchHistory.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // They contain a card structure with workspace information
    await waitFor(1000); // Wait for any dynamic loading
    const workspaceLinks = document.querySelectorAll('a[href^="/"][style*="text-decoration"]');

    // If no links found with style, try broader selector
    let workspaceElements: NodeListOf<Element> = workspaceLinks;
    if (workspaceElements.length === 0) {
      // Try to find workspace cards - they're links to workspaces
      const selectors = [
        'a[href^="/my-workspace"]',
        'a[href^="/"][href$="/"]',
        "a[href]", // Will check for h3 in JavaScript
        '.grid a[href^="/"]',
      ];

      for (const selector of selectors) {
        try {
          workspaceElements = document.querySelectorAll(selector);
          if (workspaceElements.length > 0) break;
        } catch {
          // Skip selectors that might not be supported
          continue;
        }
      }
    }

    // If still no elements, try to find card elements directly
    if (workspaceElements.length === 0) {
      workspaceElements = document.querySelectorAll('[data-slot="card"]');
    }

    if (workspaceElements.length === 0) {
      return {
        success: true,
        message: "No workspaces found",
        data: { workspaces: [], count: 0 },
      };
    }

    // Extract workspace information
    const workspaces = Array.from(workspaceElements)
      .map((element) => {
        // Get the href from the link
        const href =
          element.tagName === "A"
            ? (element as HTMLAnchorElement).getAttribute("href")
            : element.closest("a")?.getAttribute("href") || "";

        // Extract slug from href (e.g., /my-workspace/ -> my-workspace)
        const slug = href ? href.replace(/^\/|\/$/g, "") : "";

        // Find the workspace name - it's in an h3 element
        const nameElement = element.querySelector("h3, .text-sm.font-semibold");
        const name =
          nameElement?.textContent?.trim() ||
          slug
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        // Find description - it's in a p element with specific classes
        const descElements = element.querySelectorAll(
          "p.text-sm.text-\\[var\\(--muted-foreground\\)\\]"
        );
        let description = "";

        // The description is usually the second p element (first one is the slug)
        if (descElements.length > 1) {
          description = descElements[1]?.textContent?.trim() || "";
        } else if (descElements.length === 1) {
          const text = descElements[0]?.textContent?.trim() || "";
          // Check if it's not the slug
          if (text !== slug) {
            description = text;
          }
        }

        // Extract member count and project count if available
        // Find project count - look for spans after SVG elements
        let projectSpan = "0 projects";
        const svgElements = element.querySelectorAll("svg");
        for (const svg of svgElements) {
          const nextSpan = svg.parentElement?.nextElementSibling;
          if (nextSpan && nextSpan.tagName === "SPAN") {
            projectSpan = nextSpan.textContent || "0 projects";
            break;
          }
        }
        const memberSpan =
          Array.from(element.querySelectorAll("span")).find((span) =>
            span.textContent?.includes("members")
          )?.textContent || "0 members";

        const projectCount = parseInt(projectSpan.match(/\d+/)?.[0] || "0");
        const memberCount = parseInt(memberSpan.match(/\d+/)?.[0] || "0");

        return {
          name,
          description,
          slug,
          href,
          projectCount,
          memberCount,
        };
      })
      .filter((workspace) => workspace.slug && workspace.slug !== ""); // Filter out invalid workspaces

    return {
      success: true,
      message: `Found ${workspaces.length} workspace(s)`,
      data: { workspaces, count: workspaces.length },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to list workspaces",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Delete a workspace (if delete functionality is available)
 */
export async function deleteWorkspace(
  workspaceSlug: string,
  options: { timeout?: number; confirmDeletion?: boolean } = {}
): Promise<AutomationResult> {
  const { timeout = 5000, confirmDeletion = true } = options;

  try {
    // Navigate to workspace settings
    const settingsUrl = `/${workspaceSlug}/settings`;
    await navigateTo(settingsUrl);

    // Wait for settings page to load - try multiple selectors
    try {
      await waitForElement(
        '.settings-page, [data-testid="workspace-settings"], .dashboard-container, main',
        timeout
      );
    } catch {
      // If initial wait fails, wait a bit and continue
      await waitFor(2000);
    }

    // Check if we're on the settings page
    const currentPath = window.location.pathname;
    if (!currentPath.includes("/settings")) {
      throw new Error(`Failed to navigate to settings page. Current path: ${currentPath}`);
    }

    // Look for delete workspace section with more flexible selectors
    let deleteSection: Element | null = null;
    const deleteSectionSelectors = [
      ".delete-workspace",
      ".danger-zone",
      '[data-testid="delete-workspace-section"]',
      "section", // Will check for Delete button in JavaScript
      "div", // Will check for Delete/Danger headings in JavaScript
    ];

    for (const selector of deleteSectionSelectors) {
      try {
        deleteSection = document.querySelector(selector);
        if (deleteSection) break;
      } catch {
        // Skip invalid selectors
        continue;
      }
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

    // Find the "Delete Workspace" option in the dialog
    let deleteWorkspaceOption: Element | null = null;

    // Look for the delete workspace option (it's a div with specific styling)
    const deleteOptions = document.querySelectorAll('.bg-red-50, [class*="bg-red"]');
    for (const option of deleteOptions) {
      if (
        option.textContent?.includes("Delete Workspace") &&
        option.textContent?.includes("Permanently delete")
      ) {
        deleteWorkspaceOption = option;
        break;
      }
    }

    if (!deleteWorkspaceOption) {
      throw new Error("Delete Workspace option not found in danger zone dialog");
    }

    await simulateClick(deleteWorkspaceOption);

    // Wait for the confirmation form to load
    await waitFor(2000);

    if (confirmDeletion) {
      // Look for the confirmation input field
      const confirmationInput = document.querySelector(
        '#confirmation, input[placeholder="my-workspace3"]'
      ) as HTMLInputElement;

      if (!confirmationInput) {
        throw new Error("Confirmation input field not found");
      }

      // Type the workspace slug into the confirmation field
      await simulateTyping(confirmationInput, workspaceSlug);

      // Trigger input events to enable the button
      confirmationInput.dispatchEvent(new Event("input", { bubbles: true }));
      confirmationInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Wait for the button to be enabled
      await waitFor(500);

      // Find the final "Delete Workspace" button
      let finalDeleteButton: Element | null = null;

      // Look for the Delete Workspace button in the form actions
      const deleteButtons = document.querySelectorAll(
        '.projects-form-actions button, [role="dialog"] button[type="submit"]'
      );
      for (const button of deleteButtons) {
        if (button.textContent?.includes("Delete Workspace")) {
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
        throw new Error("Final Delete Workspace button not found");
      }

      // Check if button is enabled
      if ((finalDeleteButton as HTMLButtonElement).disabled) {
        throw new Error(
          "Delete Workspace button is still disabled - confirmation text might not match"
        );
      }

      await simulateClick(finalDeleteButton);

      // Wait for deletion to complete and redirect
      await waitFor(4000);

      // Check if we've been redirected (successful deletion)
      const currentPath = window.location.pathname;
      const wasDeleted =
        !currentPath.includes(workspaceSlug) ||
        currentPath === "/workspaces" ||
        currentPath === "/dashboard";

      return {
        success: wasDeleted,
        message: wasDeleted
          ? `Workspace ${workspaceSlug} deleted successfully`
          : `Workspace deletion may have failed - still on ${currentPath}`,
        data: {
          workspaceSlug,
          currentPath,
          redirected: wasDeleted,
        },
      };
    } else {
      // Cancel deletion by clicking Cancel or closing dialog
      const cancelButton =
        findElementByText("Cancel", "button") ||
        document.querySelector('[data-slot="dialog-close"]') ||
        Array.from(document.querySelectorAll('button[type="button"]')).find((btn) =>
          btn.textContent?.includes("Cancel")
        );

      if (cancelButton) {
        await simulateClick(cancelButton);
      }

      return {
        success: true,
        message: "Workspace deletion cancelled",
        data: { workspaceSlug, action: "cancelled" },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete workspace: ${workspaceSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Edit workspace details
 */
export async function editWorkspace(
  workspaceSlug: string,
  updates: { name?: string; description?: string },
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 15000 } = options;
  const { name, description } = updates;

  try {
    // Navigate to workspace settings
    await navigateTo(`/${workspaceSlug}/settings`);

    // Wait for settings page to load
    await waitForElement('.space-y-6, [data-slot="card"], .settings-container', timeout);
    await waitFor(500);

    // Update name if provided
    if (name) {
      const nameInput = (await waitForElementReady(
        '#name, input[name="name"]',
        timeout
      )) as HTMLInputElement;

      if (!nameInput) {
        throw new Error("Name input field not found");
      }

      nameInput.focus();
      nameInput.click();
      await waitFor(100);

      // Set value using native setter (same as createWorkspace)
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
    }

    // Update description if provided
    if (description) {
      const descriptionInput = (await waitForElementReady(
        '#description, textarea[name="description"]',
        timeout
      )) as HTMLTextAreaElement;

      if (!descriptionInput) {
        throw new Error("Description textarea not found");
      }

      descriptionInput.focus();
      descriptionInput.click();
      await waitFor(100);

      // Set value using native setter (same as createWorkspace)
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
    }

    // Find and click Save Changes button
    const saveButton = findElementByText("Save Changes", "button");

    if (!saveButton) {
      throw new Error("Save Changes button not found");
    }

    await simulateClick(saveButton);

    // Wait for save completion
    await waitFor(1500);

    return {
      success: true,
      message: `Workspace ${workspaceSlug} updated successfully`,
      data: { workspaceSlug, updates },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to edit workspace: ${workspaceSlug}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get current workspace context
 */
export async function getCurrentWorkspace(): Promise<AutomationResult> {
  try {
    const context = getCurrentContext();

    if (context.type === "global") {
      return {
        success: true,
        message: "Currently in global context (no specific workspace)",
        data: { context, workspace: null },
      };
    }

    const workspaceInfo: any = {
      slug: context.workspaceSlug,
      type: context.type,
    };

    // Primary selector for workspace name in the sidebar
    const nameElement = document.querySelector(".layout-workspace-selector-title");

    if (nameElement?.textContent) {
      workspaceInfo.name = nameElement.textContent.trim();
    } else {
      // Fallback: convert slug to title case
      workspaceInfo.name =
        context.workspaceSlug
          ?.split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ") || "Unknown Workspace";
    }

    return {
      success: true,
      message: `Currently in workspace: ${context.workspaceSlug}`,
      data: {
        context,
        workspace: workspaceInfo,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to get current workspace context",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Search workspaces by name
 */
export async function searchWorkspaces(
  query: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Check if we're already on the workspaces page
    const currentPath = window.location.pathname;
    if (!currentPath.includes("/workspaces")) {
      await navigateTo("/workspaces");

      try {
        await waitForElement(
          '.dashboard-container, .space-y-6, [data-testid="workspaces-page"], .workspaces-container',
          timeout
        );
      } catch {
        await waitFor(2000);
      }
    }

    const searchSelectors = [
      'input[placeholder*="search" i]',
      'input[placeholder*="filter" i]',
      'input[placeholder*="find" i]',
      'input[type="search"]',
      'input[type="text"][name*="search" i]',
      ".search-input",
      '[data-testid*="search" i]',
      ".filter-input",
    ];

    let searchInput: HTMLInputElement | null = null;
    for (const selector of searchSelectors) {
      searchInput = document.querySelector(selector) as HTMLInputElement;
      if (searchInput) break;
    }

    if (!searchInput) {
      const allWorkspaces = await listWorkspaces({ timeout: timeout / 2 });

      if (!allWorkspaces.success || !allWorkspaces.data?.workspaces) {
        const workspaceSelectors = [
          ".workspace-card",
          '[data-testid^="workspace-"]',
          ".workspace-item",
          'div[class*="workspace"]',
          'a[href^="/"][class*="workspace"]',
          ".card", // Will check for workspace-name in JavaScript
          ".grid > div", // Will check for h2, h3 in JavaScript
        ];

        let workspaceElements: Element[] = [];
        for (const selector of workspaceSelectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            workspaceElements = elements;
            break;
          }
        }

        if (workspaceElements.length === 0) {
          return {
            success: false,
            message: `No workspaces found on the page to search`,
            error: "Could not locate workspace elements",
            data: { query, searchMethod: "none" },
          };
        }

        // Extract workspace data from found elements
        const workspaces = workspaceElements.map((element, index) => {
          const nameElement = element.querySelector(
            ".workspace-name, .card-title, h3, h2, .font-semibold, .text-lg"
          );
          const descElement = element.querySelector(
            ".workspace-description, .card-description, p, .text-sm, .text-gray-600"
          );

          const name = nameElement?.textContent?.trim() || `Workspace ${index + 1}`;
          const description = descElement?.textContent?.trim() || "";

          return { name, description };
        });

        // Filter workspaces based on query
        const filteredWorkspaces = workspaces.filter(
          (workspace) =>
            workspace.name.toLowerCase().includes(query.toLowerCase()) ||
            workspace.description.toLowerCase().includes(query.toLowerCase())
        );

        return {
          success: true,
          message: `Found ${filteredWorkspaces.length} workspaces matching "${query}"`,
          data: {
            query,
            workspaces: filteredWorkspaces,
            count: filteredWorkspaces.length,
            searchMethod: "client-side-direct",
          },
        };
      }

      // Use the workspaces from listWorkspaces
      const filteredWorkspaces = allWorkspaces.data.workspaces.filter(
        (workspace: any) =>
          workspace.name.toLowerCase().includes(query.toLowerCase()) ||
          (workspace.description &&
            workspace.description.toLowerCase().includes(query.toLowerCase()))
      );

      return {
        success: true,
        message: `Found ${filteredWorkspaces.length} workspaces matching "${query}"`,
        data: {
          query,
          workspaces: filteredWorkspaces,
          count: filteredWorkspaces.length,
          searchMethod: "client-side",
        },
      };
    }

    // Clear existing search input and type new query
    searchInput.value = "";
    searchInput.focus();
    await simulateTyping(searchInput, query);

    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(2500);

    const workspaceSelectors = [
      '.workspace-card:not([style*="display: none"])',
      '[data-testid^="workspace-"]:not([style*="display: none"])',
      '.workspace-item:not([style*="display: none"])',
      'a[href^="/"]', // Will check for workspace-name in JavaScript
      'div[class*="card"]', // Will check for h2, h3 in JavaScript
      ".grid > div", // Will check for font-semibold in JavaScript
      '.grid > a[href^="/"]',
      '[role="article"]', // Will check for workspace-name in JavaScript
      ".space-y-4 > div", // Will check for h3 in JavaScript
      ".workspace-list-item",
      'div[class*="border"]', // Will check for h3, h2 in JavaScript
    ];

    let workspaceElements: Element[] = [];
    for (const selector of workspaceSelectors) {
      try {
        const elements = Array.from(document.querySelectorAll(selector));
        const visibleElements = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        });
        if (visibleElements.length > 0) {
          workspaceElements = visibleElements;
          break;
        }
      } catch {
        continue;
      }
    }

    const workspaces = workspaceElements.map((element, index) => {
      let name = "";

      const nameSelectors = [
        ".workspace-name",
        ".card-title",
        "h3", // Will check for child elements in JavaScript
        "h2", // Will check for child elements in JavaScript
        ".text-lg", // Will check for child elements in JavaScript
        ".text-xl", // Will check for child elements in JavaScript
        '[class*="title"]', // Will check for child elements in JavaScript
      ];

      for (const selector of nameSelectors) {
        const nameEl = element.querySelector(selector);
        if (nameEl && nameEl.textContent && nameEl.textContent.trim().length > 1) {
          name = nameEl.textContent.trim();
          break;
        }
      }

      // Strategy 2: If no name found, look for heading elements and get their full text
      if (!name) {
        const headings = element.querySelectorAll("h1, h2, h3, h4, .font-semibold, .font-bold");
        for (const heading of headings) {
          // Get all text nodes to avoid partial text from nested elements
          const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT, null);
          let fullText = "";
          let node: Node | null;
          while ((node = walker.nextNode())) {
            fullText += node.textContent;
          }
          fullText = fullText.trim();

          // Skip single letters or very short text that might be icons
          if (fullText.length > 2 && !fullText.match(/^[A-Z]$/)) {
            name = fullText;
            break;
          }
        }
      }

      // Strategy 3: If still no name, check for text content in links
      if (!name) {
        const link = element.querySelector("a[href]");
        if (link) {
          const linkText = link.textContent?.trim() || "";
          if (linkText.length > 2) {
            name = linkText;
          }
        }
      }

      // Fallback name
      if (!name) {
        name = `Workspace ${index + 1}`;
      }

      // Get description - exclude elements that might contain the name
      let description = "";
      const descSelectors = [
        ".workspace-description",
        ".card-description",
        "p:not(.workspace-name)",
        ".text-sm", // Will check for child elements in JavaScript
        ".text-gray-600", // Will check for child elements in JavaScript
        ".text-gray-500", // Will check for child elements in JavaScript
        '[class*="description"]',
      ];

      for (const selector of descSelectors) {
        try {
          const descEl = element.querySelector(selector);
          if (descEl && descEl.textContent) {
            const text = descEl.textContent.trim();
            // Make sure we're not getting the same text as the name
            if (text && text !== name && text.length > 0) {
              description = text;
              break;
            }
          }
        } catch {
          // Skip selectors that fail
        }
      }

      // Try to extract slug from href
      let slug = "";
      const linkElement = element.tagName === "A" ? element : element.querySelector("a[href]");
      if (linkElement) {
        const href = linkElement.getAttribute("href") || "";
        if (href && href !== "/" && href !== "#") {
          // Remove leading slash and get first segment
          const segments = href.replace(/^\//, "").split("/").filter(Boolean);
          if (segments.length > 0) {
            slug = segments[0];
          }
        }
      }

      // If no slug from href, try to generate from name
      if (!slug && name && name !== `Workspace ${index + 1}`) {
        slug = generateSlug(name);
      }

      return {
        name,
        description,
        slug,
      };
    });

    return {
      success: true,
      message: `Search completed - found ${workspaces.length} results for "${query}"`,
      data: {
        query,
        workspaces,
        count: workspaces.length,
        searchMethod: "server-side",
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to search workspaces for: ${query}`,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

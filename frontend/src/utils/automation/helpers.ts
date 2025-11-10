/**
 * Core automation helper functions for browser-based testing and automation
 */

export interface AutomationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Wait for an element to appear in the DOM
 */
export async function waitForElement(selector: string, timeout: number = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Wait for multiple elements to appear
 */
export async function waitForElements(
  selectors: string[],
  timeout: number = 10000
): Promise<Element[]> {
  const promises = selectors.map((selector) => waitForElement(selector, timeout));
  return Promise.all(promises);
}

/**
 * Simulate realistic typing in an input field
 */
export async function simulateTyping(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  options: { delay?: number; clearFirst?: boolean } = {}
): Promise<void> {
  const { clearFirst = true } = options;

  if (!element) {
    throw new Error("Element to type into not found");
  }

  // Focus the element
  element.focus();

  // Clear existing value if requested
  if (clearFirst) {
    // Use the native value setter to clear
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, "");
    }
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Use the native value setter to set the value
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, text);
  } else {
    element.value = text;
  }

  // Create and dispatch a proper input event
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: text,
  });
  element.dispatchEvent(inputEvent);

  // Create and dispatch a proper change event
  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);

  // Trigger React's synthetic event system
  const reactPropsKey = Object.keys(element).find(
    (key) => key.startsWith("__reactProps") || key.startsWith("__reactEventHandlers")
  );

  if (reactPropsKey) {
    const reactProps = (element as any)[reactPropsKey];
    if (reactProps?.onChange) {
      reactProps.onChange({ target: element, currentTarget: element });
    }
  }

  // Small delay after typing
  await waitFor(100);
}

/**
 * Simulate mouse click with proper events
 */
export async function simulateClick(
  element: Element | null,
  options: { delay?: number; doubleClick?: boolean } = {}
): Promise<void> {
  const { delay = 50, doubleClick = false } = options;

  if (!element) {
    throw new Error("Element to click not found");
  }

  // Scroll element into view if needed
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await waitFor(200);

  // Focus the element if it's focusable
  if (element instanceof HTMLElement && typeof element.focus === "function") {
    element.focus();
  }

  // Simulate mouse events
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const mouseEvents = [
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    }),
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    }),
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    }),
  ];

  for (const event of mouseEvents) {
    element.dispatchEvent(event);
    await waitFor(delay);
  }

  // Handle double click if requested
  if (doubleClick) {
    await waitFor(50);
    element.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
      })
    );
  }

  // Small delay after click
  await waitFor(100);
}

/**
 * Navigate to a specific URL
 */
export async function navigateTo(url: string): Promise<void> {
  if (window.location.pathname !== url) {
    // Use Next.js router if available, otherwise fall back to direct navigation
    if (typeof window !== "undefined" && (window as any).next?.router) {
      await (window as any).next.router.push(url);
    } else {
      window.location.href = url;
    }
    await waitForPageLoad();
  }
}

/**
 * Wait for page to fully load
 */
export async function waitForPageLoad(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      const handleLoad = () => {
        window.removeEventListener("load", handleLoad);
        resolve();
      };
      window.addEventListener("load", handleLoad);
    }
  });
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(
  expectedPath: string,
  timeout: number = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const checkPath = () => {
      if (window.location.pathname.includes(expectedPath)) {
        resolve();
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkPath()) return;

    const interval = setInterval(() => {
      if (checkPath()) {
        clearInterval(interval);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Navigation to ${expectedPath} timed out after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Wait for modal to close
 */
export async function waitForModalClose(timeout: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const checkModal = () => {
      const modals = document.querySelectorAll(
        '.projects-modal-container, .dialog-content, [role="dialog"]'
      );

      const visibleModals = Array.from(modals).filter((modal) => {
        const element = modal as HTMLElement;
        return (
          element.offsetParent !== null &&
          getComputedStyle(element).display !== "none" &&
          getComputedStyle(element).visibility !== "hidden"
        );
      });

      if (visibleModals.length === 0) {
        resolve();
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkModal()) return;

    const interval = setInterval(() => {
      if (checkModal()) {
        clearInterval(interval);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Modal did not close within timeout"));
    }, timeout);
  });
}

/**
 * Simple wait function
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate URL-friendly slug from text
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Simulate keyboard key press
 */
export async function simulateKeyPress(
  element: Element,
  key: string,
  options: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}
): Promise<void> {
  const { ctrlKey = false, altKey = false, shiftKey = false } = options;

  const keyDownEvent = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey,
    altKey,
    shiftKey,
  });

  const keyUpEvent = new KeyboardEvent("keyup", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey,
    altKey,
    shiftKey,
  });

  element.dispatchEvent(keyDownEvent);
  await waitFor(50);
  element.dispatchEvent(keyUpEvent);
}

/**
 * Find element by text content
 */
export function findElementByText(
  text: string,
  tagName?: string,
  exact: boolean = false
): Element | null {
  const xpath = tagName
    ? `//${tagName}[${exact ? `text() = "${text}"` : `contains(text(), "${text}")`}]`
    : `//*[${exact ? `text() = "${text}"` : `contains(text(), "${text}")`}]`;

  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );

  return result.singleNodeValue as Element | null;
}

/**
 * Wait for element to be visible and enabled
 */
export async function waitForElementReady(
  selector: string,
  timeout: number = 10000
): Promise<Element> {
  const element = await waitForElement(selector, timeout);

  return new Promise((resolve, reject) => {
    const checkReady = () => {
      const el = element as HTMLElement;
      const isVisible =
        el.offsetParent !== null &&
        getComputedStyle(el).display !== "none" &&
        getComputedStyle(el).visibility !== "hidden";
      const isEnabled = !(el as any).disabled;

      if (isVisible && isEnabled) {
        resolve(element);
        return true;
      }
      return false;
    };

    if (checkReady()) return;

    const interval = setInterval(() => {
      if (checkReady()) {
        clearInterval(interval);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Element ${selector} not ready within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Select option from dropdown by text or value
 */
export async function selectDropdownOption(
  dropdownSelector: string,
  optionText: string,
  isValue: boolean = false
): Promise<void> {
  // Click dropdown to open
  const dropdown = await waitForElementReady(dropdownSelector);
  await simulateClick(dropdown);

  // Wait for options to appear
  await waitFor(300);

  // Find and click option
  const optionSelector = isValue ? `[data-value="${optionText}"]` : `*:contains("${optionText}")`;

  try {
    const option = await waitForElement(optionSelector, 2000);
    await simulateClick(option);
  } catch (error) {
    const altSelectors = [
      `[value="${optionText}"]`,
      `option[value="${optionText}"]`,
      `.select-item:contains("${optionText}")`,
      `[role="option"]:contains("${optionText}")`,
    ];

    for (const selector of altSelectors) {
      try {
        const option = await waitForElement(selector, 1000);
        await simulateClick(option);
        return;
      } catch (e) {
        continue;
      }
    }

    throw new Error(`Could not find dropdown option: ${optionText}`);
  }
}

/**
 * Check if user is authenticated by looking for auth indicators
 */
export function isAuthenticated(): boolean {
  // Check for common authentication indicators
  const authIndicators = [
    '[data-testid="user-profile"]',
    '[data-testid="user-menu"]',
    ".user-avatar",
    ".profile-menu",
  ];

  return authIndicators.some((selector) => document.querySelector(selector) !== null);
}

/**
 * Get current page context from URL
 */
export function getCurrentContext(): {
  type: "global" | "workspace" | "project";
  workspaceSlug?: string;
  projectSlug?: string;
} {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  // Skip global routes
  const globalRoutes = [
    "dashboard",
    "workspaces",
    "activity",
    "settings",
    "tasks",
    "login",
    "register",
  ];
  if (pathParts.length === 0 || globalRoutes.includes(pathParts[0])) {
    return { type: "global" };
  }

  // Check if it's workspace context: /{workspaceSlug}
  if (pathParts.length >= 1) {
    const workspaceSlug = pathParts[0];

    // Check if it's project context: /{workspaceSlug}/{projectSlug}
    if (
      pathParts.length >= 2 &&
      !["projects", "members", "activity", "tasks", "analytics", "settings"].includes(pathParts[1])
    ) {
      const projectSlug = pathParts[1];
      return {
        type: "project",
        workspaceSlug,
        projectSlug,
      };
    }

    return {
      type: "workspace",
      workspaceSlug,
    };
  }

  return { type: "global" };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await waitFor(delay);
    }
  }

  throw lastError!;
}

export function normalizeDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const clean = dateStr.replace(/\//g, "-");
  const parts = clean.split("-").map((p) => p.trim());
  if (parts.length === 3) {
    let year: string, month: string, day: string;

    if (parts[0].length === 4) {
      // yyyy-mm-dd
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (parts[2].length === 4) {
      year = parts[2];
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      if (first > 12) {
        day = parts[0];
        month = parts[1];
      } else {
        if (second > 12) {
          day = parts[0];
          month = parts[1];
        } else {
          day = parts[0];
          month = parts[1];
        }
      }
    } else {
      throw new Error(`Cannot determine year in: ${dateStr}`);
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  throw new Error(`Invalid date format: ${dateStr}`);
}

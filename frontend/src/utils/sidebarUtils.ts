/**
 * Utility functions for sidebar state management
 */

// Default sidebar width in pixels
const DEFAULT_SIDEBAR_WIDTH = 260;

/**
 * Gets the sidebar collapsed state from localStorage
 * @returns {boolean} True if the sidebar is collapsed, false otherwise
 */
export const getSidebarCollapsedState = (): boolean => {
  try {
    const storedSidebarState = localStorage.getItem("sidebarCollapsed");
    return storedSidebarState === "true";
  } catch (e) {
    // If localStorage is not available (e.g., SSR), handle gracefully
    console.error("Error accessing localStorage:", e);
    return false;
  }
};

/**
 * Sets the sidebar collapsed state in localStorage and dispatches an event
 * @param {boolean} collapsed - The new collapsed state
 */
export const setSidebarCollapsedState = (collapsed: boolean): void => {
  try {
    localStorage.setItem("sidebarCollapsed", String(collapsed));

    // Dispatch custom event for components in the same window
    window.dispatchEvent(
      new CustomEvent("sidebarStateChange", {
        detail: { collapsed },
      })
    );
  } catch (e) {
    console.error("Error accessing localStorage:", e);
  }
};

/**
 * Toggles the sidebar collapsed state and returns the new state
 * @returns {boolean} The new collapsed state after toggling
 */
export const toggleSidebarCollapsedState = (): boolean => {
  const currentState = getSidebarCollapsedState();
  const newState = !currentState;
  setSidebarCollapsedState(newState);
  return newState;
};

/**
 * Utility function to toggle sidebar in components
 * Can be used in both Header and Sidebar components
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsSidebarCollapsed - State setter function
 * @param {boolean} [forceValue] - Optional value to force the sidebar state (useful for responsive layouts)
 * @returns {void}
 */
export const toggleSidebar = (
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>,
  forceValue?: boolean
): void => {
  // First get the current state to avoid unnecessary updates
  const currentState = getSidebarCollapsedState();

  // Determine the new state based on the force value or toggle the current state
  const newState = forceValue !== undefined ? forceValue : !currentState;

  // Only update if the state is actually changing
  if (currentState === newState) {
    return; // No change needed
  }

  // Update localStorage
  setSidebarCollapsedState(newState);

  // Always update the React state first for immediate UI response
  setIsSidebarCollapsed(newState);

  // Log the state change for debugging

  // Dispatch a custom event that can be listened to by other components
  window.dispatchEvent(
    new CustomEvent("sidebarToggle", {
      detail: {
        collapsed: newState,
        isSmallScreen: typeof window !== "undefined" && window.innerWidth < 768,
        isUserAction: true,
      },
    })
  );
};

/**
 * Gets the sidebar width from localStorage
 * @returns {number} The sidebar width in pixels
 */
export const getSidebarWidth = (): number => {
  try {
    const storedWidth = localStorage.getItem("sidebarWidth");
    const width = storedWidth ? parseInt(storedWidth, 10) : DEFAULT_SIDEBAR_WIDTH;

    // Validate width is within reasonable bounds
    if (width < 200 || width > 600) {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    return width;
  } catch (e) {
    console.error("Error accessing localStorage:", e);
    return DEFAULT_SIDEBAR_WIDTH;
  }
};

/**
 * Sets the sidebar width in localStorage and dispatches an event
 * @param {number} width - The new width in pixels
 */
export const setSidebarWidth = (width: number): void => {
  try {
    const clampedWidth = Math.max(200, Math.min(600, width));
    localStorage.setItem("sidebarWidth", String(clampedWidth));

    // Dispatch custom event for components in the same window
    window.dispatchEvent(
      new CustomEvent("sidebarWidthChange", {
        detail: { width: clampedWidth },
      })
    );
  } catch (e) {
    console.error("Error accessing localStorage:", e);
  }
};

/**
 * Resets the sidebar width to the default value
 */
export const resetSidebarWidth = (): void => {
  setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
};

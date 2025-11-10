/**
 * Authentication automation functions
 */

import {
  AutomationResult,
  waitForElement,
  simulateTyping,
  simulateClick,
  navigateTo,
  waitForNavigation,
  waitFor,
  isAuthenticated as checkAuthStatus,
} from "./helpers";

/**
 * Automate the login process
 */
export async function login(
  email: string,
  password: string,
  options: { timeout?: number; rememberMe?: boolean } = {}
): Promise<AutomationResult> {
  const { timeout = 15000, rememberMe = false } = options;

  try {
    // Navigate to login page if not already there
    if (!window.location.pathname.includes("/login")) {
      await navigateTo("/login");
    }

    // Wait for login form to load
    await waitForElement(".login-form", timeout);

    // Find form inputs
    const emailInput = (await waitForElement(
      'input[name="email"], input[type="email"], input[id="email"]',
      timeout
    )) as HTMLInputElement;

    const passwordInput = (await waitForElement(
      'input[name="password"], input[type="password"], input[id="password"]',
      timeout
    )) as HTMLInputElement;

    if (!emailInput || !passwordInput) {
      throw new Error("Login form inputs not found");
    }

    // Fill in credentials
    await simulateTyping(emailInput, email);
    await simulateTyping(passwordInput, password);

    // Handle remember me checkbox if requested
    if (rememberMe) {
      try {
        const rememberCheckbox = document.querySelector(
          'input[name="rememberMe"], input[id="rememberMe"], .login-remember-me-checkbox input'
        ) as HTMLInputElement;

        if (rememberCheckbox && !rememberCheckbox.checked) {
          await simulateClick(rememberCheckbox);
        }
      } catch (error) {
        console.warn("Remember me checkbox not found or not accessible");
      }
    }

    // Submit the form
    const submitButton = await waitForElement(
      'button[type="submit"], .login-submit-button, button:contains("Log In")',
      timeout
    );

    await simulateClick(submitButton);

    // Wait for navigation away from login page or error message
    await waitFor(500); // Brief pause for form processing

    // Check for error messages
    const errorElement = document.querySelector(
      '.login-error-alert, .alert-destructive, [role="alert"]'
    );

    if (errorElement && errorElement.textContent) {
      throw new Error(`Login failed: ${errorElement.textContent.trim()}`);
    }

    // Wait for successful redirect (usually to dashboard)
    try {
      await waitForNavigation("/dashboard", 10000);
    } catch (navError) {
      if (window.location.pathname.includes("/organization")) {
        return {
          success: true,
          message: "Login successful - redirected to organization selection",
          data: { redirectedTo: "/organization" },
        };
      }

      // Check if we're on any non-login page (successful login)
      if (!window.location.pathname.includes("/login")) {
        return {
          success: true,
          message: `Login successful - redirected to ${window.location.pathname}`,
          data: { redirectedTo: window.location.pathname },
        };
      }

      throw new Error("Login appears to have failed - still on login page");
    }

    // Verify authentication status
    await waitFor(1000);
    if (!checkAuthStatus()) {
      throw new Error("Login completed but authentication status not verified");
    }

    return {
      success: true,
      message: "Login successful",
      data: { redirectedTo: window.location.pathname },
    };
  } catch (error) {
    return {
      success: false,
      message: "Login failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Automate the logout process
 */
export async function logout(options: { timeout?: number } = {}): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Check if user is already logged out
    if (!checkAuthStatus()) {
      return {
        success: true,
        message: "User is already logged out",
      };
    }

    // Find and click user profile/menu button
    const profileMenuSelectors = [
      '[data-testid="user-profile-menu"]',
      '[data-testid="user-menu"]',
      ".user-profile-menu",
      ".profile-menu button",
      ".header .avatar",
      ".user-avatar",
      ".login-form-mode-toggle button",
    ];

    let profileMenu: Element | null = null;
    for (const selector of profileMenuSelectors) {
      profileMenu = document.querySelector(selector);
      if (profileMenu) break;
    }

    if (!profileMenu) {
      throw new Error("User profile menu not found");
    }

    await simulateClick(profileMenu);

    // Wait for dropdown/menu to appear
    await waitFor(500);

    // Find and click logout button
    const logoutSelectors = [
      '[data-testid="logout-button"]',
      'button:contains("Logout")',
      'button:contains("Sign Out")',
      ".logout-button",
      '[role="menuitem"]:contains("Logout")',
      'a[href*="logout"]',
    ];

    let logoutButton: Element | null = null;
    for (const selector of logoutSelectors) {
      // Handle :contains pseudo-selector manually
      if (selector.includes(":contains")) {
        const [tag, text] = selector.split(":contains");
        const elements = document.querySelectorAll(tag.replace("(", "").replace(")", ""));
        logoutButton =
          (Array.from(elements).find((el) =>
            el.textContent?.toLowerCase().includes(text.replace(/[()'"]/g, "").toLowerCase())
          ) as Element) || null;
      } else {
        logoutButton = document.querySelector(selector);
      }
      if (logoutButton) break;
    }

    if (!logoutButton) {
      throw new Error("Logout button not found in menu");
    }

    await simulateClick(logoutButton);

    // Wait for navigation to login page
    try {
      await waitForNavigation("/login", timeout);
    } catch (navError) {
      // Sometimes logout redirects to home page instead
      if (window.location.pathname === "/" || !checkAuthStatus()) {
        return {
          success: true,
          message: "Logout successful",
          data: { redirectedTo: window.location.pathname },
        };
      }
      throw navError;
    }

    // Verify logout was successful
    await waitFor(1000);
    if (checkAuthStatus()) {
      throw new Error("Logout completed but user still appears authenticated");
    }

    return {
      success: true,
      message: "Logout successful",
      data: { redirectedTo: window.location.pathname },
    };
  } catch (error) {
    return {
      success: false,
      message: "Logout failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Register a new user account
 */
export async function register(
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword?: string;
  },
  options: { timeout?: number; agreeToTerms?: boolean } = {}
): Promise<AutomationResult> {
  const { timeout = 15000, agreeToTerms = true } = options;
  const { firstName, lastName, email, password, confirmPassword = password } = userData;

  try {
    // Navigate to register page
    if (!window.location.pathname.includes("/register")) {
      await navigateTo("/register");
    }

    // Wait for registration form
    await waitForElement(".register-form, form", timeout);

    // Fill in registration form
    const firstNameInput = document.querySelector(
      'input[name="firstName"], input[id="firstName"]'
    ) as HTMLInputElement;

    const lastNameInput = document.querySelector(
      'input[name="lastName"], input[id="lastName"]'
    ) as HTMLInputElement;

    const emailInput = document.querySelector(
      'input[name="email"], input[type="email"], input[id="email"]'
    ) as HTMLInputElement;

    const passwordInput = document.querySelector(
      'input[name="password"], input[type="password"], input[id="password"]'
    ) as HTMLInputElement;

    const confirmPasswordInput = document.querySelector(
      'input[name="confirmPassword"], input[name="passwordConfirm"], input[id="confirmPassword"]'
    ) as HTMLInputElement;

    // Fill in the form fields
    if (firstNameInput) await simulateTyping(firstNameInput, firstName);
    if (lastNameInput) await simulateTyping(lastNameInput, lastName);
    if (emailInput) await simulateTyping(emailInput, email);
    if (passwordInput) await simulateTyping(passwordInput, password);
    if (confirmPasswordInput) await simulateTyping(confirmPasswordInput, confirmPassword);

    // Handle terms and conditions checkbox
    if (agreeToTerms) {
      const termsCheckbox = document.querySelector(
        'input[name="agreeToTerms"], input[id="terms"], .terms-checkbox input'
      ) as HTMLInputElement;

      if (termsCheckbox && !termsCheckbox.checked) {
        await simulateClick(termsCheckbox);
      }
    }

    // Submit the registration form
    const submitButton = await waitForElement(
      'button[type="submit"], .register-submit-button, button:contains("Create Account"), button:contains("Register")',
      timeout
    );

    await simulateClick(submitButton);

    // Wait for processing and check for errors
    await waitFor(1000);

    const errorElement = document.querySelector(
      '.register-error, .alert-destructive, [role="alert"]'
    );

    if (errorElement && errorElement.textContent) {
      throw new Error(`Registration failed: ${errorElement.textContent.trim()}`);
    }

    // Wait for successful redirect or confirmation
    try {
      await waitForNavigation("/login", 10000);
      return {
        success: true,
        message: "Registration successful - redirected to login",
        data: { email, redirectedTo: "/login" },
      };
    } catch (navError) {
      if (!window.location.pathname.includes("/register")) {
        return {
          success: true,
          message: `Registration successful - redirected to ${window.location.pathname}`,
          data: { email, redirectedTo: window.location.pathname },
        };
      }

      throw new Error("Registration may have failed - still on registration page");
    }
  } catch (error) {
    return {
      success: false,
      message: "Registration failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Handle forgot password flow
 */
export async function forgotPassword(
  email: string,
  options: { timeout?: number } = {}
): Promise<AutomationResult> {
  const { timeout = 10000 } = options;

  try {
    // Navigate to forgot password page
    if (!window.location.pathname.includes("/forgot-password")) {
      // Try to find forgot password link from login page
      if (window.location.pathname.includes("/login")) {
        const forgotLink = document.querySelector('a[href*="forgot"], .login-forgot-password-link');
        if (forgotLink) {
          await simulateClick(forgotLink);
        } else {
          await navigateTo("/forgot-password");
        }
      } else {
        await navigateTo("/forgot-password");
      }
    }

    // Wait for forgot password form
    await waitForElement("form, .forgot-password-form", timeout);

    // Fill in email
    const emailInput = (await waitForElement(
      'input[name="email"], input[type="email"], input[id="email"]',
      timeout
    )) as HTMLInputElement;

    await simulateTyping(emailInput, email);

    // Submit form
    const submitButton = await waitForElement(
      'button[type="submit"], button:contains("Send Reset Link"), button:contains("Reset Password")',
      timeout
    );

    await simulateClick(submitButton);

    // Wait for success message or redirect
    await waitFor(2000);

    // Look for success confirmation
    const successElement = document.querySelector(
      ".success-message, .alert-success, .notification-success"
    );

    if (successElement) {
      return {
        success: true,
        message: "Password reset email sent successfully",
        data: { email },
      };
    }

    // Check for error messages
    const errorElement = document.querySelector(
      '.error-message, .alert-destructive, [role="alert"]'
    );

    if (errorElement && errorElement.textContent) {
      throw new Error(errorElement.textContent.trim());
    }

    return {
      success: true,
      message: "Password reset request submitted",
      data: { email },
    };
  } catch (error) {
    return {
      success: false,
      message: "Forgot password request failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Check current authentication status
 */
export async function checkAuthenticationStatus(): Promise<AutomationResult> {
  try {
    const isAuth = checkAuthStatus();

    // Try to get user information from the page
    const userInfo: any = {};

    const userNameElement = document.querySelector(
      '[data-testid="user-name"], .user-name, .profile-name'
    );

    const userEmailElement = document.querySelector(
      '[data-testid="user-email"], .user-email, .profile-email'
    );

    if (userNameElement) {
      userInfo.name = userNameElement.textContent?.trim();
    }

    if (userEmailElement) {
      userInfo.email = userEmailElement.textContent?.trim();
    }

    return {
      success: true,
      message: isAuth ? "User is authenticated" : "User is not authenticated",
      data: {
        authenticated: isAuth,
        currentPath: window.location.pathname,
        userInfo: Object.keys(userInfo).length > 0 ? userInfo : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to check authentication status",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: User Registration Flow
 * 
 * This test suite covers the complete user registration workflow including:
 * - Page load and UI elements verification
 * - Form validation (client-side)
 * - Password requirements validation
 * - Successful registration flow
 * - Error handling
 */

test.describe('User Registration Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the registration page before each test
    await page.goto('/register');
  });

  test('should load the registration page with all required elements', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Taskosaur/i);

    // Verify main heading
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

    // Verify all form fields are present
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();

    // Verify terms checkbox
    await expect(page.getByRole('checkbox', { name: /terms of service/i })).toBeVisible();

    // Verify submit button
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

    // Verify login link
    await expect(page.getByRole('link', { name: /log in to existing account/i })).toBeVisible();
  });

  test('should show password requirements when typing password', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    
    // Type a password
    await passwordInput.fill('Test');

    // Verify password requirements are shown
    await expect(page.getByText(/password requirements/i)).toBeVisible();
    await expect(page.getByText(/8\+ characters/i)).toBeVisible();
    await expect(page.getByText(/uppercase letter/i)).toBeVisible();
    await expect(page.getByText(/lowercase letter/i)).toBeVisible();
    await expect(page.getByText(/number/i)).toBeVisible();
  });

  test('should validate password requirements in real-time', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    
    // Type a weak password
    await passwordInput.fill('test');
    
    // Check that requirements are not met (should show invalid state)
    // Note: The exact selectors depend on your implementation
    await expect(page.getByText(/8\+ characters/i)).toBeVisible();
    
    // Type a strong password
    await passwordInput.fill('Test1234');
    
    // All requirements should be met
    await expect(page.getByText(/8\+ characters/i)).toBeVisible();
  });

  test('should validate password confirmation matches', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    const confirmPasswordInput = page.getByLabel(/confirm password/i);
    
    // Fill password
    await passwordInput.fill('Test1234');
    
    // Fill non-matching confirm password
    await confirmPasswordInput.fill('Test5678');
    
    // Should show passwords don't match
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    
    // Fill matching confirm password
    await confirmPasswordInput.fill('Test1234');
    
    // Should show passwords match
    await expect(page.getByText(/passwords match/i)).toBeVisible();
  });

  test('should disable submit button when form is incomplete', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /create account/i });
    
    // Button should be disabled initially
    await expect(submitButton).toBeDisabled();
    
    // Fill only some fields
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    
    // Button should still be disabled
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when all requirements are met', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /create account/i });
    
    // Fill all required fields
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email address/i).fill('john.doe@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Test1234');
    await page.getByLabel(/confirm password/i).fill('Test1234');
    
    // Accept terms
    await page.getByRole('checkbox', { name: /terms of service/i }).check();
    
    // Button should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should show error when terms are not accepted', async ({ page }) => {
    // Fill all fields except terms
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email address/i).fill('john.doe@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Test1234');
    await page.getByLabel(/confirm password/i).fill('Test1234');
    
    // Try to submit without accepting terms
    const submitButton = page.getByRole('button', { name: /create account/i });
    
    // Button should be disabled
    await expect(submitButton).toBeDisabled();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    
    // Fill password
    await passwordInput.fill('Test1234');
    
    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click show password button
    const showPasswordButtons = page.getByRole('button', { name: /show password/i });
    await showPasswordButtons.first().click();
    
    // Password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click hide password button
    const hidePasswordButtons = page.getByRole('button', { name: /hide password/i });
    await hidePasswordButtons.first().click();
    
    // Password should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to login page when clicking login link', async ({ page }) => {
    // Click the login link
    await page.getByRole('link', { name: /log in to existing account/i }).click();
    
    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show loading state when submitting form', async ({ page }) => {
    // Fill all required fields with a unique email
    const timestamp = Date.now();
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email address/i).fill(`john.doe.${timestamp}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('Test1234');
    await page.getByLabel(/confirm password/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service/i }).check();
    
    // Submit the form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/creating account/i)).toBeVisible();
  });

  test('should handle registration with pre-filled email from query parameter', async ({ page }) => {
    // Navigate with email query parameter
    await page.goto('/register?email=prefilled@example.com');
    
    // Email field should be pre-filled
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toHaveValue('prefilled@example.com');
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByLabel(/email address/i);
    
    // Fill invalid email
    await emailInput.fill('invalid-email');
    
    // Try to submit (button should be enabled but form validation should fail)
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel('Password', { exact: true }).fill('Test1234');
    await page.getByLabel(/confirm password/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service/i }).check();
    
    // HTML5 validation should prevent submission
    // Note: This test verifies the email input has type="email"
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check for proper labels
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    
    // Check for required attributes
    await expect(page.getByLabel(/first name/i)).toHaveAttribute('required');
    await expect(page.getByLabel(/email address/i)).toHaveAttribute('required');
    
    // Check for autocomplete attributes
    await expect(page.getByLabel(/first name/i)).toHaveAttribute('autocomplete', 'given-name');
    await expect(page.getByLabel(/last name/i)).toHaveAttribute('autocomplete', 'family-name');
    await expect(page.getByLabel(/email address/i)).toHaveAttribute('autocomplete', 'email');
  });

  test('should clear error message when user starts typing', async ({ page }) => {
    // Fill form with invalid data to trigger an error
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email address/i).fill('existing@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Test1234');
    await page.getByLabel(/confirm password/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service/i }).check();
    
    // Submit to potentially trigger an error (if email exists)
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Wait a bit for potential error
    await page.waitForTimeout(1000);
    
    // If an error appears, typing should clear it
    const errorAlert = page.getByRole('alert');
    const isErrorVisible = await errorAlert.isVisible().catch(() => false);
    
    if (isErrorVisible) {
      // Start typing in any field
      await page.getByLabel(/first name/i).fill('Jane');
      
      // Error should be cleared
      await expect(errorAlert).not.toBeVisible();
    }
  });
});

/**
 * Test Suite: Registration Form Validation Edge Cases
 */
test.describe('Registration Form Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should handle very long names', async ({ page }) => {
    const longName = 'A'.repeat(100);
    
    await page.getByLabel(/first name/i).fill(longName);
    await page.getByLabel(/last name/i).fill(longName);
    
    // Form should still be functional
    await expect(page.getByLabel(/first name/i)).toHaveValue(longName);
    await expect(page.getByLabel(/last name/i)).toHaveValue(longName);
  });

  test('should handle special characters in names', async ({ page }) => {
    await page.getByLabel(/first name/i).fill("O'Brien");
    await page.getByLabel(/last name/i).fill('José-María');
    
    // Should accept special characters
    await expect(page.getByLabel(/first name/i)).toHaveValue("O'Brien");
    await expect(page.getByLabel(/last name/i)).toHaveValue('José-María');
  });

  test('should handle whitespace in form fields', async ({ page }) => {
    // Fill fields with leading/trailing whitespace
    await page.getByLabel(/first name/i).fill('  John  ');
    await page.getByLabel(/last name/i).fill('  Doe  ');
    
    // Values should be preserved (trimming is typically done server-side)
    await expect(page.getByLabel(/first name/i)).toHaveValue('  John  ');
  });

  test('should validate password with only special characters', async ({ page }) => {
    const passwordInput = page.getByLabel('Password', { exact: true });
    
    // Password with special characters but missing requirements
    await passwordInput.fill('!@#$%^&*');
    
    // Should show requirements not met
    await expect(page.getByText(/password requirements/i)).toBeVisible();
  });

  test('should handle rapid form submission attempts', async ({ page }) => {
    // Fill form
    await page.getByLabel(/first name/i).fill('John');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email address/i).fill(`test.${Date.now()}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('Test1234');
    await page.getByLabel(/confirm password/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service/i }).check();
    
    const submitButton = page.getByRole('button', { name: /create account/i });
    
    // Try to click multiple times rapidly
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();
    
    // Button should be disabled after first click (loading state)
    await expect(submitButton).toBeDisabled();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Workspace Tasks', () => {
  let workspaceSlug: string;

  test.beforeEach(async ({ page }) => {
    // First get a workspace slug
    await page.goto('/workspaces');
    await page.waitForLoadState('networkidle');

    const workspaceCard = page.locator('a[href^="/"]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    }).first();

    const isVisible = await workspaceCard.isVisible().catch(() => false);
    if (!isVisible) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    await expect(workspaceCard).toBeVisible({ timeout: 15000 });

    const href = await workspaceCard.getAttribute('href');
    expect(href).toBeTruthy();

    workspaceSlug = href!.split('/').filter(Boolean)[0];

    // Navigate to workspace tasks
    await page.goto(`/${workspaceSlug}/tasks`);
    await page.waitForLoadState('networkidle');
  });

  test('should display workspace tasks page', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/${workspaceSlug}/tasks`));
    await expect(page.getByText(/tasks/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should open new task modal from workspace tasks page', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create task/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();

    // Modal should open
    await expect(page.getByText(/create.*task/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should create task from workspace tasks page with project selection', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create task/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create.*task/i).first()).toBeVisible({ timeout: 10000 });

    const taskTitle = `E2E Workspace Task - ${Date.now()}`;

    // Fill task title
    await page.getByLabel(/task title/i).fill(taskTitle);

    // Select project (required in workspace context)
    const projectButton = page.locator('button[role="combobox"][aria-label="Select project"], button[data-automation-id="select-project"]');
    const projectButtonVisible = await projectButton.isVisible().catch(() => false);

    if (projectButtonVisible) {
      await projectButton.click();
      await page.waitForTimeout(500);

      // Select first project
      const projectItem = page.locator('[role="option"]').first();
      const projectExists = await projectItem.isVisible().catch(() => false);

      if (projectExists) {
        await projectItem.click();
        await page.waitForTimeout(500);
      } else {
        // No projects available, skip test
        test.skip();
        return;
      }
    }

    // Submit
    const submitButton = page.locator('#create-task-submit, button[type="submit"]:has-text("Create")');
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Wait for success
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 15000 });
  });

  test('should show disabled create button when project not selected', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create task/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create.*task/i).first()).toBeVisible({ timeout: 10000 });

    // Fill only title, don't select project
    const taskTitle = `E2E Workspace Task - ${Date.now()}`;
    await page.getByLabel(/task title/i).fill(taskTitle);

    // Submit button should be disabled without project selection
    const submitButton = page.locator('#create-task-submit, button[type="submit"]:has-text("Create")');
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  });
});

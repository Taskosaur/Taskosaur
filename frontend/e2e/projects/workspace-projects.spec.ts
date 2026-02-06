import { test, expect } from '@playwright/test';

test.describe('Workspace Projects', () => {
  let workspaceSlug: string;

  test.beforeEach(async ({ page }) => {
    // First get a workspace slug from workspaces page
    await page.goto('/workspaces');
    await page.waitForLoadState('networkidle');

    // Reload if auth context hasn't hydrated yet
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

    // Navigate to workspace projects
    await page.goto(`/${workspaceSlug}/projects`);
    await page.waitForLoadState('networkidle');
  });

  test('should display workspace projects page', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/${workspaceSlug}/projects`));
    await expect(page.getByText(/projects/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should create project from workspace context', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new project/i)).toBeVisible({ timeout: 10000 });

    const projectName = `E2E Workspace Project - ${Date.now()}`;

    // Fill project name
    await page.getByLabel(/project name/i).fill(projectName);

    // Workspace should be pre-selected in workspace context
    // Just submit the form
    const submitButton = page.getByRole('button', { name: /create project/i }).last();
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Wait for success
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to project from workspace projects list', async ({ page }) => {
    // Find a project card
    const projectCard = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    }).first();

    const cardExists = await projectCard.isVisible().catch(() => false);
    if (!cardExists) {
      test.skip();
      return;
    }

    const href = await projectCard.getAttribute('href');
    await projectCard.click();

    await page.waitForURL(`**${href}**`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });
});

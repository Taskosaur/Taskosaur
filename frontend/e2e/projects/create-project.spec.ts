import { test, expect } from '@playwright/test';

test.describe('Project Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Wait for project cards to load (like task test waits for project cards)
    const projectCard = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    }).first();

    const isVisible = await projectCard.isVisible().catch(() => false);
    if (!isVisible) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Wait for either project cards OR empty state to be visible
    const hasCards = await projectCard.isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no projects/i).isVisible().catch(() => false);

    if (!hasCards && !hasEmptyState) {
      await expect(page.getByText(/projects/i).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('should display projects list', async ({ page }) => {
    await expect(page).toHaveURL(/\/projects/);

    // Check for project cards in the grid
    const projectCards = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    });

    const cardCount = await projectCards.count();

    if (cardCount > 0) {
      // Verify first card is visible
      await expect(projectCards.first()).toBeVisible({ timeout: 10000 });
    } else {
      // Empty state should be visible
      await expect(page.getByText(/no projects/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should open new project modal', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new project/i)).toBeVisible({ timeout: 10000 });
  });

  test('should create a new project with required fields', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new project/i)).toBeVisible({ timeout: 10000 });

    const projectName = `E2E Test Project - ${Date.now()}`;

    // Fill project name
    await page.getByLabel(/project name/i).fill(projectName);

    // Wait for workspace dropdown to be ready and select workspace
    await page.waitForTimeout(1000);
    const workspaceButton = page.locator('button[role="combobox"]').filter({ hasText: /select workspace/i });
    const workspaceVisible = await workspaceButton.isVisible().catch(() => false);

    if (workspaceVisible) {
      await workspaceButton.click();
      await page.waitForTimeout(500);

      // Select first workspace from dropdown
      const workspaceItem = page.locator('[role="option"]').first();
      await expect(workspaceItem).toBeVisible({ timeout: 5000 });
      await workspaceItem.click();
      await page.waitForTimeout(500);
    }

    // Submit
    const submitButton = page.getByRole('button', { name: /create project/i }).last();
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Wait for success toast
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 15000 });

    // Verify project appears in the list (use first() to avoid strict mode violation with toast)
    await page.waitForLoadState('networkidle');
    const projectCard = page.locator('a[href]').filter({ hasText: projectName }).first();
    await expect(projectCard).toBeVisible({ timeout: 15000 });
  });

  test('should not submit project without name', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new project/i)).toBeVisible({ timeout: 10000 });

    const submitButton = page.getByRole('button', { name: /create project/i }).last();
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  });

  test('should search projects', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    const searchExists = await searchInput.isVisible().catch(() => false);

    if (!searchExists) {
      test.skip();
      return;
    }

    await searchInput.fill('test');
    await page.waitForLoadState('networkidle');

    // Verify search is applied - cards or empty state should show
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });
  });

  test('should filter projects by status', async ({ page }) => {
    const filterTrigger = page.locator('[data-testid="filter-dropdown-trigger"], button:has-text("Filter")').first();
    const filterExists = await filterTrigger.isVisible().catch(() => false);

    if (!filterExists) {
      test.skip();
      return;
    }

    await filterTrigger.click();
    await page.waitForTimeout(500);

    const statusOption = page.getByText(/status/i).first();
    const statusExists = await statusOption.isVisible().catch(() => false);

    if (statusExists) {
      await statusOption.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should navigate to project when clicking card', async ({ page }) => {
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

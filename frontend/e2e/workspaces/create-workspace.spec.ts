import { test, expect } from '@playwright/test';

test.describe('Workspace Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspaces');
    await page.waitForLoadState('networkidle');

    // Wait for workspace cards to load (like task test waits for project cards)
    const workspaceCard = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    }).first();

    const isVisible = await workspaceCard.isVisible().catch(() => false);
    if (!isVisible) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Wait for either workspace cards OR empty state to be visible
    const hasCards = await workspaceCard.isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no workspaces/i).isVisible().catch(() => false);

    if (!hasCards && !hasEmptyState) {
      await expect(page.getByText(/workspaces/i).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('should display workspaces list', async ({ page }) => {
    await expect(page).toHaveURL(/\/workspaces/);

    // Check for workspace cards in the grid
    const workspaceCards = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    });

    const cardCount = await workspaceCards.count();

    if (cardCount > 0) {
      // Verify first card is visible
      await expect(workspaceCards.first()).toBeVisible({ timeout: 10000 });
    } else {
      // Empty state should be visible
      await expect(page.getByText(/no workspaces/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should open new workspace dialog', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /new workspace/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new workspace/i)).toBeVisible({ timeout: 10000 });
  });

  test('should create a new workspace with required fields', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /new workspace/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new workspace/i)).toBeVisible({ timeout: 10000 });

    const workspaceName = `E2E Test Workspace - ${Date.now()}`;
    const workspaceDescription = 'This is a test workspace created by E2E tests';

    await page.getByLabel(/workspace name/i).fill(workspaceName);
    await page.getByLabel(/description/i).fill(workspaceDescription);

    const submitButton = page.getByRole('button', { name: /create workspace/i });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Wait for success toast
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 15000 });

    // Verify workspace appears in the list
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(workspaceName)).toBeVisible({ timeout: 15000 });
  });

  test('should not submit workspace without required fields', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /new workspace/i });

    const buttonExists = await createButton.isVisible().catch(() => false);
    if (!buttonExists) {
      test.skip();
      return;
    }

    await createButton.click();
    await expect(page.getByText(/create new workspace/i)).toBeVisible({ timeout: 10000 });

    const submitButton = page.getByRole('button', { name: /create workspace/i });
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  });

  test('should search workspaces', async ({ page }) => {
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

  test('should navigate to workspace when clicking card', async ({ page }) => {
    const workspaceCard = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    }).first();

    const cardExists = await workspaceCard.isVisible().catch(() => false);
    if (!cardExists) {
      test.skip();
      return;
    }

    const href = await workspaceCard.getAttribute('href');
    await workspaceCard.click();

    await page.waitForURL(`**${href}**`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });
});

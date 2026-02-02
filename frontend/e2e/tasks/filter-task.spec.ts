import { test, expect } from '@playwright/test';

test.describe('Task Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // Reload if auth context hasn't hydrated yet
    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    const loaded = await taskContent.isVisible().catch(() => false);
    if (!loaded) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    await expect(page.getByText(/my tasks/i).first()).toBeVisible({ timeout: 15000 });
  });

  // Returns scoped locator for the filter dropdown panel (role="menu")
  async function openFilterDropdown(page: import('@playwright/test').Page) {
    const filterTrigger = page.locator('[data-testid="filter-dropdown-trigger"]');
    await expect(filterTrigger).toBeVisible({ timeout: 10000 });
    await filterTrigger.click();

    const filterPanel = page.locator('[role="menu"]');
    await expect(filterPanel).toBeVisible({ timeout: 5000 });
    return filterPanel;
  }

  test('should open the filter dropdown and show filter sections', async ({ page }) => {
    const filterPanel = await openFilterDropdown(page);

    await expect(filterPanel.getByText('Advanced Filters')).toBeVisible();
    await expect(filterPanel.getByText('Status')).toBeVisible();
    await expect(filterPanel.getByText('Priority')).toBeVisible();
    await expect(filterPanel.getByText('Type')).toBeVisible();
  });

  test('should filter tasks by priority', async ({ page }) => {
    const filterPanel = await openFilterDropdown(page);
    await filterPanel.getByText('Priority').click();
    await filterPanel.getByText('High').first().click();

    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/priorities=HIGH/i, { timeout: 10000 });
  });

  test('should filter tasks by type', async ({ page }) => {
    const filterPanel = await openFilterDropdown(page);
    await filterPanel.getByText('Type').click();
    await filterPanel.getByText('Bug').first().click();

    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/types=BUG/i, { timeout: 10000 });
  });

  test('should search tasks by title', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search tasks/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill('E2E');
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    const hasResults = await page.getByText(/E2E/i).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no tasks found|no results/i).isVisible().catch(() => false);
    expect(hasResults || hasEmpty).toBe(true);
  });

  test('should clear search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search tasks/i);
    await searchInput.fill('something');
    await page.waitForTimeout(600);

    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('should apply a priority filter and then remove it', async ({ page }) => {
    let filterPanel = await openFilterDropdown(page);
    await filterPanel.getByText('Priority').click();
    await filterPanel.getByText('High').first().click();

    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/priorities=HIGH/i, { timeout: 10000 });

    filterPanel = await openFilterDropdown(page);
    await filterPanel.getByText('High').first().click();

    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('priorities=');
  });
});

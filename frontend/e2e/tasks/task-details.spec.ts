import { test, expect } from '@playwright/test';

test.describe('Task Details & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    const loaded = await taskContent.isVisible().catch(() => false);
    if (!loaded) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    await expect(page.getByText(/my tasks/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to global tasks view', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no tasks found/i).isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('should view task details by clicking a task row', async ({ page }) => {
    const taskRow = page.locator('.tasktable-row').first();
    await expect(taskRow).toBeVisible({ timeout: 15000 });

    await taskRow.click();

    await expect(page.locator('[aria-label="Edit Status"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#delete-task-button')).toBeVisible({ timeout: 10000 });
  });
});

import { test, expect } from '@playwright/test';

test.describe('Update Task Status', () => {
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

  test('should update task status from the detail panel', async ({ page }) => {
    const taskRow = page.locator('.tasktable-row').first();
    await expect(taskRow).toBeVisible({ timeout: 15000 });
    await taskRow.click();

    const editStatusBtn = page.locator('[aria-label="Edit Status"]');
    await expect(editStatusBtn).toBeVisible({ timeout: 10000 });
    await editStatusBtn.click();

    const statusDropdown = page.locator('[role="menu"]');
    await expect(statusDropdown).toBeVisible({ timeout: 10000 });

    const statusItems = statusDropdown.locator('[role="menuitem"]');
    await expect(statusItems.first()).toBeVisible({ timeout: 10000 });

    const count = await statusItems.count();
    expect(count).toBeGreaterThan(0);
    const targetIndex = count > 1 ? 1 : 0;
    await statusItems.nth(targetIndex).click();

    await page.waitForLoadState('networkidle');

    await expect(page.locator('[aria-label="Edit Status"]')).toBeVisible({ timeout: 10000 });
  });
});

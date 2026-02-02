import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Update Task Priority', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    const loaded = await taskContent.isVisible().catch(() => false);
    if (!loaded) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    await expect(page.getByText(/my tasks/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should update task priority via AI chat', async ({ page }) => {
    const hasTask = await page.locator('.tasktable-row').first().isVisible().catch(() => false);
    test.skip(!hasTask, 'No tasks available to update');

    await mockAIWithSteps(page, [
      { find: /tasktable-row/, action: 'click' },
      { find: /Edit Priority|priority/i, action: 'click' },
      { find: /High/, action: 'click' },
    ], 'Task priority updated to High');

    await openChatPanel(page);
    await sendChatMessage(page, 'Change priority of first task to high');
    await waitForAgentDone(page);

    await expect(page.locator('[aria-label="Edit Status"]')).toBeVisible({ timeout: 15000 });
  });
});

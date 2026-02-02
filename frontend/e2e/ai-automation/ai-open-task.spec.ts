import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Open Task Detail', () => {
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

  test('should open task detail panel via AI chat', async ({ page }) => {
    const hasTask = await page.locator('.tasktable-row').first().isVisible().catch(() => false);
    test.skip(!hasTask, 'No tasks available to open');

    await mockAIWithSteps(page, [
      { find: /tasktable-row/, action: 'click' },
    ], 'Task details opened');

    await openChatPanel(page);
    await sendChatMessage(page, 'Open the first task');
    await waitForAgentDone(page);

    await expect(page.locator('[aria-label="Edit Status"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#delete-task-button')).toBeVisible({ timeout: 5000 });
  });
});

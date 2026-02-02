import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Filter Tasks by Priority', () => {
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

  test('should filter tasks by high priority via AI chat', async ({ page }) => {
    await mockAIWithSteps(page, [
      { find: /filter-dropdown-trigger/, action: 'click' },
      { find: /Priority/, action: 'click' },
      { find: /High/, action: 'click' },
    ], 'Filtered tasks by High priority');

    await openChatPanel(page);
    await sendChatMessage(page, 'Filter tasks by high priority');
    await waitForAgentDone(page);

    await expect(page).toHaveURL(/priorities=HIGH/i, { timeout: 15000 });
  });
});

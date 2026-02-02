import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Filter Tasks by Status', () => {
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

  test('should filter tasks by status via AI chat', async ({ page }) => {
    await mockAIWithSteps(page, [
      { find: /filter-dropdown-trigger/, action: 'click' },
      { find: /Status/, action: 'click' },
      { find: /role="menuitem"/, action: 'click' },
    ], 'Filtered tasks by status');

    await openChatPanel(page);
    await sendChatMessage(page, 'Filter tasks by status');
    await waitForAgentDone(page);

    await expect(page).toHaveURL(/statuses=/i, { timeout: 15000 });
  });
});

import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Create Task', () => {
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

  test('should create a task via AI chat', async ({ page }) => {
    const taskTitle = `AI Task ${Date.now()}`;

    await mockAIWithSteps(page, [
      { find: /[Cc]reate [Tt]ask|[Cc]reate new [Tt]ask/, action: 'click' },
      { find: /Enter task title|placeholder="Enter task title"/, action: 'type', text: taskTitle },
      { find: /Select workspace|Loading workspaces/, action: 'click' },
      { find: /role="option"/, action: 'click' },
      { find: /Select project|Loading projects/, action: 'click' },
      { find: /role="option"/, action: 'click' },
      { find: />Create</, action: 'click' },
    ], 'Task created successfully');

    await openChatPanel(page);
    await sendChatMessage(page, `Create a task called ${taskTitle}`);
    await waitForAgentDone(page);

    await page.waitForLoadState('networkidle');
    const taskVisible = await page.getByText(taskTitle).isVisible().catch(() => false);
    expect(taskVisible).toBe(true);
  });
});

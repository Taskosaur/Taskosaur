import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Delete Task', () => {
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

  test('should delete a task via AI chat', async ({ page }) => {
    // Create a task first so we don't destroy real data
    await page.getByRole('button', { name: /create task/i }).click();
    await expect(page.getByText('Create new task')).toBeVisible({ timeout: 5000 });

    const taskTitle = `AI Delete Test ${Date.now()}`;
    await page.getByPlaceholder('Enter task title').fill(taskTitle);

    const workspaceBtn = page.getByRole('combobox').filter({ hasText: /^Select workspace$|^Loading workspaces/ });
    await expect(workspaceBtn).toBeEnabled({ timeout: 10000 });
    await workspaceBtn.click();
    await page.locator('[role="option"]').first().click();

    const projectBtn = page.getByRole('combobox').filter({ hasText: /^Select project$|^Loading projects/ });
    await expect(projectBtn).toBeEnabled({ timeout: 10000 });
    await projectBtn.click();
    await page.locator('[role="option"]').first().click();

    const createBtn = page.getByRole('button', { name: /^Create$/ });
    await expect(createBtn).toBeEnabled({ timeout: 10000 });
    await createBtn.click();
    await expect(page.getByText('Create new task')).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 15000 });

    // Now use AI chat to delete it
    const escapedTitle = taskTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await mockAIWithSteps(page, [
      { find: new RegExp(escapedTitle), action: 'click' },
      { find: /delete-task-button/, action: 'click' },
      { find: />Delete</, action: 'click' },
    ], 'Task deleted successfully');

    await openChatPanel(page);
    await sendChatMessage(page, `Delete the task "${taskTitle}"`);
    await waitForAgentDone(page);

    await page.waitForLoadState('networkidle');
    await expect(page.locator('.tasktable-row').filter({ hasText: taskTitle })).not.toBeVisible({ timeout: 15000 });
  });
});

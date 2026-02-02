import { test, expect } from '@playwright/test';

test.describe('Task Creation', () => {
  let workspaceSlug: string;
  let projectSlug: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Reload if auth context hasn't hydrated yet
    const projectLink = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"]'),
    }).first();

    const isVisible = await projectLink.isVisible().catch(() => false);
    if (!isVisible) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    await expect(projectLink).toBeVisible({ timeout: 15000 });

    const href = await projectLink.getAttribute('href');
    expect(href).toBeTruthy();

    const parts = href!.split('/').filter(Boolean);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    workspaceSlug = parts[0];
    projectSlug = parts[1];
  });

  test('should create a new task with required fields', async ({ page }) => {
    await page.goto(`/${workspaceSlug}/${projectSlug}/tasks`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/tasks/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForURL(`**/${workspaceSlug}/${projectSlug}/tasks/new**`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const taskTitle = `E2E Test Task - ${Date.now()}`;
    await page.getByLabel(/task title/i).fill(taskTitle);

    const submitButton = page.getByRole('button', { name: /create task/i });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 15000 });
  });

  test('should not submit task without a title', async ({ page }) => {
    await page.goto(`/${workspaceSlug}/${projectSlug}/tasks`);
    await page.waitForLoadState('networkidle');
    await page.goto(`/${workspaceSlug}/${projectSlug}/tasks/new`);
    await page.waitForLoadState('networkidle');

    const submitButton = page.getByRole('button', { name: /create task/i });
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  });

  test('should create a task with HIGH priority', async ({ page }) => {
    await page.goto(`/${workspaceSlug}/${projectSlug}/tasks`);
    await page.waitForLoadState('networkidle');
    await page.goto(`/${workspaceSlug}/${projectSlug}/tasks/new`);
    await page.waitForLoadState('networkidle');

    const taskTitle = `E2E High Priority Task - ${Date.now()}`;
    await page.getByLabel(/task title/i).fill(taskTitle);

    const prioritySelect = page.locator('label:has-text("Priority")').locator('..').locator('button[role="combobox"]');
    await prioritySelect.click();
    await page.getByRole('option', { name: /high/i }).first().click();

    const submitButton = page.getByRole('button', { name: /create task/i });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    await page.waitForURL(`**/${workspaceSlug}/${projectSlug}/tasks**`, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 15000 });
  });
});

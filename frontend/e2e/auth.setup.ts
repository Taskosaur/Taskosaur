import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '.auth/user.json');

const ADMIN_EMAIL = 'admin@taskosaur.com';
const ADMIN_PASSWORD = 'password123';

setup('authenticate', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await page.waitForURL(/\/(tasks|dashboard|workspaces)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await page.context().storageState({ path: authFile });
});

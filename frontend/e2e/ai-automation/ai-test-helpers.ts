import { Page } from '@playwright/test';

export function findElementIndex(elementsHtml: string, pattern: RegExp): number | null {
  const lines = elementsHtml.split('\n');
  for (const line of lines) {
    if (pattern.test(line)) {
      const match = line.match(/\[(\d+)\]/);
      return match ? parseInt(match[1]) : null;
    }
  }
  return null;
}

export function extractElements(message: string): string {
  const match = message.match(/Available elements:\n([\s\S]*)/);
  return match ? match[1] : '';
}

export interface MockStep {
  find: RegExp;
  action: 'click' | 'type' | 'select';
  text?: string;
}

export async function mockAIWithSteps(
  page: Page,
  steps: MockStep[],
  doneMessage: string,
) {
  let stepIndex = 0;
  let retries = 0;
  const maxRetries = 3;

  await page.route('**/ai-chat/chat', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const elements = extractElements(body.message);

    let response: string;

    if (stepIndex >= steps.length) {
      response = `DONE: ${doneMessage}`;
    } else {
      const step = steps[stepIndex];
      const idx = findElementIndex(elements, step.find);

      if (idx !== null) {
        retries = 0;
        stepIndex++;
        if (step.action === 'type' && step.text) {
          response = `ACTION: type(${idx}, "${step.text}")`;
        } else if (step.action === 'select' && step.text) {
          response = `ACTION: select(${idx}, "${step.text}")`;
        } else {
          response = `ACTION: click(${idx})`;
        }
      } else if (retries < maxRetries) {
        retries++;
        response = `ACTION: scroll("down")`;
      } else {
        retries = 0;
        stepIndex++;
        if (stepIndex >= steps.length) {
          response = `DONE: ${doneMessage}`;
        } else {
          response = `ACTION: scroll("up")`;
        }
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: response, success: true }),
    });
  });
}

export async function mockAIWithDone(page: Page, doneMessage: string) {
  await page.route('**/ai-chat/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: `DONE: ${doneMessage}`, success: true }),
    });
  });
}

export async function enableAIChat(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('aiEnabled', 'true');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

export async function openChatPanel(page: Page) {
  const toggleBtn = page.locator('[aria-label="Toggle AI Chat"]');
  await toggleBtn.waitFor({ state: 'visible', timeout: 10000 });
  await toggleBtn.click();
  await page.getByRole('heading', { name: 'AI Assistant', exact: true }).waitFor({ state: 'visible', timeout: 5000 });
}

export async function sendChatMessage(page: Page, message: string) {
  const textarea = page.getByPlaceholder('Message AI Assistant...');
  await textarea.waitFor({ state: 'visible', timeout: 5000 });
  await textarea.fill(message);
  await textarea.press('Enter');
}

export async function waitForAgentDone(page: Page, timeout = 60000) {
  const textarea = page.getByPlaceholder('Message AI Assistant...');
  await textarea.waitFor({ state: 'visible', timeout });
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const disabled = await textarea.isDisabled();
    if (!disabled) return;
    await page.waitForTimeout(500);
  }
}

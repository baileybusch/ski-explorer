import { expect, test, type Page } from '@playwright/test';

/** Pretend the eve agent is up, so the chat runs in eve mode against mocked routes. */
async function eveUp(page: Page) {
  await page.route('**/eve/v1/health', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'ready' }) }));
}

const RATE_BODY = JSON.stringify({ ok: false, code: 'rate_limited', error: 'Too many questions, try again in a few minutes.' });

function trackSessionTraffic(page: Page) {
  const hits: string[] = [];
  page.on('request', req => {
    const u = new URL(req.url());
    if (/^\/eve\/v1\/session/.test(u.pathname)) hits.push(`${req.method()} ${u.pathname}`);
  });
  return hits;
}

async function homeChatReady(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('home-chat')).toHaveAttribute('data-mode', 'eve', { timeout: 30_000 });
}

test('page load opens no chat session or stream until the chat is used', async ({ page }) => {
  await eveUp(page);
  await page.route('**/eve/v1/session**', route => route.fulfill({ status: 403, contentType: 'application/json', body: RATE_BODY }));
  const hits = trackSessionTraffic(page);
  await homeChatReady(page);
  await page.waitForTimeout(3000);
  expect(hits).toEqual([]);
  // Focusing the input warms the session just in time.
  await page.getByLabel('Ask SkiScope', { exact: true }).last().focus();
  await expect.poll(() => hits.filter(h => h === 'POST /eve/v1/session').length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(hits.some(h => h.endsWith('/stream'))).toBe(false);
});

test('rate limit shows the real reason with Retry and New chat', async ({ page }) => {
  await eveUp(page);
  await page.route('**/eve/v1/session**', route => route.fulfill({ status: 403, contentType: 'application/json', body: RATE_BODY }));
  await homeChatReady(page);
  const input = page.getByLabel('Ask SkiScope', { exact: true }).last();
  await input.fill("How's Alta looking?");
  await page.getByTestId('home-chat-send').click();
  const err = page.getByTestId('home-chat-error');
  await expect(err).toBeVisible({ timeout: 15_000 });
  await expect(err).toHaveAttribute('data-kind', 'rate');
  await expect(err).toContainText('Too many questions, try again in a few minutes.');
  await expect(err).not.toContainText('snow desk');
  await expect(page.getByTestId('home-chat-retry')).toBeVisible();
  await expect(page.getByTestId('home-chat-error-new')).toBeVisible();
  // The question stays on screen above the error.
  await expect(page.locator('[data-testid=home-ask-user], [data-testid=home-ask-user-pending]').first()).toContainText("How's Alta looking?");
  await page.getByTestId('home-chat-error-new').click();
  await expect(err).toHaveCount(0);
  await expect(page.getByTestId('home-chat-empty-state')).toBeVisible();
});

test('conversation cap shows "start a new one" and New chat clears it', async ({ page }) => {
  await eveUp(page);
  await homeChatReady(page);
  await page.evaluate(() => localStorage.setItem('skiscope:chat-sim', 'cap'));
  await page.getByLabel('Ask SkiScope', { exact: true }).last().fill('Compare Alta and Snowbird');
  await page.getByTestId('home-chat-send').click();
  const err = page.getByTestId('home-chat-error');
  await expect(err).toHaveAttribute('data-kind', 'cap');
  await expect(err).toContainText("This chat's gotten long, start a new one.");
  await expect(page.getByTestId('home-chat-error-new')).toHaveText('New chat');
  await expect(page.getByTestId('home-chat-retry')).toHaveText('Ask again in a new chat');
  // Inline chat: a visible New chat control above the thread.
  await expect(page.getByTestId('home-chat-new')).toBeVisible();
  await page.getByTestId('home-chat-new').click();
  await expect(err).toHaveCount(0);
  await expect(page.getByTestId('home-chat-empty-state')).toBeVisible();
});

test('docked chat header has a New chat button once there is something to clear', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'docked panel is the desktop layout');
  await eveUp(page);
  await page.goto('/?ss=board');
  const dock = page.getByTestId('board-chat');
  await expect(dock.getByTestId('home-chat')).toHaveAttribute('data-mode', 'eve', { timeout: 30_000 });
  await expect(dock.getByTestId('home-chat-new')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('skiscope:chat-sim', 'rate'));
  await dock.getByLabel('Ask SkiScope', { exact: true }).fill('Where is it dumping?');
  await dock.getByTestId('home-chat-send').click();
  await expect(dock.getByTestId('home-chat-error')).toHaveAttribute('data-kind', 'rate');
  const btn = dock.getByTestId('home-chat-new');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAccessibleName('New chat');
  await btn.click();
  await expect(dock.getByTestId('home-chat-error')).toHaveCount(0);
  await expect(btn).toHaveCount(0);
});

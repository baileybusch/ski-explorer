import { expect, test } from '@playwright/test';

test('homepage leads with chat, then 3 thought-starter cards and a rotating ghost', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-agent')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('home-trending-card')).toHaveCount(3);
  // Chat sits above the cards.
  const chatBox = await page.getByTestId('home-chat').boundingBox();
  const cardBox = await page.getByTestId('home-trending-card').first().boundingBox();
  expect(chatBox && cardBox && chatBox.y < cardBox.y).toBeTruthy();
  await expect(page.getByTestId('home-chat-starter').first()).toBeVisible();
  await expect(page.getByTestId('home-trending-card').first()).toBeVisible();
  await expect(page.getByTestId('snow-actual-label').first()).toContainText('Last 72h');
  await expect(page.getByTestId('snow-forecast-label').first()).toContainText('Next 7 days');
  await expect(page.getByTestId('home-chat')).toBeVisible();
  const ghost = page.getByTestId('home-chat-ghost');
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText(/Ikon or Epic|Mammoth|Alta|new snow|Utah/i);
});

test('homepage board link opens the leaderboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-agent')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('home-open-board').click();
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
});

test('homepage chat fallback answers a catalog mountain', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('home-chat')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('home-chat')).toHaveAttribute('data-mode', /eve|fallback/, { timeout: 10_000 });
  await page.getByLabel('Ask SkiScope', { exact: true }).last().fill("How's Mammoth looking this weekend?");
  await page.getByTestId('home-chat-send').click();
  await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('ask-answer')).toContainText(/Mammoth|Last 72h|est\.|snow/i);
});

test('reduced motion freezes the home chat ghost', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('home-chat-ghost')).toBeVisible({ timeout: 30_000 });
  const before = await page.getByTestId('home-chat-ghost').getAttribute('data-ghost-index');
  await page.waitForTimeout(4200);
  await expect(page.getByTestId('home-chat-ghost')).toHaveAttribute('data-ghost-index', before || '0');
});

test('See all expands the full list with aligned Actual and Forecast columns', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-trending-card')).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId('home-full-list')).toHaveCount(0);
  await page.getByTestId('home-see-all').click();
  await expect(page.getByTestId('home-full-list')).toBeVisible();
  const rows = page.getByTestId('home-list-row');
  expect(await rows.count()).toBeGreaterThan(5);
  const a = await page.getByTestId('home-list-actual').nth(0).boundingBox();
  const b = await page.getByTestId('home-list-actual').nth(1).boundingBox();
  const fa = await page.getByTestId('home-list-forecast').nth(0).boundingBox();
  const fb = await page.getByTestId('home-list-forecast').nth(1).boundingBox();
  expect(Math.abs((a?.x ?? 0) - (b?.x ?? 1))).toBeLessThan(1);
  expect(Math.abs((fa?.x ?? 0) - (fb?.x ?? 1))).toBeLessThan(1);
  expect(Math.abs((a?.width ?? 0) - (fa?.width ?? 1))).toBeLessThan(2);
  // Single column: every row spans the list width.
  const list = await page.getByTestId('home-full-list').boundingBox();
  const row = await rows.first().boundingBox();
  expect(Math.abs((list?.width ?? 0) - (row?.width ?? 1))).toBeLessThan(2);
  await expect(page.getByTestId('home-full-board')).toBeVisible();
});

test('clicking a thought-starter card asks the chat about that resort', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('home-chat')).toHaveAttribute('data-mode', /eve|fallback/, { timeout: 15_000 });
  const card = page.getByTestId('home-trending-card').first();
  const name = (await card.locator('div.text-lg').innerText()).trim();
  await card.click();
  await expect(page.getByTestId('home-chat')).toContainText(name, { timeout: 40_000 });
});

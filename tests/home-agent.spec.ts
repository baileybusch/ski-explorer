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
  const name = (await card.getByTestId('home-trending-name').innerText()).trim();
  await card.click();
  await expect(page.getByTestId('home-chat')).toContainText(name, { timeout: 40_000 });
});

test('Claude-style single column: chat card and trending cards share one centered column', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByTestId('home-trending-card')).toHaveCount(3, { timeout: 30_000 });
  const vw = page.viewportSize()!.width;
  const desktop = info.project.name.startsWith('desktop');
  const chat = (await page.getByTestId('home-chat').boundingBox())!;
  const composer = (await page.getByTestId('home-chat-composer').boundingBox())!;
  const grid = (await page.getByTestId('home-trending').boundingBox())!;
  if (desktop) {
    expect(chat.width).toBeGreaterThanOrEqual(800);
    expect(chat.width).toBeLessThanOrEqual(860);
    expect(Math.abs(chat.x + chat.width / 2 - vw / 2)).toBeLessThan(4);
    // Input card is the big rounded box (~130px).
    expect(composer.height).toBeGreaterThanOrEqual(120);
    expect(composer.height).toBeLessThan(170);
    // Three cards in one row, exactly the column width.
    const boxes = await Promise.all((await page.getByTestId('home-trending-card').all()).map(c => c.boundingBox()));
    expect(new Set(boxes.map(b => Math.round(b!.y))).size).toBe(1);
    expect(Math.abs(grid.x - chat.x)).toBeLessThan(2);
    expect(Math.abs(grid.width - chat.width)).toBeLessThan(2);
    const preview = (await page.getByTestId('home-trending-preview').first().boundingBox())!;
    expect(preview.height).toBeGreaterThanOrEqual(120);
  } else {
    expect(chat.width).toBeGreaterThan(vw - 40);
    expect(Math.abs(grid.width - chat.width)).toBeLessThan(2);
  }
  // No big blank panel before the first question.
  expect(chat.height).toBeLessThan(desktop ? 360 : 520);
  await expect(page.getByTestId('home-see-all')).toBeVisible();
  await expect(page.getByText('Trending mountains')).toBeVisible();
});

test('greeting streams in (dots, type-in, chips) without blocking the input', async ({ page }) => {
  await page.goto('/');
  const state = page.getByTestId('home-chat-empty-state');
  await expect(state).toBeVisible({ timeout: 30_000 });
  // Input is usable while the greeting animates.
  const input = page.getByLabel('Ask SkiScope', { exact: true }).last();
  await input.fill('typing early');
  await expect(input).toHaveValue('typing early');
  await expect(state).toHaveAttribute('data-greeting', 'done', { timeout: 5_000 });
  await expect(page.getByTestId('home-chat-empty')).toHaveAttribute('aria-label', "Hey! Ask me where to ski, or how a mountain's looking.");
  await expect(page.getByTestId('home-chat-empty')).toContainText("Hey! Ask me where to ski, or how a mountain's looking.");
  await expect(page.locator('[data-testid=home-chat-starters] > [data-shown="1"]')).toHaveCount(4, { timeout: 2_000 });
});

test('reduced motion shows the greeting and chips instantly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const state = page.getByTestId('home-chat-empty-state');
  await expect(state).toBeVisible({ timeout: 30_000 });
  await expect(state).toHaveAttribute('data-greeting', 'done');
  await expect(page.locator('[data-testid=home-chat-starters] > [data-shown="0"]')).toHaveCount(0);
});

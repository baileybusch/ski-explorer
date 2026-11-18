import { expect, test } from '@playwright/test';

test('homepage shows trending cards and a rotating chat ghost', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-agent')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('home-trending-card')).toHaveCount(2);
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

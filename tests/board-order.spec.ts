import { expect, test } from '@playwright/test';

test('home board is monotonic by 72h observed, featured is #1', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-rank-hint')).toHaveText(/Ranked by last 72h observed/i);
  await expect(page.getByTestId('board-updated')).toBeVisible();

  const cards = page.getByTestId('block');
  const n = await cards.count();
  expect(n).toBeGreaterThan(2);

  const ranks: number[] = [];
  const snow72: number[] = [];
  const next7: number[] = [];
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    ranks.push(Number(await card.getAttribute('data-rank')));
    snow72.push(Number(await card.getAttribute('data-snow72')));
    next7.push(Number(await card.getAttribute('data-next7')));
  }

  expect(ranks[0]).toBe(1);
  for (let i = 1; i < ranks.length; i++) {
    expect(ranks[i]).toBe(ranks[i - 1] + 1);
    const cmp = snow72[i - 1] - snow72[i] || next7[i - 1] - next7[i];
    expect(cmp).toBeGreaterThanOrEqual(0);
  }
});

test('resort page has Alert me and no trip card', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('profile-alert-me')).toBeVisible();
  await expect(page.getByTestId('tile-trip')).toHaveCount(0);
  await expect(page.getByTestId('tile-storm-status').getByTestId('plan-trip')).toHaveCount(0);
  await expect(page.getByTestId('tile-facts')).toContainText(/Mountain Facts/);
});

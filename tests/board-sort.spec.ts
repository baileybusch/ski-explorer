import { expect, test } from '@playwright/test';

test('sort control reorders the whole board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-sort')).toHaveValue('actual72');

  await page.getByTestId('board-sort').selectOption('name');
  await expect(page.getByTestId('board-rank-hint')).toHaveText(/A–Z|A-Z/);
  const names = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || ''));
  const firsts = names.map(a => a.split(',')[0]);
  const sorted = [...firsts].sort((a, b) => a.localeCompare(b));
  expect(firsts).toEqual(sorted);

  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect(page.getByTestId('board-rank-hint')).toHaveText(/next 7 days/i);
  const next7 = await page.getByTestId('block').evaluateAll(els => els.map(e => Number(e.getAttribute('data-next7'))));
  for (let i = 1; i < next7.length; i++) {
    expect(next7[i - 1]).toBeGreaterThanOrEqual(next7[i]);
  }
});

test('region filter and observed-only apply to the board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('board-region').selectOption('japan');
  await expect(page.getByTestId('back-to-all')).toBeVisible();
  const japanIds = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-resort') || ''));
  expect(japanIds.length).toBeGreaterThan(0);
  expect(japanIds.every(id => /niseko|furano|rusutsu|kiroro|tomamu|larch|zao|hakuba|shiga|appi|arai|madarao|mt-t|myoko|nekoma/i.test(id))).toBeTruthy();

  await page.getByTestId('board-region').selectOption({ label: 'All' });
  await page.getByTestId('observed-only').click();
  await expect(page.getByTestId('observed-only')).toHaveAttribute('aria-pressed', 'true');
  const flags = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-estimated')));
  expect(flags.length).toBeGreaterThan(0);
  expect(flags.every(v => v === '0')).toBeTruthy();
});

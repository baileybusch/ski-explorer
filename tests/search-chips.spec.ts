import { expect, test } from '@playwright/test';

test('region chip on iPhone 13 filters the board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  const before = await page.getByTestId('block').first().getAttribute('data-resort');

  await page.getByTestId('search-trigger').click();
  await expect(page.getByTestId('search')).toBeVisible();
  const japan = page.getByTestId('region-japan');
  await expect(japan).toBeVisible();
  await japan.click();

  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('back-to-all')).toBeVisible();
  const after = await page.getByTestId('block').first().getAttribute('data-resort');
  const names = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-resort')));
  expect(names.length).toBeGreaterThan(0);
  expect(after).not.toBe(before);
  expect(names.some(id => /niseko|furano|rusutsu|kiroro|tomamu|larch|zao|hakuba|shiga|appi/i.test(id || ''))).toBeTruthy();
});

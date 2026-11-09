import { expect, test } from '@playwright/test';

const JAPAN = /niseko|furano|rusutsu|kiroro|tomamu|larch|zao|hakuba|shiga|appi|arai|madarao|mt-t|myoko|nekoma/i;

test('region filter on iPhone 13 filters the board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('board-region').selectOption('japan');
  await expect(page.getByTestId('back-to-all')).toBeVisible();
  const names = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-resort')));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every(id => JAPAN.test(id || ''))).toBeTruthy();
});

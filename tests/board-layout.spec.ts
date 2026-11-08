import { expect, test } from '@playwright/test';

test('desktop board is a bounded grid with balanced cards', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop proportions only');
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-shell')).toHaveCSS('max-width', '1120px');
  await expect(page.getByTestId('board-toolbar')).toBeVisible();
  await expect(page.getByTestId('board-sort')).toBeVisible();
  await expect.poll(async () => page.getByTestId('board-b').getAttribute('data-cols')).toBe('4');

  const featured = page.getByTestId('block').first();
  const card = page.getByTestId('block').nth(1);
  const featBox = await featured.boundingBox();
  const cardBox = await card.boundingBox();
  expect(featBox).toBeTruthy();
  expect(cardBox).toBeTruthy();
  expect(featBox!.width).toBeGreaterThan(900);
  expect(featBox!.height).toBeGreaterThan(150);
  expect(featBox!.height).toBeLessThan(220);
  expect(cardBox!.width).toBeGreaterThan(200);
  expect(cardBox!.width).toBeLessThan(320);
  expect(cardBox!.height).toBeGreaterThan(140);
  expect(cardBox!.width / cardBox!.height).toBeLessThan(2.1);
});

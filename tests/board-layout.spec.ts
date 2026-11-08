import { expect, test } from '@playwright/test';

test('desktop board is a bounded leaderboard aligned to the featured row', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('desktop'), 'desktop proportions only');
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-shell')).toHaveCSS('max-width', '1200px');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-layout', 'table');
  await expect(page.getByTestId('board-table-head')).toBeVisible();

  const featured = page.getByTestId('block').first();
  await expect(featured).toHaveAttribute('data-featured', '1');
  const fBox = (await featured.boundingBox())!;
  expect(fBox.width).toBeGreaterThan(1000);
  expect(fBox.width).toBeLessThanOrEqual(1200);
  expect(fBox.height).toBeGreaterThan(130);
  expect(fBox.height).toBeLessThan(200);

  const rows = page.getByTestId('board-rows').getByTestId('block');
  expect(await rows.count()).toBeGreaterThan(8);
  const heights = await rows.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);

  const actualX = await rows.getByTestId('cell-actual').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().left)));
  const forecastX = await rows.getByTestId('cell-forecast').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().left)));
  expect(new Set(actualX).size).toBe(1);
  expect(new Set(forecastX).size).toBe(1);
  const fActual = (await featured.getByTestId('snow-actual-col').boundingBox())!;
  const fForecast = (await featured.getByTestId('snow-forecast-col').boundingBox())!;
  expect(Math.abs(fActual.x - actualX[0])).toBeLessThanOrEqual(2);
  expect(Math.abs(fForecast.x - forecastX[0])).toBeLessThanOrEqual(2);
});

test('desktop column headers sort the board', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('desktop'), 'table headers are desktop only');
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('sort-col-forecast7d').click();
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'forecast7d');
  await expect(page.getByTestId('board-sort')).toHaveValue('forecast7d');
  await expect(page.getByTestId('sort-col-forecast7d')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('sort-col-actual72').click();
  await expect(page.getByTestId('board-sort')).toHaveValue('actual72');
});

test('phone board stays compact cards with no blank cells', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('desktop'), 'phone only');
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-layout', 'cards');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-cols', '2');
  const featured = (await page.getByTestId('block').first().boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(featured.height).toBeLessThan(vh * 0.25);
  const grid = (await page.getByTestId('board-cards').boundingBox())!;
  const cards = await page.getByTestId('block').evaluateAll(els => els.map(e => {
    const r = e.getBoundingClientRect();
    return { l: r.left, r: r.right };
  }));
  const last = cards.slice(-2);
  expect(Math.max(...last.map(c => c.r))).toBeGreaterThan(grid.x + grid.width - 2);
});

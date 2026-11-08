import { expect, test, type Page } from '@playwright/test';

const isDesktop = (name: string) => name.startsWith('desktop');

async function openBoard(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('block').first()).toBeVisible();
}

/** Right edge of each stat column per row: numbers line up when every row shares one x. */
async function statEdges(page: Page, testid: string) {
  return page.getByTestId('block').getByTestId(testid).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().right)));
}

test('one full-width leaderboard list on every size; #1 only lightly featured', async ({ page }, info) => {
  await openBoard(page);
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-layout', 'list');
  await expect(page.getByTestId('board-list-head')).toBeVisible();
  const boxes = await page.getByTestId('block').evaluateAll(els => els.map(e => {
    const r = e.getBoundingClientRect();
    return { l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
  }));
  expect(boxes.length).toBeGreaterThan(8);
  expect(new Set(boxes.map(b => b.l)).size).toBe(1);
  expect(new Set(boxes.map(b => b.w)).size).toBe(1);
  const rowH = boxes[1].h;
  expect(new Set(boxes.slice(1).map(b => b.h)).size).toBe(1);
  expect(boxes[0].h).toBeGreaterThan(rowH);
  expect(boxes[0].h).toBeLessThanOrEqual(Math.round(rowH * 1.35));
  await expect(page.getByTestId('block').first()).toHaveAttribute('data-featured', '1');
  if (isDesktop(info.project.name)) {
    await expect(page.getByTestId('board-shell')).toHaveCSS('max-width', '1200px');
    await expect(page.getByTestId('board-b')).toHaveAttribute('data-density', 'full');
  } else {
    await expect(page.getByTestId('board-b')).toHaveAttribute('data-density', 'compact');
  }
});

test('stat columns stay fixed and right-aligned while the sort re-ranks rows', async ({ page }) => {
  await openBoard(page);
  const before = { a: await statEdges(page, 'cell-actual'), f: await statEdges(page, 'cell-forecast') };
  expect(new Set(before.a).size).toBe(1);
  expect(new Set(before.f).size).toBe(1);
  await expect(page.getByTestId('cell-actual').first()).toHaveAttribute('data-active', '1');
  await expect(page.getByTestId('cell-forecast').first()).toHaveAttribute('data-active', '0');

  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'forecast7d');
  await expect(page.getByTestId('cell-forecast').first()).toHaveAttribute('data-active', '1');
  await expect(page.getByTestId('cell-actual').first()).toHaveAttribute('data-active', '0');
  await page.waitForTimeout(400);
  const after = { a: await statEdges(page, 'cell-actual'), f: await statEdges(page, 'cell-forecast') };
  expect(after.a[0]).toBe(before.a[0]);
  expect(after.f[0]).toBe(before.f[0]);
  expect(new Set(after.f).size).toBe(1);
  const next7 = await page.getByTestId('block').evaluateAll(els => els.map(e => Number(e.getAttribute('data-next7'))));
  for (let i = 1; i < next7.length; i++) expect(next7[i - 1]).toBeGreaterThanOrEqual(next7[i]);
});

test('column headers sort the board and stay pinned while scrolling', async ({ page }, info) => {
  await openBoard(page);
  await page.getByTestId('sort-col-forecast7d').click();
  await expect(page.getByTestId('board-sort')).toHaveValue('forecast7d');
  await expect(page.getByTestId('sort-col-forecast7d')).toHaveAttribute('aria-pressed', 'true');
  if (isDesktop(info.project.name)) {
    await page.getByTestId('sort-col-actual24').click();
    await expect(page.getByTestId('board-sort')).toHaveValue('actual24');
    await page.getByTestId('sort-col-actual72').click();
  } else {
    await page.getByTestId('sort-col-actual').click();
    await expect(page.getByTestId('board-sort')).toHaveValue('actual72');
    await expect(page.getByTestId('sort-col-actual')).toHaveText(/Last 72h/);
    await page.getByTestId('sort-col-actual').click();
    await expect(page.getByTestId('board-sort')).toHaveValue('actual24');
    await expect(page.getByTestId('sort-col-actual')).toHaveText(/Last 24h/);
    await page.getByTestId('sort-col-actual').click();
  }
  await expect(page.getByTestId('board-sort')).toHaveValue('actual72');

  const board = page.getByTestId('board-b');
  const top = (await board.boundingBox())!.y;
  await board.evaluate(el => { el.scrollTop = 600; });
  await page.waitForTimeout(150);
  const head = (await page.getByTestId('board-list-head').boundingBox())!;
  expect(Math.abs(head.y - top)).toBeLessThanOrEqual(2);
});

test('iPhone 13 shows at least 8 resorts on the first screen', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone-13', 'iPhone 13 density target');
  await openBoard(page);
  const visible = await page.getByTestId('block').evaluateAll(els => els.filter(e => {
    const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  }).length);
  expect(visible).toBeGreaterThanOrEqual(8);
});

test('desktop docks Ask SkiScope beside the board', async ({ page }, info) => {
  test.skip(!isDesktop(info.project.name), 'docked panel is desktop only');
  await openBoard(page);
  const panel = page.getByTestId('search');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-docked', '1');
  await expect(page.getByTestId('ask-close')).toHaveCount(0);
  const p = (await panel.boundingBox())!;
  const list = (await page.getByTestId('board-list').boundingBox())!;
  expect(list.x + list.width).toBeLessThanOrEqual(p.x + 1);
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await page.getByTestId('search-trigger').click();
  await expect(page.getByLabel('Ask SkiScope', { exact: true }).last()).toBeFocused();
});

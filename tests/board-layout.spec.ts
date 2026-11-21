import { trackAgentCalls, expectNoQuestionSent } from './helpers/chat';
import { expect, test, type Page } from '@playwright/test';

const isDesktop = (name: string) => name.startsWith('desktop');

async function openBoard(page: Page) {
  await page.goto('/?ss=board');
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
  expect(boxes[0].h).toBe(rowH);
  await expect(page.getByTestId('block').first()).toHaveAttribute('data-featured', '1');
  if (isDesktop(info.project.name)) {
    await expect(page.getByTestId('board-shell')).toHaveCSS('max-width', '1440px');
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

test('desktop: chat docks under the header beside the list; menu is top-right; rows show data, then ask', async ({ page }, info) => {
  test.skip(!isDesktop(info.project.name), 'docked panel is desktop only');
  await openBoard(page);
  await expect(page.getByTestId('nav-resorts')).toHaveText('Resorts');
  const dock = page.getByTestId('board-chat');
  await expect(dock).toHaveAttribute('data-presentation', 'docked');
  await expect(dock).toBeVisible();
  await expect(page.getByTestId('search')).toHaveAttribute('data-docked', '1');
  await expect(page.getByTestId('ask-close')).toHaveCount(0);
  await expect(page.getByTestId('search-trigger')).toHaveCount(0);
  const d = (await dock.boundingBox())!;
  const header = (await page.getByTestId('board-chrome').boundingBox())!;
  const menu = (await page.getByTestId('menu-button').boundingBox())!;
  const list = (await page.getByTestId('board-list-panel').boundingBox())!;
  // Header spans the top; chat sits under it, to the right of the list, ~380-420px wide.
  expect(d.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(list.x + list.width).toBeLessThanOrEqual(d.x + 1);
  expect(d.width).toBeGreaterThanOrEqual(380);
  expect(d.width).toBeLessThanOrEqual(420);
  expect(menu.x + menu.width).toBeGreaterThan(d.x + d.width - 40);
  expect(menu.y + menu.height).toBeLessThanOrEqual(header.y + header.height);
  // The list scrolls on its own; the chat stays put.
  await page.getByTestId('board-b').evaluate(el => { el.scrollTop = 600; });
  expect((await dock.boundingBox())!.y).toBe(d.y);
  // Row tap shows that resort's data in the dock (board stays); its Ask button asks the chat; chevron opens the resort page.
  const first = page.getByTestId('block').first();
  const name = (await first.getAttribute('aria-label'))!.split(':')[0];
  await first.click();
  await expect(dock.getByTestId('resort-peek-name')).toHaveText(name.split(',')[0]);
  await expect(dock.getByTestId('ask-user')).toHaveCount(0);
  await dock.getByTestId('resort-peek-ask').click();
  await expect(dock.getByTestId('ask-user').last()).toContainText(name.split(' ')[0], { timeout: 15_000 });
  await expect(page.getByTestId('board-b')).toBeVisible();
  await page.getByTestId('row-open').first().click();
  await expect(page.getByTestId('resort-profile')).toBeVisible({ timeout: 20_000 });
});

test('mobile: sticky Ask bar opens the chat sheet below the header; menu stays reachable', async ({ page }, info) => {
  test.skip(isDesktop(info.project.name), 'sheet is mobile only');
  await openBoard(page);
  await expect(page.getByTestId('board-chat')).toHaveAttribute('data-open', '0');
  const bar = page.getByTestId('search-trigger');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('Ask SkiScope');
  await bar.click();
  const sheet = page.getByTestId('board-chat');
  await expect(sheet).toHaveAttribute('data-open', '1');
  await expect(sheet).toHaveAttribute('data-presentation', 'sheet');
  const header = (await page.getByTestId('board-chrome').boundingBox())!;
  const s = (await sheet.boundingBox())!;
  expect(s.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  await page.getByTestId('menu-button').click();
  await expect(page.getByTestId('settings-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('board-chat-close').click();
  await expect(sheet).toHaveAttribute('data-open', '0');
  // Row tap opens the sheet with that resort's data; nothing is sent until a prompt is tapped.
  const calls = trackAgentCalls(page);
  await page.getByTestId('block').first().click();
  await expect(sheet).toHaveAttribute('data-open', '1');
  await expect(sheet.getByTestId('resort-peek')).toBeVisible();
  await page.waitForTimeout(800);
  await expectNoQuestionSent(page, sheet);
  expect(calls).toHaveLength(0);
  await sheet.getByTestId('resort-peek-ask').click();
  await expect(sheet.getByTestId('resort-peek')).toHaveCount(0);
  await expect(sheet.locator('[data-testid=home-ask-user], [data-testid=ask-user]').last()).toBeVisible({ timeout: 15_000 });
});

test('mountain click shows its data first and spends no agent call (desktop dock)', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('desktop'), 'desktop dock');
  const calls = trackAgentCalls(page);
  await page.goto('/?ss=board');
  const row = page.getByTestId('block').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const id = await row.getAttribute('data-resort');
  await row.click();
  const dock = page.getByTestId('board-chat');
  const peek = dock.getByTestId('resort-peek');
  await expect(peek).toBeVisible();
  if (id) await expect(peek).toHaveAttribute('data-resort', id);
  await expect(peek.getByTestId('resort-peek-snow')).toBeVisible();
  await expect(peek.getByTestId('resort-peek-status')).not.toBeEmpty();
  await expect(peek.getByTestId('resort-peek-now')).toContainText(/Today/);
  await expect(peek.getByTestId('resort-peek-forecast').locator('li')).toHaveCount(5);
  await expect(peek.getByTestId('resort-peek-prompt')).toHaveCount(2);
  await page.waitForTimeout(1000);
  await expectNoQuestionSent(page, dock);
  expect(calls).toHaveLength(0);
  await peek.getByTestId('resort-peek-close').click();
  await expect(peek).toHaveCount(0);
});

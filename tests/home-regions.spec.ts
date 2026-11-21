import { trackAgentCalls, expectNoQuestionSent } from './helpers/chat';
import { expect, test } from '@playwright/test';

test('home: "Browse by region" tiles sit under the trending cards, in the same column', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-trending-card')).toHaveCount(3, { timeout: 30_000 });
  const tiles = page.getByTestId('home-region-tile');
  expect(await tiles.count()).toBeGreaterThanOrEqual(6);
  await expect(tiles.first()).toContainText('California');
  await expect(page.getByTestId('home-region-stat').first()).toContainText(/\d+ resorts/);
  const cards = (await page.getByTestId('home-trending').boundingBox())!;
  const regions = (await page.getByTestId('home-regions').boundingBox())!;
  expect(regions.y).toBeGreaterThan(cards.y + cards.height);
  expect(Math.abs(regions.x - cards.x)).toBeLessThan(2);
  expect(Math.abs(regions.width - cards.width)).toBeLessThan(2);
  // Footer: legal only, aligned to the same column on desktop.
  const footer = page.getByTestId('site-footer');
  await expect(footer.locator('a[href*="/region/"]')).toHaveCount(0);
  await expect(page.getByTestId('footer-unsubscribe')).toBeVisible();
  const vw = page.viewportSize()!.width;
  if (vw >= 900) {
    const f = (await footer.boundingBox())!;
    expect(Math.abs(f.x - cards.x)).toBeLessThan(2);
    expect(Math.abs(f.width - cards.width)).toBeLessThan(2);
  }
});

test('tapping a region opens the region view with its resorts and a region-scoped chat', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('[data-testid=home-region-tile][data-region=utah]').click();
  await expect(page).toHaveURL(/\/explore\/utah/);
  await expect(page.getByTestId('region-view')).toHaveAttribute('data-region', 'utah');
  await expect(page.getByTestId('region-heading')).toHaveText('Utah');
  const rows = page.getByTestId('home-list-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId('region-full-board')).toHaveAttribute('href', /\/region\/utah/);
  const desktop = info.project.name.startsWith('desktop');
  const chat = page.getByTestId('region-chat');
  if (desktop) {
    // Side panel beside the list.
    await expect(chat).toBeVisible();
    const list = (await page.getByTestId('home-full-list').boundingBox())!;
    const panel = (await chat.boundingBox())!;
    expect(panel.x).toBeGreaterThan(list.x + list.width - 1);
    await expect(page.getByTestId('region-chat-bar')).toHaveCount(0);
  } else {
    // Sticky bar opens the chat full screen.
    await expect(chat).toBeHidden();
    await page.getByTestId('region-chat-bar').click();
    await expect(chat).toBeVisible();
    await expect(chat).toHaveAttribute('data-open', '1');
  }
  // Scoped greeting + starters.
  await expect(chat.getByTestId('home-chat-empty')).toHaveAttribute('aria-label', /best in Utah/);
  await expect(chat.getByTestId('home-chat-starter').first()).toContainText('Utah');
  if (!desktop) {
    await page.getByTestId('region-chat-close').click();
    await expect(chat).toBeHidden();
  }
  // Back returns to the home page.
  await page.goBack();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByTestId('home-region-tile').first()).toBeVisible();
  await expect(page.getByTestId('region-view')).toHaveCount(0);
});

test('/explore/<id> deep-links straight into the region view; row tap shows data, prompt asks the chat', async ({ page }, info) => {
  const calls = trackAgentCalls(page);
  await page.goto('/explore/japan');
  await expect(page.getByTestId('region-heading')).toHaveText('Japan', { timeout: 30_000 });
  await expect(page.getByTestId('home-chat')).toHaveAttribute('data-mode', /eve|fallback/, { timeout: 15_000 });
  const name = (await page.getByTestId('home-list-row').first().locator('.line-clamp-2').innerText()).trim();
  await page.getByTestId('home-list-row').first().click();
  const chat = page.getByTestId('region-chat');
  await expect(chat).toBeVisible();
  const peek = chat.getByTestId('resort-peek');
  await expect(peek.getByTestId('resort-peek-name')).toHaveText(name);
  await page.waitForTimeout(800);
  await expectNoQuestionSent(page, chat);
  expect(calls).toHaveLength(0);
  await peek.getByTestId('resort-peek-ask').click();
  await expect(chat.getByTestId('home-chat')).toContainText(name, { timeout: 40_000 });
  void info;
});

test('tapping a region tile opens the region page scrolled to the top', async ({ page }) => {
  await page.goto('/');
  const tile = page.locator('[data-testid=home-region-tile][data-region=california]');
  await expect(tile).toBeVisible({ timeout: 30_000 });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page.getByTestId('region-heading')).toBeVisible();
  await page.waitForTimeout(600);
  const top = await page.evaluate(() => [window.scrollY, ...[...document.querySelectorAll<HTMLElement>('[data-app-scroller]')].map(e => e.scrollTop)]);
  expect(Math.max(...top)).toBe(0);
  await expect(page.getByTestId('region-heading')).toBeInViewport();
});

test('mountain summary card: forecast row visible without scrolling, storm line in plain words', async ({ page }) => {
  await page.goto('/explore/california');
  await expect(page.getByTestId('region-heading')).toHaveText('California', { timeout: 30_000 });
  await page.getByTestId('home-list-row').first().click();
  const peek = page.getByTestId('region-chat').getByTestId('resort-peek');
  await expect(peek).toBeVisible();
  const status = await peek.getByTestId('resort-peek-status').innerText();
  expect(status).not.toMatch(/SNOTEL|CDEC|snow-depth|water equivalent|SWE|still on the forecast/);
  const fc = (await peek.getByTestId('resort-peek-forecast').boundingBox())!;
  const body = (await peek.getByTestId('resort-peek-body').boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(fc.y + fc.height).toBeLessThanOrEqual(Math.min(vh, body.y + body.height) + 1);
  expect(await peek.getByTestId('resort-peek-body').evaluate(el => el.scrollTop)).toBe(0);
});

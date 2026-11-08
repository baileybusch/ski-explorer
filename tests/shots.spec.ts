import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

function shotDir() {
  for (const dir of [
    '/opt/cursor/artifacts/screenshots',
    '/workspace/artifacts/screenshots',
    'tmp/screenshots',
  ]) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '.writable'), '1');
      return dir;
    } catch { /* next */ }
  }
  return 'tmp/screenshots';
}

const DIR = shotDir();

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true });
});

test('fresh screenshots: board, hero, storm, trip, manage', async ({ page }, info) => {
  test.setTimeout(90_000);
  const device = info.project.name;
  test.skip(!['iphone-13', 'desktop'].includes(device), 'pass 4 shots on iPhone 13 + desktop');
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().screenshot({ path: `${DIR}/board-featured-${device}.png` });
  await page.screenshot({ path: `${DIR}/board-ranked-${device}.png`, fullPage: false });
  if (device === 'iphone-13') {
    await page.getByTestId('block').first().screenshot({ path: `${DIR}/board-card-actual-forecast.png` });
    await page.screenshot({ path: `${DIR}/board-ranked.png`, fullPage: false });
  }

  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('tile-trip')).toHaveCount(0);
  await page.getByTestId('profile-hero').screenshot({ path: `${DIR}/resort-hero-${device}.png` });
  await page.getByTestId('profile-page').screenshot({ path: `${DIR}/resort-page-no-trip-${device}.png`, fullPage: false });
  if (device === 'iphone-13') {
    await page.getByTestId('profile-hero').screenshot({ path: `${DIR}/resort-hero-actual-forecast.png` });
    await page.getByTestId('tile-storm-status').screenshot({ path: `${DIR}/storm-status.png` });
    await page.screenshot({ path: `${DIR}/resort-page-no-trip.png`, fullPage: false });
  }

  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('menu-button').click();
  await page.getByTestId('plan-trip').click();
  await expect(page.getByTestId('trip-onboarding')).toBeVisible();
  await page.screenshot({ path: `${DIR}/trip-dates-${device}.png`, fullPage: false });
  if (device === 'iphone-13') {
    await page.screenshot({ path: `${DIR}/trip-dates.png`, fullPage: false });
  }
  await page.getByTestId('trip-month-2026-12').click();
  await expect(page.getByTestId('trip-who')).toBeVisible({ timeout: 8_000 });
  await page.screenshot({ path: `${DIR}/trip-auto-advance-who-${device}.png`, fullPage: false });
  if (device === 'iphone-13') {
    await page.screenshot({ path: `${DIR}/trip-auto-advance-who.png`, fullPage: false });
  }
  await page.getByTestId('trip-onboarding-back').click();
  await page.getByTestId('trip-onboarding').locator('button', { hasText: 'Close' }).click();

  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('home-signup').scrollIntoViewIfNeeded();
  await page.getByTestId('home-signup').screenshot({ path: `${DIR}/home-monitor-cta.png` });

  await page.getByTestId('search-trigger').click();
  await page.getByLabel('Ask SkiScope').fill('Japan');
  await page.getByLabel('Ask SkiScope').press('Enter');
  await expect(page.getByTestId('intent-chip')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${DIR}/search-japan-chip.png`, fullPage: false });
  await page.getByTestId('context-cta').screenshot({ path: `${DIR}/search-japan-cta.png` });

  await page.goto('/manage?alerts=1');
  await expect(page.getByTestId('manage-page')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${DIR}/manage-direct-url.png`, fullPage: false });
});

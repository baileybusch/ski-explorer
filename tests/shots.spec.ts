import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const DIR = '/opt/cursor/artifacts/screenshots';

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true });
});

test('fresh screenshots: board, hero, storm, trip, manage', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone-13', 'one device is enough for the artifact set');
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().screenshot({ path: `${DIR}/board-card-actual-forecast.png` });
  await page.screenshot({ path: `${DIR}/board-ranked.png`, fullPage: false });

  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('profile-hero').screenshot({ path: `${DIR}/resort-hero-actual-forecast.png` });
  await page.getByTestId('tile-storm-status').screenshot({ path: `${DIR}/storm-status.png` });

  await page.getByTestId('plan-trip').click();
  await expect(page.getByTestId('trip-onboarding')).toBeVisible();
  await page.screenshot({ path: `${DIR}/trip-dates.png`, fullPage: false });
  await page.getByTestId('trip-month-2026-12').click();
  await expect(page.getByTestId('trip-who')).toBeVisible({ timeout: 8_000 });
  await page.screenshot({ path: `${DIR}/trip-auto-advance-who.png`, fullPage: false });
  await page.getByTestId('trip-onboarding-back').click();
  await page.getByTestId('trip-onboarding').locator('button', { hasText: 'Close' }).click();

  await page.goto('/manage?alerts=1');
  await expect(page.getByTestId('manage-page')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${DIR}/manage-direct-url.png`, fullPage: false });
});

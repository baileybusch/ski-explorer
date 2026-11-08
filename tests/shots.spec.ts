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

test('pass 5 screenshots: home + resort on phone and desktop', async ({ page }, info) => {
  test.setTimeout(90_000);
  const device = info.project.name;
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-toolbar')).toBeVisible();
  await page.screenshot({ path: `${DIR}/pass5-home-${device}.png`, fullPage: false });
  if (device === 'iphone-13') {
    await page.screenshot({ path: `${DIR}/pass5-home-mobile.png`, fullPage: false });
  }
  if (device === 'iphone-se') {
    await page.screenshot({ path: `${DIR}/pass5-home-mobile-se.png`, fullPage: false });
  }
  if (device === 'desktop') {
    await page.screenshot({ path: `${DIR}/pass5-home-desktop.png`, fullPage: false });
    await page.locator('[data-testid="board-b"] .grid').first().screenshot({ path: `${DIR}/pass5-home-desktop-grid.png` });
  }

  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('tile-storm-status')).toBeVisible();
  await expect(page.getByTestId('tile-trip')).toHaveCount(0);
  await page.screenshot({ path: `${DIR}/pass5-resort-${device}.png`, fullPage: false });
  if (device === 'iphone-13') {
    await page.screenshot({ path: `${DIR}/pass5-resort-mobile.png`, fullPage: false });
  }
  if (device === 'iphone-se') {
    await page.screenshot({ path: `${DIR}/pass5-resort-mobile-se.png`, fullPage: false });
  }
  if (device === 'desktop') {
    await page.screenshot({ path: `${DIR}/pass5-resort-desktop.png`, fullPage: false });
    await page.getByTestId('tile-facts').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${DIR}/pass5-resort-desktop-lower.png`, fullPage: false });
  }
});

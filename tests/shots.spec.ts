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

test('design screenshots: home + resort per device', async ({ page }, info) => {
  test.setTimeout(120_000);
  const device = info.project.name;
  const desktop = device.startsWith('desktop');
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-toolbar')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/design-home-${device}.png` });

  if (desktop) {
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: 1500 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/design-home-${device}-full-board.png` });
    await page.setViewportSize(vp);
  }

  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect(page.getByTestId('cell-forecast').first()).toHaveAttribute('data-active', '1');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/leaderboard-forecast-${device}.png` });
  await page.getByTestId('board-sort').selectOption('actual72');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/leaderboard-default-${device}.png` });

  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('tile-storm-status')).toBeVisible();
  await expect(page.getByTestId('tile-trip')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/design-resort-${device}.png` });
  await page.getByTestId('tile-today').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DIR}/design-resort-${device}-lower.png` });
  await page.getByTestId('tile-snow').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DIR}/design-resort-${device}-history.png` });
});

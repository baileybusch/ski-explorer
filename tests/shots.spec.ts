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

test('ux pass screenshots: home, empty chat, resort chat, synopsis, map layers', async ({ page }, info) => {
  test.setTimeout(120_000);
  const device = info.project.name;
  if (device !== 'iphone-13' && device !== 'desktop') test.skip();

  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/ux-home-${device}.png` });

  await page.getByTestId('search-trigger').click();
  await expect(page.getByTestId('ask-empty')).toBeVisible();
  await expect(page.getByTestId('ask-suggestion')).toHaveCount(3);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/ux-chat-empty-${device}.png` });
  const close = page.getByTestId('ask-close');
  if (await close.count()) await close.click({ force: true }).catch(() => {});
  await page.keyboard.press('Escape');

  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('tile-storm-status')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/ux-storm-synopsis-${device}.png` });

  await page.getByTestId('profile-ask').click();
  await expect(page.getByTestId('ask-empty')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/ux-resort-chat-${device}.png` });
  if (await close.count()) await close.click({ force: true }).catch(() => {});
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('resort-profile')).toBeVisible();

  await page.getByTestId('profile-map').click();
  await expect(page.getByTestId('map-mode')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('layers-button')).toBeVisible();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${DIR}/ux-map-radar-${device}.png` });

  await page.getByTestId('layers-button').click();
  await expect(page.getByTestId('layers-popover')).toBeVisible();
  const clouds = page.getByTestId('layer-clouds');
  if ((await clouds.getAttribute('disabled')) == null && (await clouds.getAttribute('data-disabled')) == null) {
    await clouds.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${DIR}/ux-map-clouds-${device}.png` });
  } else {
    await page.getByTestId('layer-radar').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-radar', 'off', { timeout: 10_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${DIR}/ux-map-storms-${device}.png` });
  }
});

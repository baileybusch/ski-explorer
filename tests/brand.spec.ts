import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const DIR = '/opt/cursor/artifacts/screenshots';

async function openHome(page: Page, qs = '') {
  await page.goto(`/${qs}`);
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('block').first()).toBeVisible();
}

test('default brand stays SkiScope', async ({ page }) => {
  await openHome(page);
  await expect(page).toHaveTitle('SkiScope · Monitor the snow');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/logo.svg');
  const mark = page.getByTestId('board-chrome').getByTestId('wordmark');
  await expect(mark).toHaveAttribute('data-brand', 'skiscope');
  await expect(mark).toHaveText('SKISCOPE');
  await expect(page.getByTestId('logo-home')).toHaveAccessibleName('SkiScope home');
});

test('?brand=powtracker swaps name, mark, title, favicon and keeps the param', async ({ page }) => {
  await openHome(page, '?brand=powtracker');
  await expect(page).toHaveTitle(/^PowTracker/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand/powtracker.svg');
  const mark = page.getByTestId('board-chrome').getByTestId('wordmark');
  await expect(mark).toHaveAttribute('data-variant', 'caps');
  await expect(mark).toHaveText('POWTRACKER');
  await expect(page.getByTestId('logo-home')).toHaveAccessibleName('PowTracker home');
  await page.getByTestId('search-trigger').click();
  await expect(page.getByLabel('Ask PowTracker', { exact: true }).last()).toBeVisible();
  await expect(page.getByLabel('Ask SkiScope', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect.poll(() => new URL(page.url()).searchParams.get('brand')).toBe('powtracker');

  await openHome(page, '?brand=powtracker&wordmark=mixed');
  await expect(page.getByTestId('board-chrome').getByTestId('wordmark')).toHaveText('PowTracker');
  await expect(page.getByTestId('board-chrome').getByTestId('wordmark')).toHaveAttribute('data-variant', 'mixed');
});

test('brand screenshots: PowTracker home, header comparison, large mark', async ({ page }, info) => {
  const device = info.project.name;
  test.skip(device !== 'iphone-13' && device !== 'desktop', 'iPhone 13 + desktop 1440 only');
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });

  await openHome(page, '?brand=powtracker');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/brand-powtracker-home-${device}.png` });

  const variants = [
    { qs: '', label: 'SkiScope (live)' },
    { qs: '?brand=powtracker', label: 'PowTracker · condensed caps' },
    { qs: '?brand=powtracker&wordmark=mixed', label: 'PowTracker · mixed case' },
  ];
  const shots: { label: string; src: string }[] = [];
  for (const v of variants) {
    await openHome(page, v.qs);
    await page.waitForTimeout(300);
    const png = await page.getByTestId('board-chrome').screenshot();
    shots.push({ label: v.label, src: `data:image/png;base64,${png.toString('base64')}` });
  }

  const mobile = device === 'iphone-13';
  const w = mobile ? 1290 : 1440;
  await page.setViewportSize({ width: w, height: 900 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#08090b;color:#9aa0aa;font:500 14px/1.3 -apple-system,system-ui,sans-serif">
    <div id="sheet" style="display:${mobile ? 'grid;grid-template-columns:repeat(3,1fr)' : 'flex;flex-direction:column'};gap:24px;padding:24px">
      ${shots.map(s => `<figure style="margin:0"><figcaption style="margin:0 0 8px 4px;letter-spacing:.04em">${s.label}</figcaption>
        <img src="${s.src}" style="display:block;width:100%;border-radius:12px;outline:1px solid rgba(242,243,245,.1)"></figure>`).join('')}
    </div></body></html>`);
  await page.locator('#sheet').screenshot({ path: `${DIR}/brand-headers-${device}.png` });

  if (device !== 'desktop') return;
  const mark = readFileSync('public/brand/powtracker-mark.svg', 'utf8');
  const tile = readFileSync('public/brand/powtracker.svg', 'utf8');
  const sized = (svg: string, px: number) => svg.replace('<svg ', `<svg width="${px}" height="${px}" `);
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#08090b;color:#7a808a;font:500 13px/1.3 -apple-system,system-ui,sans-serif">
    <div id="mark" style="display:grid;place-items:center;width:640px;height:640px;background:#08090b">${sized(mark, 480)}</div>
    <div id="sizes" style="display:flex;align-items:flex-end;gap:40px;padding:40px;background:#08090b">
      ${[16, 24, 32, 64, 128, 256].map(px => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">${sized(tile, px)}<span>${px}px</span></div>`).join('')}
    </div></body></html>`);
  await page.locator('#mark').screenshot({ path: `${DIR}/brand-powtracker-mark.png` });
  await page.locator('#sizes').screenshot({ path: `${DIR}/brand-powtracker-favicon-sizes.png` });
});

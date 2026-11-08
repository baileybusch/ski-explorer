import { expect, test } from '@playwright/test';

test('board rows show last 72h and next 7 days as equal stat columns', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-rank-hint')).toHaveText(/Ranked by last 72h/);
  const row = page.getByTestId('block').first();
  await expect(row.getByTestId('cell-actual')).toBeVisible();
  await expect(row.getByTestId('cell-forecast')).toBeVisible();
  await expect(row.getByTestId('cell-forecast')).not.toHaveText(/coming/i);
  await expect(page.getByTestId('board-list-head')).toContainText(/Last 72h/);
  await expect(page.getByTestId('board-list-head')).toContainText(/Next 7/);
  const est = await row.getAttribute('data-estimated');
  await expect(row.getByTestId('cell-actual').getByTestId('est-tag')).toHaveCount(est === '1' ? 1 : 0);
  await expect(page.getByTestId('radar-thumb')).toHaveCount(0);
  const aria = await row.getAttribute('aria-label');
  expect(aria || '').toMatch(/last 72 hours/i);
  expect(aria || '').toMatch(/forecast next 7 days/i);
});

test('resort hero and storm status split actual vs forecast', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  const hero = page.getByTestId('profile-hero');
  await expect(hero.getByTestId('snow-actual-label')).toHaveText(/Last 72h/i);
  await expect(hero.getByTestId('snow-forecast-label')).toHaveText(/Next 7 days/i);
  await expect(hero.getByTestId('snow-forecast')).not.toHaveText(/coming/i);
  const storm = page.getByTestId('storm-status-text');
  await expect(storm).toBeVisible();
  const text = await storm.innerText();
  expect(text).toMatch(/last 72h/i);
  expect(text.toLowerCase()).toMatch(/forecast|nothing over/);
});

import { expect, test } from '@playwright/test';

test('board cards show actual last 72h, not the dump sum', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('board-rank-hint')).toHaveText(/Ranked by last 72h \+ next 7 days/);
  const card = page.getByTestId('block').first();
  await expect(card.getByTestId('snow-actual')).toBeVisible();
  await expect(card.getByTestId('snow-actual-label')).toHaveText(/last 72h/i);
  await expect(card.getByTestId('snow-forecast')).toHaveText(/\+.*coming/i);
  const aria = await card.getAttribute('aria-label');
  expect(aria || '').toMatch(/last 72 hours/i);
  expect(aria || '').toMatch(/forecast next 7 days/i);
});

test('resort hero and storm status split actual vs forecast', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  const hero = page.getByTestId('profile-hero');
  await expect(hero.getByTestId('snow-actual-label')).toHaveText(/last 72h/i);
  await expect(hero.getByTestId('snow-forecast')).toHaveText(/\+.*coming/i);
  const storm = page.getByTestId('storm-status-text');
  await expect(storm).toBeVisible();
  const text = await storm.innerText();
  expect(text).toMatch(/last 72h/i);
  expect(text.toLowerCase()).toMatch(/forecast|nothing over/);
});

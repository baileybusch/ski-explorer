import { expect, test } from '@playwright/test';

test('home CTA opens the shared alert flow', async ({ page }) => {
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('home-signup').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('home-signup-submit')).toHaveText(/Monitor your home resort/i);
  await page.getByTestId('home-signup-submit').click();
  await expect(page.getByTestId('alert-onboarding')).toBeVisible();
  await expect(page.getByTestId('alert-search')).toBeVisible();
});

test('Japan search shows interpretation chip and context CTA', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('search-trigger').click();
  await expect(page.getByTestId('search')).toBeVisible();
  await page.getByLabel('Ask SkiScope').fill('Japan');
  await page.getByLabel('Ask SkiScope').press('Enter');
  await expect(page.getByTestId('intent-chip')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('intent-chip')).toContainText(/Japan/i);
  await expect(page.getByTestId('context-cta')).toBeVisible();
  await expect(page.getByTestId('context-cta-btn')).toContainText(/Japan|Monitor/i);
  await page.getByTestId('context-cta-btn').click();
  await expect(page.getByTestId('alert-onboarding')).toBeVisible();
  await expect(page.getByTestId('alert-region-scope')).toBeVisible();
});

test('footer mentions MCP', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('site-footer').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('footer-mcp')).toBeVisible();
});

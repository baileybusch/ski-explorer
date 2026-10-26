import { expect, test } from '@playwright/test';

async function openTrip(page) {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('plan-trip')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('plan-trip').click();
  await expect(page.getByTestId('trip-onboarding')).toBeVisible();
}

test('trip month pick auto-advances and does not scroll sideways', async ({ page }) => {
  await openTrip(page);
  const flow = page.getByTestId('trip-onboarding');
  expect(await flow.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
  await page.getByTestId('trip-month-2026-12').click();
  await expect(page.getByTestId('trip-who')).toBeVisible({ timeout: 8_000 });
  await page.getByTestId('trip-onboarding-back').click();
  await expect(page.getByTestId('trip-month-2026-12')).toBeVisible();
  await page.getByTestId('trip-next').click();
  await expect(page.getByTestId('trip-who')).toBeVisible();
  await page.getByTestId('trip-next').click();
  await expect(page.getByTestId('trip-stay')).toBeVisible();
  await page.getByTestId('trip-lodging-hotel').click();
  await expect(page.getByTestId('trip-results')).toBeVisible({ timeout: 8_000 });
  expect(await page.getByTestId('trip-onboarding').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
});

test('alert flow is resort then email, no threshold step', async ({ page }) => {
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('home-signup').scrollIntoViewIfNeeded();
  await page.getByTestId('home-signup-email').fill('bailey@example.com');
  await page.getByTestId('home-signup-submit').click();
  await expect(page.getByTestId('alert-onboarding')).toBeVisible();
  await expect(page.getByTestId('alert-search')).toBeVisible();
  await expect(page.locator('[data-testid^="alert-inches-"]')).toHaveCount(0);
  await page.locator('[data-testid^="alert-resort-"]').first().click();
  await expect(page.getByTestId('alert-success')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId('alert-check-email')).toBeVisible();
});

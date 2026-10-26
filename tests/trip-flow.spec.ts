import { expect, test } from '@playwright/test';

async function openTrip(page) {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('plan-trip')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('plan-trip').click();
  await expect(page.getByTestId('trip-onboarding')).toBeVisible();
}

function noHorizontalOverflow(sel: string) {
  return (s: string) => {
    const el = document.querySelector(`[data-testid="${s}"]`);
    if (!el) return true;
    return el.scrollWidth <= el.clientWidth + 1;
  };
}

test('trip month pick auto-advances and does not scroll sideways', async ({ page }) => {
  await openTrip(page);
  const flow = page.getByTestId('trip-onboarding');
  expect(await flow.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
  await page.getByTestId('trip-month-2026-12').click();
  await expect(page.getByRole('heading', { name: /Who/ })).toBeVisible({ timeout: 3_000 });
  await page.getByTestId('trip-onboarding-back').click();
  await expect(page.getByTestId('trip-month-2026-12')).toBeVisible();
  await page.getByTestId('trip-next').click();
  await expect(page.getByRole('heading', { name: /Who/ })).toBeVisible();
  await page.getByTestId('trip-next').click();
  await page.getByTestId('trip-lodging-hotel').click();
  await expect(page.getByTestId('trip-results')).toBeVisible({ timeout: 3_000 });
  expect(await page.getByTestId('trip-onboarding').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
  void noHorizontalOverflow;
});

test('alert flow is resort then email, no threshold step', async ({ page }) => {
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('home-signup-email').fill('bailey@example.com');
  await page.getByTestId('home-signup-submit').click();
  await expect(page.getByTestId('alert-onboarding')).toBeVisible();
  await expect(page.getByTestId('alert-resort-search')).toBeVisible();
  await expect(page.getByTestId('alert-inches-6')).toHaveCount(0);
  const first = page.locator('[data-testid^="alert-resort-"]').first();
  await first.click();
  await expect(page.getByTestId('alert-success')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('alert-check-email')).toBeVisible();
});

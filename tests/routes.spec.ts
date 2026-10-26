import { expect, test } from '@playwright/test';

const PAGES = [
  { path: '/manage', testId: 'manage-page' },
  { path: '/manage/', testId: 'manage-page' },
  { path: '/manage?x=1', testId: 'manage-page' },
  { path: '/manage?token=ss1.preview', testId: 'manage-page' },
  { path: '/privacy', testId: 'static-page' },
  { path: '/terms', testId: 'static-page' },
  { path: '/contact', testId: 'static-page' },
  { path: '/about', testId: 'static-page' },
  { path: '/disclosure', testId: 'static-page' },
];

for (const page of PAGES) {
  test(`fresh load ${page.path} is not 404`, async ({ page: p }) => {
    const res = await p.goto(page.path, { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), `${page.path} status ${res?.status()}`).toBeTruthy();
    expect(p.url()).not.toMatch(/404/);
    await expect(p.getByTestId(page.testId)).toBeVisible({ timeout: 20_000 });
    await expect(p.locator('text=404')).toHaveCount(0);
  });
}

test('SPA paths return 200 HTML (production-style request)', async ({ request }) => {
  for (const path of ['/manage', '/manage/', '/manage?x=1', '/privacy', '/terms', '/contact', '/about', '/disclosure']) {
    const res = await request.get(path);
    expect(res.status(), path).toBeLessThan(400);
    const type = res.headers()['content-type'] || '';
    expect(type, path).toMatch(/html|text/);
  }
});

test('hamburger Manage account is /manage and loads on assign', async ({ page }) => {
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('menu-button').click();
  const account = page.getByTestId('menu-account');
  await expect(account).toBeVisible();
  await account.click();
  await expect(page.getByTestId('manage-page')).toBeVisible({ timeout: 20_000 });
  expect(new URL(page.url()).pathname.replace(/\/$/, '')).toBe('/manage');
});

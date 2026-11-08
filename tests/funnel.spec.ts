import { readFileSync, existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const desktop = (page: Page) => (page.viewportSize()?.width || 0) >= 1024;

async function finishOnboarding(page: Page, email: string) {
  await expect(page.getByTestId('alert-onboarding')).toBeVisible();
  const all = page.getByTestId('alert-scope-all');
  if (await all.isVisible().catch(() => false)) await all.click();
  for (let i = 0; i < 5 && !(await page.getByTestId('alert-email').isVisible()); i++) {
    const next = page.getByTestId('alert-next');
    if (await next.isEnabled().catch(() => false)) await next.click();
    else await page.waitForTimeout(300);
  }
  await expect(page.getByTestId('alert-email')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId('alert-consent')).toContainText("don't sell your info");
  await page.getByTestId('alert-email').fill(email);
  await page.getByTestId('alert-submit').click();
  await expect(page.getByTestId('alert-success')).toBeVisible({ timeout: 8_000 });
}

test('region page is its own board with a region alert CTA', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/region/california?alerts=1');
  await expect(page.getByTestId('category-header')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('category-title')).toHaveText(/California/);
  await expect(page).toHaveTitle(/California snow/);
  await expect(page.getByTestId('category-cta')).toHaveText('Get alerts for California');
  await expect(page.getByTestId('category-consent')).toContainText("don't sell your info");
  await expect(page.getByTestId('category-consent').getByTestId('consent-dns-link')).toHaveAttribute('href', /do-not-sell/);
  await expect(page.getByTestId('category-share')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  await page.getByTestId('category-cta').click();
  await finishOnboarding(page, 'region-test@example.com');
  await expect(page.getByTestId('alert-share')).toBeVisible();
});

test('pass and resort pages have their own title', async ({ page }) => {
  await page.goto('/pass/ikon');
  await expect(page.getByTestId('category-title')).toHaveText(/Ikon/, { timeout: 30_000 });
  await expect(page).toHaveTitle(/Ikon Pass snow/);
  await page.goto('/resort/alta');
  await expect(page).toHaveTitle(/Alta snow/, { timeout: 30_000 });
});

test('Ask offers alerts inline once per session and can be dismissed', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?alerts=1');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  if (!desktop(page)) await page.getByTestId('search-trigger').click();
  const box = page.getByRole('textbox', { name: /Ask/ }).last();
  await box.fill('hi');
  await box.press('Enter');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('ask-offer')).toHaveCount(0);
  await box.fill('Is Alta getting snow this week?');
  await box.press('Enter');
  const offer = page.getByTestId('ask-offer');
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await expect(offer).toHaveAttribute('data-target', 'alta');
  await expect(page.getByTestId('ask-offer-headline')).toHaveText('Want me to alert you when Alta gets dumped on?');
  await page.getByTestId('ask-offer-dismiss').click();
  await expect(page.getByTestId('ask-offer-dismissed')).toBeVisible();
  await box.fill('What about Snowbird next week?');
  await box.press('Enter');
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('ask-offer')).toHaveCount(0);
  await expect(page.getByTestId('ask-offer-dismissed')).toBeVisible();
});

test('My alerts lists watched mountains and Do Not Sell is a one-tap opt out', async ({ page }) => {
  await page.goto('/my-alerts?alerts=1');
  await expect(page.getByTestId('manage-title')).toHaveText('My alerts', { timeout: 30_000 });
  await page.getByTestId('manage-email').fill('me@example.com');
  await page.getByTestId('manage-dev-signin').first().click();
  await expect(page.getByTestId('my-alerts-section')).toBeVisible();
  await expect(page.getByTestId('pref-dns')).toBeVisible();

  await page.goto('/do-not-sell');
  await expect(page.getByTestId('dns-page')).toHaveAttribute('data-opted-out', '0', { timeout: 30_000 });
  await expect(page.getByTestId('dns-page')).toContainText(/do not sell or share your email/i);
  await page.getByTestId('dns-toggle').click();
  await expect(page.getByTestId('dns-page')).toHaveAttribute('data-opted-out', '1');

  await page.goto('/privacy');
  await expect(page.getByTestId('draft-flag')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('static-page')).toContainText(/do not sell or share your email/i);
});

test('admin needs the password, labels demo data, and exports aggregates without emails', async ({ page, request }) => {
  test.skip(!existsSync('tmp/.admin-dev-password'), 'dev admin password is created by the dev server');
  expect((await request.get('/api/admin?action=dashboard')).status()).toBe(401);
  await page.goto('/admin?demo=1');
  await page.getByTestId('admin-password').fill('wrong');
  await page.getByTestId('admin-login-submit').click();
  await expect(page.getByTestId('admin-login-error')).toBeVisible();
  await page.getByTestId('admin-password').fill(readFileSync('tmp/.admin-dev-password', 'utf8').trim());
  await page.getByTestId('admin-login-submit').click();
  await expect(page.getByTestId('admin-demo-banner')).toContainText('DEMO DATA');
  await expect(page.getByTestId('admin-kpis')).toBeVisible();
  const partners = await page.request.get('/api/admin?action=export&kind=aggregates&audience=partners&demo=1');
  const pText = await partners.text();
  expect(pText).toContain('signup_source');
  expect(pText).not.toMatch(/@/);
});

test('email template index renders every welcome step', async ({ request }) => {
  const index = await request.get('/api/email/preview?type=index');
  expect(index.ok()).toBeTruthy();
  const html = await index.text();
  for (const t of ['welcome-1', 'welcome-2', 'welcome-3', 'confirm', 'alert', 'recap']) expect(html).toContain(`type=${t}`);
  for (const step of [1, 2, 3]) {
    const json = await (await request.get(`/api/email/preview?type=welcome-${step}&format=json`)).json();
    expect(json.subject).toBeTruthy();
    const html = await (await request.get(`/api/email/preview?type=welcome-${step}`)).text();
    expect(html).toContain(`${step} of 3`);
  }
});

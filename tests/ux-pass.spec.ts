import { expect, test, type Page } from '@playwright/test';

async function openBoard(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('block').first()).toBeVisible();
}

async function openFirstResort(page: Page) {
  await openBoard(page);
  await page.getByTestId('block').first().click();
  await expect(page.getByTestId('resort-profile')).toBeVisible({ timeout: 20_000 });
}

test('home has no Observed only toggle and keeps honest est. tags', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId('observed-only')).toHaveCount(0);
  await expect(page.getByTestId('board-sort')).toHaveValue('actual72');
  await expect(page.getByTestId('board-sort').locator('option')).toHaveText(['Last 72h', 'Last 24h', 'Next 7 days', 'Name']);
  const flags = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-estimated')));
  expect(flags.some(v => v === '1')).toBeTruthy();
  await expect(page.getByTestId('est-tag').first()).toBeVisible();
});

test('sort reorders stable row identities without dropping resorts', async ({ page }) => {
  await openBoard(page);
  const before = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-resort')));
  const first = before[0];
  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'forecast7d');
  const after = await page.getByTestId('block').evaluateAll(els => els.map(e => e.getAttribute('data-resort')));
  expect(after).toHaveLength(before.length);
  expect(new Set(after).size).toBe(after.length);
  expect(after[0]).not.toBe(first);
  await page.getByTestId('board-sort').selectOption('actual72');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'actual72');
  await expect(page.getByTestId('block').first()).toHaveAttribute('data-resort', first!);
});

test('reduced motion skips board FLIP and freezes ghost text', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBoard(page);
  const ghost = page.getByTestId('search-ghost');
  await expect(ghost).toBeVisible();
  const i = await ghost.getAttribute('data-ghost-index');
  await page.waitForTimeout(4500);
  await expect(ghost).toHaveAttribute('data-ghost-index', i || '0');
  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect(page.locator('[data-flip="1"]')).toHaveCount(0);
});

test('home ghost prompt rotates with a fade, and pauses once the field has a query', async ({ page }) => {
  await openBoard(page);
  const ghost = page.getByTestId('search-ghost');
  await expect(ghost).toBeVisible();
  await expect.poll(async () => ghost.getAttribute('data-ghost-index'), { timeout: 8_000 }).not.toBe('0');
  await page.getByTestId('search-trigger').click();
  await expect(page.getByTestId('search')).toBeVisible();
  await page.getByLabel('Ask SkiScope', { exact: true }).last().fill('Utah');
  await page.getByLabel('Ask SkiScope', { exact: true }).last().press('Enter');
  await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('search-trigger')).toContainText(/Utah/i);
  await expect(page.getByTestId('search-ghost')).toHaveCount(0);
});

test('empty chat is compact: few prompts, no board filter wall', async ({ page }) => {
  await openBoard(page);
  await page.getByTestId('search-trigger').click();
  await expect(page.getByTestId('search')).toBeVisible();
  await expect(page.getByTestId('ask-empty')).toBeVisible();
  await expect(page.getByTestId('ask-suggestion')).toHaveCount(3);
  await expect(page.getByTestId('search-chips')).toHaveCount(0);
  await expect(page.getByTestId('ask-composer')).toBeVisible();
  await expect(page.getByTestId('ask-empty')).not.toContainText(/Filter the board/i);
});

test('resort storm synopsis is natural, sourced, and has a restrained Ask entry', async ({ page }) => {
  await openFirstResort(page);
  const storm = page.getByTestId('storm-status-text');
  await expect(storm).toBeVisible();
  const text = await storm.innerText();
  expect(text).not.toMatch(/Storm status:/);
  expect(text.toLowerCase()).toMatch(/last 72 hours/);
  expect(text.toLowerCase()).not.toMatch(/measured snowfall|measured in the last 72/);
  await expect(page.getByTestId('storm-source')).toBeVisible();
  const source = await page.getByTestId('storm-source').innerText();
  expect(source.toLowerCase()).not.toMatch(/measured snowfall/);
  expect(source).toMatch(/not recorded snowfall|snowfall estimate, not a station/i);
  await expect(page.getByTestId('profile-alert-me')).toBeVisible();
  await expect(page.getByTestId('profile-ask')).toBeVisible();
  await expect(page.getByTestId('tile-facts')).toBeVisible();
  await expect(page.getByTestId('tile-trip')).toHaveCount(0);
});

test('radar player leaves loading and map back returns to the resort', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/resort/blue-mountain-on?alerts=1');
  await expect(page.getByTestId('resort-profile')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('tile-radar').scrollIntoViewIfNeeded();
  const player = page.getByTestId('radar-player');
  await expect(player).toBeVisible();
  await expect.poll(async () => player.getAttribute('data-status'), { timeout: 20_000 }).not.toBe('loading');
  const status = await player.getAttribute('data-status');
  expect(['ready', 'empty', 'error']).toContain(status);
  if (status === 'empty') {
    await expect(page.getByTestId('radar-player-msg')).toContainText(/unavailable, not a clear sky/i);
  }
  if (status === 'ready') {
    const cover = await player.getAttribute('data-cover');
    expect(['precip', 'clear', 'unavailable', 'error', 'unknown']).toContain(cover);
    await expect(page.getByTestId('radar-cover-note')).toBeVisible();
    if (cover === 'precip') {
      await expect.poll(async () => Number((await player.getAttribute('data-opaque')) || '0'), { timeout: 10_000 }).toBeGreaterThan(100);
    } else if (cover === 'clear') {
      await expect.poll(async () => (await player.getAttribute('data-opaque')) || '', { timeout: 10_000 }).toMatch(/^0$|^$/);
    }
  }

  await page.getByTestId('profile-map').click();
  await expect(page.getByTestId('map-mode')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('map-back')).toBeVisible();
  await expect(page.getByTestId('list-button')).toHaveCount(0);
  await expect(page.getByText('Cards', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('layers-button')).toBeVisible();
  await expect(page.getByTestId('map-radar-chip')).toBeVisible();
  await expect(page.getByTestId('map-storm-chip')).toContainText(/Storm rings/i);
  await expect.poll(async () => page.getByTestId('globe').getAttribute('data-radar-ready'), { timeout: 20_000 }).toBe('1');
  const cover = await page.getByTestId('globe').getAttribute('data-radar-cover');
  expect(['precip', 'clear', 'unavailable', 'error', 'unknown']).toContain(cover);
  if (cover === 'empty' || cover === 'unavailable') {
    await expect(page.getByTestId('map-radar-chip')).toContainText(/unavailable/i);
  } else if (cover === 'clear') {
    await expect(page.getByTestId('map-radar-chip')).toContainText(/no echo/i);
  } else if (cover === 'precip') {
    await expect(page.getByTestId('map-radar-chip')).toContainText(/precipitation/i);
  }
  await expect(page.getByTestId('map-storm-chip')).toContainText(/Storm rings on/);
  await expect.poll(async () => Number((await page.getByTestId('globe').getAttribute('data-storm-rings')) || '0'), { timeout: 15_000 }).toBeGreaterThan(0);

  await page.waitForTimeout(2500);
  const globeBox = await page.getByTestId('globe').boundingBox();
  expect(globeBox).toBeTruthy();
  const radarOnShot = await page.screenshot({ clip: globeBox! });

  await page.getByTestId('layers-button').click();
  await expect(page.getByTestId('layers-popover')).toBeVisible();
  await expect(page.getByTestId('layer-radar')).toBeChecked();
  await expect(page.getByTestId('layer-storms')).toBeChecked();
  await expect(page.getByTestId('layer-storms-note')).toContainText(/independent of radar/i);
  const clouds = page.getByTestId('layer-clouds');
  if (await clouds.isDisabled()) {
    await expect(page.getByTestId('layer-clouds-note')).toContainText(/no frames|offline|unavailable/i);
  } else {
    await clouds.click();
    await expect(page.getByTestId('globe')).toHaveAttribute('data-clouds', 'on', { timeout: 10_000 });
    await clouds.click();
  }
  await page.getByTestId('layer-radar').click();
  await expect(page.getByTestId('layer-radar')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('globe')).toHaveAttribute('data-radar', 'off', { timeout: 8_000 });
  await expect(page.getByTestId('map-radar-chip')).toHaveText(/Radar off/);
  await page.waitForTimeout(700);
  const radarOffShot = await page.screenshot({ clip: globeBox! });
  expect(radarOnShot.equals(radarOffShot), 'radar on vs off should change the rendered map').toBe(false);

  await page.getByTestId('layers-button').click();
  await expect(page.getByTestId('layers-popover')).toBeVisible();
  await page.getByTestId('layer-storms').click();
  await expect(page.getByTestId('layer-storms')).not.toBeChecked();
  await expect(page.getByTestId('globe')).toHaveAttribute('data-storms', 'off', { timeout: 8_000 });
  await expect(page.getByTestId('map-storm-chip')).toHaveText(/Storm rings off/i);
  await page.keyboard.press('Escape');

  await page.getByTestId('map-back').click();
  await expect(page.getByTestId('resort-profile')).toBeVisible();
});

test('Ask about this mountain opens chat with resort context', async ({ page }) => {
  await openFirstResort(page);
  const name = (await page.getByTestId('profile-ask').innerText()).replace(/^Ask about\s+/i, '').trim();
  await page.getByTestId('profile-ask').click();
  await expect(page.getByTestId('search')).toBeVisible();
  await expect(page.getByTestId('ask-empty')).toContainText(new RegExp(name.split(' ')[0], 'i'));
  await expect(page.getByTestId('ask-suggestion')).toHaveCount(3);
  await expect(page.getByTestId('ask-composer')).toBeVisible();
  await expect(page.getByLabel('Ask SkiScope', { exact: true }).last()).toHaveAttribute('placeholder', new RegExp(name.split(' ')[0], 'i'));
});

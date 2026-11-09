import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const JAPAN = /niseko|furano|rusutsu|kiroro|tomamu|larch|zao|hakuba|shiga|appi|arai|madarao|mt-t|myoko|nekoma|happo|naeba|nozawa|gala|lotte|kagura|tsugaike|cortina-japan|iwatake|sahoro|teine|kokusai|annupuri|moiwa|hanazono|niseko|asahidake|tazawako|geto|hachimantai|kiroro|akakura|suginohara|ikenotaira/i;

function shotDir() {
  for (const dir of ['/opt/cursor/artifacts/screenshots', '/workspace/artifacts/screenshots', 'tmp/screenshots']) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '.writable'), '1');
      return dir;
    } catch { /* next */ }
  }
  return 'tmp/screenshots';
}

async function openAsk(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('search-trigger').click();
  await expect(page.getByTestId('search')).toBeVisible({ timeout: 15_000 });
}

async function ask(page: Page, text: string) {
  const input = page.getByLabel('Ask SkiScope', { exact: true }).last();
  const before = await page.getByTestId('ask-answer').count();
  await input.fill(text);
  await input.press('Enter');
  await expect(page.getByTestId('ask-answer')).toHaveCount(before + 1, { timeout: 20_000 });
  const answer = page.getByTestId('ask-answer').nth(before);
  await expect(answer.getByTestId('ask-sources')).toBeVisible({ timeout: 20_000 });
  await expect(answer.getByTestId('ask-answer-text')).not.toBeEmpty();
  return answer;
}

test('search box opens the Ask thread with suggestions; board stays home', async ({ page }, info) => {
  await openAsk(page);
  await expect(page.getByTestId('ask-suggestion')).toHaveCount(3);
  await expect(page.getByTestId('search-chips')).toHaveCount(0);
  await page.keyboard.press('Escape');
  if (info.project.name.startsWith('desktop')) await expect(page.getByTestId('search')).toHaveAttribute('data-docked', '1');
  else await expect(page.getByTestId('search')).toBeHidden();
  await expect(page.getByTestId('board-b')).toBeVisible();
});

test('most snow right now: ranked list in actual-72h order with forecast beside it', async ({ page }) => {
  await openAsk(page);
  await page.getByTestId('ask-suggestion').first().click();
  const answer = page.getByTestId('ask-answer').last();
  await expect(answer.getByTestId('ask-ranked')).toBeVisible({ timeout: 20_000 });
  const rows = answer.getByTestId('ask-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  const actual = await rows.evaluateAll(els => els.map(e => Number(e.getAttribute('data-actual'))));
  for (let i = 1; i < actual.length; i++) expect(actual[i - 1]).toBeGreaterThanOrEqual(actual[i]);
  await expect(answer.getByTestId('stake-actual').first()).toBeVisible();
  await expect(answer.getByTestId('stake-forecast').first()).toBeVisible();
  await expect(answer.getByTestId('ask-answer-text')).toContainText(/most snow|quiet/i);
  await expect(answer).toHaveAttribute('data-mode', /fallback|llm/);
});

async function boardTop(page: Page) {
  return page.getByTestId('block').evaluateAll(els => els.map(e => ({
    id: e.getAttribute('data-resort'), est: e.getAttribute('data-estimated'),
  })));
}

/** Board order once filters have settled (two identical reads in a row). */
async function settledBoardTop(page: Page) {
  let prev = '';
  await expect.poll(async () => {
    const cur = JSON.stringify(await boardTop(page));
    const same = cur === prev;
    prev = cur;
    return same;
  }, { intervals: [150, 250, 400] }).toBe(true);
  return JSON.parse(prev) as Awaited<ReturnType<typeof boardTop>>;
}

async function askTop(answer: ReturnType<Page['getByTestId']>) {
  return answer.getByTestId('ask-row').evaluateAll(els => els.map(e => ({
    id: e.getAttribute('data-resort'), est: e.getAttribute('data-estimated'),
  })));
}

test('chat ranking is the board ranking: same snapshot, scope, order, and est.', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-b')).toBeVisible({ timeout: 30_000 });
  const board = await settledBoardTop(page);
  await page.getByTestId('search-trigger').click();
  const answer = await ask(page, 'Which resort is getting the most snow right now?');
  const chat = await askTop(answer);
  expect(chat.length).toBeGreaterThanOrEqual(5);
  expect(chat).toEqual(board.slice(0, chat.length));
  await expect(answer.getByTestId('ask-ranked')).toContainText(/Ikon resorts, ranked by actual 72h/);

  await page.keyboard.press('Escape');
  await page.getByTestId('board-sort').selectOption('actual24');
  await page.getByTestId('board-region').selectOption('utah');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'actual24');
  const scopedBoard = await settledBoardTop(page);
  await page.getByTestId('search-trigger').click();
  const scopedAnswer = await ask(page, 'Most snow in the last 24 hours');
  const scoped = await askTop(scopedAnswer);
  expect(scoped.length).toBeGreaterThanOrEqual(3);
  expect(scoped).toEqual(scopedBoard.slice(0, scoped.length));
  await expect(scopedAnswer.getByTestId('ask-ranked')).toContainText(/Ikon resorts in Utah/);

  await page.keyboard.press('Escape');
  await page.getByTestId('board-region').selectOption('');
  await page.getByTestId('board-sort').selectOption('forecast7d');
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'forecast7d');
  const forecastBoard = await settledBoardTop(page);
  await page.getByTestId('search-trigger').click();
  const forecastAnswer = await ask(page, 'Who is getting the most snow?');
  const forecastChat = await askTop(forecastAnswer);
  expect(forecastChat).toEqual(forecastBoard.slice(0, forecastChat.length));
  await expect(forecastAnswer.getByTestId('ask-ranked')).toContainText(/ranked by forecast 7d/i);
});

test('Japan trip: Japan resorts plus a month-by-month historical profile', async ({ page }) => {
  await openAsk(page);
  const answer = await ask(page, 'Good resort for a Japan ski trip');
  const ids = await answer.getByTestId('ask-row').evaluateAll(els => els.map(e => e.getAttribute('data-resort') || ''));
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every(id => JAPAN.test(id))).toBeTruthy();
  await expect(answer.getByTestId('ask-climate-bars')).toHaveAttribute('data-kind', 'profile');
  await expect(answer.getByTestId('ask-climate')).toContainText(/Not a forecast/);
});

test('best in March: historical average, labeled, ranked by month average', async ({ page }) => {
  await openAsk(page);
  const answer = await ask(page, 'Best resorts to go to in March');
  await expect(answer.getByTestId('ask-climate-bars')).toHaveAttribute('data-kind', 'month');
  await expect(answer.getByTestId('ask-climate')).toContainText('Historical average, March');
  await expect(answer.getByTestId('ask-answer-text')).toContainText(/historical average|past-season average/i);
  await expect(answer.getByTestId('ask-answer-text')).toContainText(/forecast/i);
  const avg = await answer.getByTestId('ask-climate-row').evaluateAll(els => els.map(e => Number(e.getAttribute('data-avg'))));
  for (let i = 1; i < avg.length; i++) expect(avg[i - 1]).toBeGreaterThanOrEqual(avg[i]);
});

test('compare and resort answers; tapping a card opens the resort page', async ({ page }) => {
  await openAsk(page);
  const cmp = await ask(page, 'Alta vs Snowbird');
  await expect(cmp.getByTestId('ask-compare')).toContainText('Alta');
  await expect(cmp.getByTestId('ask-compare')).toContainText('Snowbird');
  const one = await ask(page, 'How is Jackson Hole looking?');
  await expect(one.getByTestId('ask-resort')).toHaveAttribute('data-resort', 'jackson-hole');
  await one.getByTestId('ask-open-resort').click();
  await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('search')).toBeHidden();
});

test('California projected snow ranks by forecast; show on board applies region and sort', async ({ page }, info) => {
  await openAsk(page);
  const answer = await ask(page, 'California resorts with the most projected snow');
  await expect(answer.getByTestId('ask-ranked')).toContainText('California, ranked by forecast 7d');
  await answer.getByTestId('ask-show-board').click();
  if (info.project.name.startsWith('desktop')) await expect(page.getByTestId('search')).toBeVisible();
  else await expect(page.getByTestId('search')).toBeHidden();
  await expect(page.getByTestId('intent-chip')).toContainText(/California/);
  await expect(page.getByTestId('board-b')).toHaveAttribute('data-sort', 'forecast7d');
});

test('screenshots: most snow, Japan trip, best in March', async ({ page }, info) => {
  test.setTimeout(120_000);
  const device = info.project.name;
  test.skip(device !== 'iphone-13' && device !== 'desktop', 'screenshots on iPhone 13 and desktop 1440 only');
  const dir = shotDir();
  const modes: Record<string, string> = {};
  for (const [slug, text] of [
    ['most-snow', 'Which resort is getting the most snow right now?'],
    ['japan-trip', 'Good resort for a Japan ski trip'],
    ['best-march', 'Best resorts to go to in March'],
  ] as const) {
    await openAsk(page);
    const answer = await ask(page, text);
    await page.waitForTimeout(500);
    modes[slug] = (await answer.getAttribute('data-mode')) || '';
    await page.screenshot({ path: `${dir}/ask-${slug}-${device}.png` });
    if (device === 'iphone-13') {
      await page.getByTestId('ask-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/ask-${slug}-${device}-end.png` });
    }
  }
  await openAsk(page);
  await page.screenshot({ path: `${dir}/ask-empty-${device}.png` });
  writeFileSync(join(dir, `ask-modes-${device}.json`), JSON.stringify(modes, null, 2));
});

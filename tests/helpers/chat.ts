import { expect, type Page } from '@playwright/test';

/**
 * Resorts page chat: docked beside the list on desktop (always visible), behind the
 * sticky "Ask SkiScope…" bar (search-trigger) on mobile.
 */
export async function openBoardChat(page: Page) {
  const bar = page.getByTestId('search-trigger');
  if (await bar.isVisible().catch(() => false)) await bar.click();
  await expect(page.getByTestId('board-chat')).toHaveAttribute('data-open', '1');
}

/** Row tap asks the chat; the trailing chevron opens the resort page. */
export async function openFirstResort(page: Page) {
  await page.getByTestId('row-open').first().click();
}

/** Counts requests that would spend agent/LLM tokens (eve agent or /api/ask). */
export function trackAgentCalls(page: Page) {
  const calls: string[] = [];
  page.on('request', req => {
    const u = req.url();
    if (req.method() === 'POST' && (/\/eve\/v1\/(?!health)/.test(u) || /\/api\/ask\b/.test(u))) calls.push(u);
  });
  return calls;
}

/** No question was sent: no user bubble in either chat implementation. */
export async function expectNoQuestionSent(page: Page, scope = page.locator('body')) {
  await expect(scope.locator('[data-testid=home-ask-user], [data-testid=ask-user]')).toHaveCount(0);
}

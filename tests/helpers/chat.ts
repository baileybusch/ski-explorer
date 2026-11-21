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

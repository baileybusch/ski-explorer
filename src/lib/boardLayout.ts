/**
 * Board layout tokens — retune here when Bailey sends a desktop sketch.
 * Do not scatter max-widths / column breaks / card heights across components.
 */
export const BOARD_LAYOUT = {
  /** Centered column. Wide enough for 4 cards, not full-bleed 1440. */
  maxWidth: 1120,
  gap: { mobile: 8, desktop: 10 },
  padX: { mobile: 8, desktop: 16 },
  /** Featured is a full-width first row, one track tall (not 2× viewport). */
  featuredRowSpan: 1,
  cardMinH: { mobile: 108, desktop: 156 },
  featuredMinH: { mobile: 118, desktop: 172 },
  cols: [
    { min: 0, cols: 2 },
    { min: 720, cols: 3 },
    { min: 980, cols: 4 },
  ],
} as const;

export const BOARD_SORTS = [
  { id: 'actual72', label: 'Actual 72h' },
  { id: 'actual24', label: 'Actual 24h' },
  { id: 'forecast7d', label: 'Forecast 7d' },
  { id: 'name', label: 'Name' },
] as const;

export type BoardSortId = (typeof BOARD_SORTS)[number]['id'];

export const BOARD_SORT_HINT: Record<BoardSortId, string> = {
  actual72: 'Ranked by last 72h',
  actual24: 'Ranked by last 24h',
  forecast7d: 'Ranked by next 7 days',
  name: 'A–Z',
};

export function isBoardSort(v: string | null | undefined): v is BoardSortId {
  return BOARD_SORTS.some(s => s.id === v);
}

export function layoutGap(width: number) {
  return width >= 720 ? BOARD_LAYOUT.gap.desktop : BOARD_LAYOUT.gap.mobile;
}

export function layoutPadX(width: number) {
  return width >= 720 ? BOARD_LAYOUT.padX.desktop : BOARD_LAYOUT.padX.mobile;
}

export function layoutCardH(width: number, featured: boolean) {
  const set = featured ? BOARD_LAYOUT.featuredMinH : BOARD_LAYOUT.cardMinH;
  return width >= 720 ? set.desktop : set.mobile;
}

export function gridCols(width: number) {
  let cols = 2;
  for (const step of BOARD_LAYOUT.cols) {
    if (width >= step.min) cols = step.cols;
  }
  return cols;
}

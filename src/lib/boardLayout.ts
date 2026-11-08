/**
 * Board layout tokens — retune here when Bailey sends a desktop sketch.
 * Do not scatter max-widths / column breaks / card heights across components.
 *
 * Below `tableMin` the board is compact cards (phone). At or above it the
 * board is a leaderboard table whose columns line up with the featured row,
 * so the eye can run straight down Last 72h or Next 7 days.
 */
export const BOARD_LAYOUT = {
  maxWidth: 1200,
  gap: { mobile: 8, desktop: 10 },
  padX: { mobile: 8, desktop: 24 },
  featuredRowSpan: 1,
  cardMinH: { mobile: 116, desktop: 132 },
  featuredMinH: { mobile: 128, desktop: 140 },
  cols: [
    { min: 0, cols: 2 },
    { min: 600, cols: 3 },
  ],
  tableMin: 840,
  table: {
    /** rank · resort · region · 24h · 72h · next 7 days */
    columns: '2.75rem minmax(0,2.2fr) minmax(0,1fr) 4.5rem minmax(0,1.6fr) minmax(0,1.6fr)',
    rowH: 52,
    featuredH: 148,
  },
  /** Stake bars never scale below this many inches, so a 0.3″ day stays short. */
  stakeFloorCm: 15.24,
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

export function boardMode(width: number): 'cards' | 'table' {
  return width >= BOARD_LAYOUT.tableMin ? 'table' : 'cards';
}

export function layoutGap(width: number) {
  return width >= BOARD_LAYOUT.tableMin ? BOARD_LAYOUT.gap.desktop : BOARD_LAYOUT.gap.mobile;
}

export function layoutPadX(width: number) {
  return width >= BOARD_LAYOUT.tableMin ? BOARD_LAYOUT.padX.desktop : BOARD_LAYOUT.padX.mobile;
}

export function layoutCardH(width: number, featured: boolean) {
  const set = featured ? BOARD_LAYOUT.featuredMinH : BOARD_LAYOUT.cardMinH;
  return width >= 600 ? set.desktop : set.mobile;
}

export function gridCols(width: number) {
  let cols = 2;
  for (const step of BOARD_LAYOUT.cols) {
    if (width >= step.min) cols = step.cols;
  }
  return cols;
}

export function stakeMax(values: number[]) {
  return Math.max(BOARD_LAYOUT.stakeFloorCm, ...values);
}

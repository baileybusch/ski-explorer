/**
 * Board layout tokens — retune here when Bailey sends a sketch.
 * Do not scatter max-widths / column templates / row heights across components.
 *
 * One leaderboard list at every width: rank · resort (name over region) · stat
 * columns. Stat columns are fixed-width and right-aligned, so numbers line up down
 * the list and never move when the sort changes; only the highlight moves.
 *
 *   compact (< fullMin)  Last 72h · Next 7d     Last 72h shows 24h when ranked by 24h
 *   full    (≥ fullMin)  Last 24h · Last 72h · Next 7 days
 */
export const BOARD_LAYOUT = {
  maxWidth: 1200,
  padX: { mobile: 8, desktop: 24 },
  fullMin: 720,
  list: {
    compact: {
      columns: '1.5rem minmax(0,1fr) 4.5rem 4.5rem',
      rowH: 52,
      leadH: 52,
    },
    full: {
      columns: '2.25rem minmax(0,1fr) 5.5rem 9.5rem 9.5rem',
      rowH: 56,
      leadH: 56,
    },
  },
  /** Stake bars never scale below this many inches, so a 0.3″ day stays short. */
  stakeFloorCm: 15.24,
} as const;

export const BOARD_SORTS = [
  { id: 'actual72', label: 'Last 72h' },
  { id: 'actual24', label: 'Last 24h' },
  { id: 'forecast7d', label: 'Next 7 days' },
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

export type BoardDensity = 'compact' | 'full';

export function boardDensity(width: number): BoardDensity {
  return width >= BOARD_LAYOUT.fullMin ? 'full' : 'compact';
}

export function layoutPadX(width: number) {
  return width >= BOARD_LAYOUT.fullMin ? BOARD_LAYOUT.padX.desktop : BOARD_LAYOUT.padX.mobile;
}

export function stakeMax(values: number[]) {
  return Math.max(BOARD_LAYOUT.stakeFloorCm, ...values);
}

/** Shared board ranking, tone, and gap-free pack layout. */
export { compareDump, compareBoard, dumpParts, dumpScoreIn, relativeUpdated, boardIsMonotonic } from '../../lib/dumpScore.js';
export { rankBoard, regionResortIds } from '../../lib/boardRank.js';
export { gridCols, BOARD_LAYOUT, layoutGap, layoutCardH, layoutPadX } from './boardLayout';
export type { BoardSortId } from './boardLayout';

export const BOARD_PAGE = 16;
export const BOARD_MORE = 12;

export function snowScore(row: { m: any }) {
  return row.m.windowCm || 0;
}

export function incomingScore(row: { m?: any; storm?: any }) {
  return row.m?.outlookCm || row.m?.windowCm || row.storm?.totalCm || 0;
}

export function cardTone(rank: number, score: number, max: number) {
  const t = max > 0 ? Math.min(1, score / max) : 0;
  const hero = rank === 1 && t > 0.08;
  const l = hero ? 0.93 : 0.145 + t * 0.32;
  return { t, hero, l, ink: l > 0.52 };
}

export function sparkPath(values: number[], w = 72, h = 22) {
  const max = Math.max(0.2, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${h - (v / max) * h}`).join(' ');
}

export type PackedCell = {
  i: number;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

/**
 * Pack n blocks into `cols` so the last row is never half-empty.
 * Featured (#1) is always full-width, one row; cards below fill left-to-right.
 * Column counts and heights live in boardLayout.ts so a later desktop sketch
 * can retune them in one place.
 */
export function packCells(n: number, cols: number): { cells: PackedCell[]; rows: number } {
  const cells: PackedCell[] = [];
  if (n <= 0 || cols < 1) return { cells, rows: 0 };

  if (n === 1) {
    return { cells: [{ i: 0, col: 0, row: 0, colSpan: cols, rowSpan: 1 }], rows: 1 };
  }

  if (n === 2) {
    return {
      cells: [
        { i: 0, col: 0, row: 0, colSpan: cols, rowSpan: 1 },
        { i: 1, col: 0, row: 1, colSpan: cols, rowSpan: 1 },
      ],
      rows: 2,
    };
  }

  let i = 0;
  let row = 0;
  cells.push({ i: 0, col: 0, row: 0, colSpan: cols, rowSpan: 1 });
  i = 1;
  row = 1;

  while (i < n) {
    const left = n - i;
    const take = Math.min(cols, left);
    if (take < cols) {
      const base = Math.floor(cols / take);
      let extra = cols - base * take;
      let col = 0;
      for (let k = 0; k < take; k++) {
        const span = base + (extra > 0 ? 1 : 0);
        if (extra > 0) extra -= 1;
        cells.push({ i, col, row, colSpan: span, rowSpan: 1 });
        col += span;
        i += 1;
      }
    } else {
      for (let c = 0; c < take; c++) {
        cells.push({ i, col: c, row, colSpan: 1, rowSpan: 1 });
        i += 1;
      }
    }
    row += 1;
  }

  return { cells, rows: row };
}

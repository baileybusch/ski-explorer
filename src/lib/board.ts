/** Shared board ranking, tone, and gap-free pack layout. */

export const BOARD_PAGE = 11;
export const BOARD_MORE = 10;

export function snowScore(row: { m: any }) {
  return row.m.windowCm || 0;
}

export function incomingScore(row: { storm?: any }) {
  return row.storm?.totalCm || 0;
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

export function gridCols(width: number) {
  if (width >= 1100) return 4;
  if (width >= 720) return 3;
  return 2;
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
 * n=1 full cell; n=2 stacked full-width; n=4 + 2-col = equal 2×2;
 * otherwise the leader is 2×2 and leftovers stretch to finish the row.
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

  const featured = !(n === 4 && cols === 2);
  let i = 0;
  let row = 0;

  if (featured) {
    const leadCols = Math.min(2, cols);
    const leadRows = 2;
    cells.push({ i: 0, col: 0, row: 0, colSpan: leadCols, rowSpan: leadRows });
    i = 1;
    const sideCols = cols - leadCols;
    if (sideCols > 0) {
      for (let r = 0; r < leadRows && i < n; r++) {
        for (let c = 0; c < sideCols && i < n; c++) {
          cells.push({ i, col: leadCols + c, row: r, colSpan: 1, rowSpan: 1 });
          i += 1;
        }
      }
    }
    row = leadRows;
  }

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

export function rowHeight(rows: number, availH: number, gap: number) {
  if (rows <= 0) return Math.max(availH, 80);
  return Math.max(72, (availH - gap * (rows - 1)) / rows);
}

export function targetRows(availH: number, gap: number, minRow: number) {
  return Math.max(2, Math.floor((availH + gap) / (minRow + gap)));
}

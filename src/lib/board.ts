/** Shared board ranking and layout helpers. */
export { compareDump, compareBoard, dumpParts, dumpScoreIn, relativeUpdated, boardIsMonotonic } from '../../lib/dumpScore.js';
export { rankBoard, regionResortIds } from '../../lib/boardRank.js';
export { BOARD_LAYOUT, boardDensity, layoutPadX } from './boardLayout';
export type { BoardSortId, BoardDensity } from './boardLayout';

export const BOARD_PAGE = 16;
export const BOARD_MORE = 12;

export function snowScore(row: { m: any }) {
  return row.m.windowCm || 0;
}

export function incomingScore(row: { m?: any; storm?: any }) {
  return row.m?.outlookCm || row.m?.windowCm || row.storm?.totalCm || 0;
}

export function sparkPath(values: number[], w = 72, h = 22) {
  const max = Math.max(0.2, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${h - (v / max) * h}`).join(' ');
}

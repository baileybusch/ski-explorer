/**
 * Home-board dump score.
 *
 * scoreIn = past72hIn + next7dIn
 *
 * past72h — snowfall on today and the two previous snapshot days (inclusive 3 days).
 * next7d  — snowfall on the next forecast days after today, up to 7.
 *
 * Ranking uses inches (cm / 2.54). Deterministic ties:
 *   1. higher next-7d inches
 *   2. higher past-72h inches
 *   3. resort name A–Z
 *
 * Both legs are modeled Open-Meteo snapshot totals, not resort-reported.
 */
import { IN } from './util.js';

export function dumpParts(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  let past72Cm = 0;
  for (let i = Math.max(0, today - 2); i <= today; i++) past72Cm += sf[i] || 0;
  let last7Cm = 0;
  for (let i = Math.max(0, today - 6); i <= today; i++) last7Cm += sf[i] || 0;
  let next7Cm = 0;
  const end = Math.min(sf.length - 1, today + 7);
  for (let i = today + 1; i <= end; i++) next7Cm += sf[i] || 0;
  const dumpCm = past72Cm + next7Cm;
  return {
    past72Cm,
    last7Cm,
    next7Cm,
    dumpCm,
    past72In: IN(past72Cm),
    last7In: IN(last7Cm),
    next7In: IN(next7Cm),
    dumpIn: IN(dumpCm),
  };
}

export function dumpScoreIn(r, snow) {
  return dumpParts(r, snow).dumpIn;
}

/** Sort comparator: higher dump first, then the documented tie-breaks. */
export function compareDump(a, b, snow) {
  const A = dumpParts(a.r || a, snow);
  const B = dumpParts(b.r || b, snow);
  const nameA = String((a.r || a).name || '');
  const nameB = String((b.r || b).name || '');
  return (B.dumpIn - A.dumpIn)
    || (B.next7In - A.next7In)
    || (B.past72In - A.past72In)
    || nameA.localeCompare(nameB);
}

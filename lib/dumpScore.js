/**
 * Home-board ranking: last 72h proxy, forecast as a tie-break only.
 *
 * past72h — US SNOTEL SNWD peak-rise (snow DEPTH change, not recorded snowfall)
 *           or WTEQ×12 when depth did not rise; otherwise Open-Meteo
 *           snowfall_sum labeled model-est.
 * next7d  — Open-Meteo (or MET Norway) forecast. Chip only. Never the rank.
 *
 * Ranking impact: a bigger pillow-depth rise ranks above true snowfall that
 * compacted in place, and a model-est row can outrank a SNOTEL zero. The
 * board does not rank resort-reported storm totals.
 *
 * Deterministic ties:
 *   1. higher past-72h inches (depth-rise / SWE proxy / est.)
 *   2. higher next-7d forecast inches
 *   3. resort name A–Z
 *
 * The UI never shows dumpCm as fallen snow — cards show past72 and next7
 * as equal two-stat columns. Default rank is last 72h; the board sort
 * control can switch to 24h, forecast, or name.
 */
import { IN } from './util.js';
import { metricOf, valueState } from './data/observation.js';

export function isEstimatedSource(source) {
  return !source || source === 'model-est' || String(source).startsWith('model-est');
}

function modelPast(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  let past72Cm = 0;
  for (let i = Math.max(0, today - 2); i <= today; i++) past72Cm += sf[i] || 0;
  let last7Cm = 0;
  for (let i = Math.max(0, today - 6); i <= today; i++) last7Cm += sf[i] || 0;
  const past24Cm = sf[today] || 0;
  return { past72Cm, last7Cm, past24Cm };
}

function modelNext7(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  let next7Cm = 0;
  const end = Math.min(sf.length - 1, today + 7);
  for (let i = today + 1; i <= end; i++) next7Cm += sf[i] || 0;
  return next7Cm;
}

function observedRec(r, snow) {
  return snow?.observed?.[r.id] || r.observed || null;
}

export function dumpParts(r, snow) {
  const model = modelPast(r, snow);
  const next7Cm = modelNext7(r, snow);
  const obs = observedRec(r, snow);
  let past72Cm = model.past72Cm;
  let past24Cm = model.past24Cm;
  let last7Cm = model.last7Cm;
  let source = 'model-est';
  let estimated = true;
  let method = 'open-meteo-snowfall_sum';
  let observedAt = snow?.observedFetched || snow?.generated || snow?.fetched || null;

  if (obs && Number.isFinite(obs.snow72hCm)) {
    past72Cm = obs.snow72hCm;
    past24Cm = Number.isFinite(obs.snow24hCm) ? obs.snow24hCm : past24Cm;
    source = obs.source || 'model-est';
    method = obs.method || (isEstimatedSource(source) ? 'open-meteo-snowfall_sum' : 'snwd-peak');
    estimated = isEstimatedSource(source);
    observedAt = obs.observedAt || observedAt;
    if (!estimated) last7Cm = Math.max(last7Cm, past72Cm);
  }

  const dumpCm = past72Cm + next7Cm;
  return {
    past72Cm,
    past24Cm,
    last7Cm,
    next7Cm,
    dumpCm,
    past72In: IN(past72Cm),
    past24In: IN(past24Cm),
    last7In: IN(last7Cm),
    next7In: IN(next7Cm),
    dumpIn: IN(dumpCm),
    source,
    estimated,
    method,
    observedAt,
    metric: metricOf(method, source),
    valueState: valueState(past72Cm),
    isRecordedSnowfall: false,
    forecast7dCm: next7Cm,
    forecast7dIn: IN(next7Cm),
  };
}

/** Rank score = last 72h observed (or est.). Forecast is not in the score. */
export function dumpScoreIn(r, snow) {
  return dumpParts(r, snow).past72In;
}

/** Sort comparator: higher 72h observed first, then forecast, then name. */
export function compareDump(a, b, snow) {
  return compareBoard(a, b, snow, 'actual72');
}

export function compareBoard(a, b, snow, sort = 'actual72') {
  const A = dumpParts(a.r || a, snow);
  const B = dumpParts(b.r || b, snow);
  const nameA = String((a.r || a).name || '');
  const nameB = String((b.r || b).name || '');
  if (sort === 'actual24') {
    return (B.past24In - A.past24In)
      || (B.past72In - A.past72In)
      || (B.next7In - A.next7In)
      || nameA.localeCompare(nameB);
  }
  if (sort === 'forecast7d') {
    return (B.next7In - A.next7In)
      || (B.past72In - A.past72In)
      || nameA.localeCompare(nameB);
  }
  if (sort === 'name') {
    return nameA.localeCompare(nameB) || (B.past72In - A.past72In);
  }
  return (B.past72In - A.past72In)
    || (B.next7In - A.next7In)
    || nameA.localeCompare(nameB);
}

export function boardIsMonotonic(rows, snow, sort = 'actual72') {
  for (let i = 1; i < rows.length; i++) {
    if (compareBoard(rows[i - 1], rows[i], snow, sort) > 0) return false;
  }
  return true;
}

export function relativeUpdated(iso, now = Date.now()) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return 'Updated just now';
  if (min < 60) return `Updated ${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `Updated ${h}h ago`;
  const d = Math.round(h / 24);
  return `Updated ${d}d ago`;
}

/**
 * The home board's scope + order, shared by the board (App), Ask SkiScope tools on the
 * server, and the in-browser Ask fallback so all three rank the same snapshot the same way.
 *
 *   scope  pass (ikon | epic | all) → region ids → observed-only (drops est. rows)
 *   order  compareBoard(sort): actual72 | actual24 | forecast7d | name
 */
import { compareBoard, dumpParts } from './dumpScore.js';
import { regionMatchesResort } from './search.js';

export function passAllows(pass, r) {
  return !pass || pass === 'all' || pass === 'both' || (r.passes || []).includes(pass);
}

export function regionResortIds(resorts, region, pass = 'all') {
  if (!region) return null;
  return resorts.filter(r => passAllows(pass, r) && regionMatchesResort(region, r)).map(r => r.id);
}

/** Resorts in board order for one scope. `ids` (region membership) is optional. */
export function rankBoard(resorts, snow, { pass = 'all', ids = null, observedOnly = false, sort = 'actual72' } = {}) {
  const allow = ids ? new Set(ids) : null;
  return resorts
    .filter(r => passAllows(pass, r)
      && (!allow || allow.has(r.id))
      && (!observedOnly || !dumpParts(r, snow).estimated))
    .sort((a, b) => compareBoard(a, b, snow, sort));
}

/**
 * The observed half of the board's snapshot, compact enough to send with an Ask request
 * (~160 rows). Forecast comes from snow.json, which ships with the same deployment.
 */
export function observedSnapshot(snow) {
  const observed = {};
  for (const [id, o] of Object.entries(snow?.observed || {})) {
    if (!o || !Number.isFinite(o.snow72hCm)) continue;
    observed[id] = { snow72hCm: o.snow72hCm, snow24hCm: o.snow24hCm ?? null, source: o.source || 'model-est' };
  }
  return {
    fetched: snow?.observedFetched || null,
    source: snow?.observedSource || null,
    asOf: snow?.dates?.[snow?.today] || null,
    observed,
  };
}

const num = v => (Number.isFinite(v) && v >= 0 && v < 2000 ? v : null);

/** Validate a client-sent observed snapshot against known resort ids. Returns null if unusable. */
export function cleanObservedSnapshot(raw, resorts) {
  if (!raw || typeof raw !== 'object' || !raw.observed || typeof raw.observed !== 'object') return null;
  const known = new Set((resorts || []).map(r => r.id));
  const observed = {};
  let n = 0;
  for (const [id, o] of Object.entries(raw.observed)) {
    if (!known.has(id) || !o || typeof o !== 'object') continue;
    const s72 = num(o.snow72hCm);
    if (s72 == null) continue;
    observed[id] = { snow72hCm: s72, snow24hCm: num(o.snow24hCm), source: String(o.source || 'model-est').slice(0, 48) };
    if (++n > 2000) break;
  }
  if (!n) return null;
  const str = v => (typeof v === 'string' ? v.slice(0, 48) : null);
  return { fetched: str(raw.fetched), source: str(raw.source), asOf: str(raw.asOf), observed };
}

/** A catalog whose snow reads `snap` as its observed layer (snow.json forecast unchanged). */
export function withObservedSnapshot(cat, snap) {
  if (!snap) return cat;
  return {
    ...cat,
    snow: { ...cat.snow, observed: snap.observed, observedFetched: snap.fetched, observedSource: snap.source },
    fetched: snap.fetched || cat.fetched,
  };
}

/** Board scope the Ask tools default to when a question doesn't name its own. */
export function cleanBoardScope(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  return {
    pass: ['ikon', 'epic', 'all'].includes(b.pass) ? b.pass : 'all',
    regionId: typeof b.regionId === 'string' && b.regionId ? b.regionId.slice(0, 48) : null,
    observedOnly: b.observedOnly === true,
    sort: ['actual72', 'actual24', 'forecast7d', 'name'].includes(b.sort) ? b.sort : 'actual72',
  };
}

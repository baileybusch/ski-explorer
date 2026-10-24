/**
 * Forecast-derived "storm incoming" from the Open-Meteo snapshot already
 * in snow.json. No extra API. International resorts use this only.
 *
 * Tiers are inches in any rolling 72h (3 forecast days): 6 / 12 / 18.
 * Dates after the snapshot horizon are not invented.
 */
import { IN } from './util.js';
import { resortsForRegion } from './search.js';

export const STORM_TIERS_IN = [6, 12, 18];

/** Best 72h snowfall (cm) inside the forecast slice, plus a timeline. */
export function stormForResort(r, snow, { days = 7 } = {}) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  const dates = snow?.dates || [];
  const end = Math.min(sf.length, today + 1 + days);
  const slice = [];
  for (let i = today; i < end; i++) {
    slice.push({ i, date: dates[i], cm: sf[i] || 0 });
  }
  if (!slice.length) {
    return { id: r.id, name: r.name, max72Cm: 0, totalCm: 0, tier: 0, start: null, peak: null, source: 'forecast' };
  }

  let max72 = 0, max72At = 0;
  for (let i = 0; i < slice.length; i++) {
    const win = slice.slice(i, i + 3).reduce((a, d) => a + d.cm, 0);
    if (win > max72) { max72 = win; max72At = i; }
  }
  const totalCm = slice.reduce((a, d) => a + d.cm, 0);
  const peak = slice.reduce((a, d) => d.cm > a.cm ? d : a, slice[0]);
  const start = slice.find(d => d.cm >= 1) || null;
  const inches = IN(max72);
  const tier = inches >= 18 ? 18 : inches >= 12 ? 12 : inches >= 6 ? 6 : 0;

  return {
    id: r.id,
    name: r.name,
    region: r.region,
    country: r.country,
    max72Cm: max72,
    totalCm,
    tier,
    start: start?.date || null,
    peak: peak.date,
    peakCm: peak.cm,
    windowStart: slice[max72At]?.date || null,
    windowEnd: slice[Math.min(max72At + 2, slice.length - 1)]?.date || null,
    days: slice,
    source: 'forecast',
    label: 'Open-Meteo forecast (not typical / not observed)',
  };
}

export function findStorms({ resorts, snow, region, regions = [], passOK, minIn = 6, days = 7 }) {
  const ok = passOK || (() => true);
  let list = (resorts || []).filter(ok);
  if (region) {
    const g = typeof region === 'string' ? regions.find(x => x.id === region) : region;
    if (g) list = resortsForRegion(g, list, ok);
  }
  const out = [];
  for (const r of list) {
    const storm = stormForResort(r, snow, { days });
    if (storm.tier >= minIn) out.push({ r, storm });
  }
  out.sort((a, b) => b.storm.max72Cm - a.storm.max72Cm);
  return out;
}

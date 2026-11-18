/**
 * Typed SkiScope tools shared by the eve agent wrappers and deterministic evals.
 * Last 72h is SNWD peak-rise or model est. — never recorded snowfall.
 */
import { executeTool, loadCatalog } from '../skiscope-tools/index.js';
import { rankResorts, getResort, compareResortsDetail } from '../skiscope-tools/askTools.js';
import { findResort } from '../skiscope-tools/core.js';
import { dumpParts } from '../dumpScore.js';
import { attribution } from '../skiscope-tools/attribution.js';

const POWDER_24_IN = 6;
const POWDER_72_IN = 10;

export function catalog() {
  return loadCatalog();
}

export function powderFlag(row) {
  const last24 = Number(row?.actual24In ?? row?.snow24h_observed ?? 0) || 0;
  const last72 = Number(row?.actual72In ?? row?.snow72h_observed ?? 0) || 0;
  const flagged = last24 >= POWDER_24_IN || last72 >= POWDER_72_IN;
  return {
    flagged,
    last24In: last24,
    last72In: last72,
    threshold24In: POWDER_24_IN,
    threshold72In: POWDER_72_IN,
    basis: 'Heuristic on last-24h / last-72h new-snow proxy (SNWD depth-rise or model est.). Not a resort powder-day declaration and not recorded snowfall.',
  };
}

function withHonesty(data, extra = {}) {
  const snow = catalog().snow;
  return {
    ...data,
    ...extra,
    honesty: {
      last72IsNotRecordedSnowfall: true,
      snwdIsDepth: true,
      estimatedMeansModel: true,
    },
    ...attribution(snow),
  };
}

export function searchResorts(args = {}) {
  return executeTool('search_resorts', args, catalog());
}

export function getTrending(args = {}) {
  const cat = catalog();
  const data = rankResorts({ sort: args.sort || 'actual72h', pass: args.pass, region: args.region, limit: args.limit || 6 }, cat);
  return { ok: true, data: withHonesty(data), text: data.rows[0] ? `${data.rows[0].name} leads ${data.sortLabel}` : 'quiet' };
}

export function getResortConditions(args = {}) {
  const cat = catalog();
  const data = getResort({ resort: args.resort }, cat);
  if (!data.found) return { ok: false, data, text: `unknown resort ${args.resort}` };
  const r = findResort(cat, data.resort.id);
  const obs = cat.snow?.observed?.[r?.id] || null;
  const parts = r ? dumpParts(r, cat.snow) : null;
  const powder = powderFlag(data.resort);
  const base = obs && Number.isFinite(obs.snwdIn)
    ? {
      snwdIn: obs.snwdIn,
      label: 'Station snow depth (pillow), not resort-reported base and not new snow',
      station: obs.station?.name || null,
    }
    : { snwdIn: null, label: 'No station depth in this snapshot', station: null };
  const out = withHonesty({
    ...data,
    powder,
    baseDepth: base,
    method: parts?.method || obs?.method || null,
    isRecordedSnowfall: false,
  });
  return { ok: true, data: out, text: data.resort.name };
}

export function getSnowForecast(args = {}) {
  return executeTool('get_resort_forecast', { resort: args.resort, days: args.days || 7, units: args.units }, catalog());
}

export function compareResorts(args = {}) {
  const cat = catalog();
  const data = compareResortsDetail({ ids: args.ids || [] }, cat);
  return { ok: true, data: withHonesty(data), text: data.rows.map(r => r.name).join(' vs ') };
}

/**
 * Labeled web lookup for mountains not in the SkiScope catalog.
 * Open-Meteo geocoding + snowfall_sum forecast. Never treated as a station observation.
 */
export async function lookupUnknownResort(args = {}, fetchImpl = fetch) {
  const q = String(args.query || args.name || '').trim();
  if (!q) return { ok: false, data: null, text: 'missing query' };
  const cat = catalog();
  const known = findResort(cat, q);
  if (known) {
    const local = getResortConditions({ resort: known.id });
    return { ...local, data: { ...local.data, lookup: 'catalog' } };
  }
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const geo = await fetchImpl(geoUrl).then(r => r.json()).catch(() => null);
  const hit = geo?.results?.[0];
  if (!hit) {
    return {
      ok: false,
      data: {
        kind: 'web-lookup',
        found: false,
        query: q,
        source: 'web-lookup (Open-Meteo geocoding)',
        labeled: true,
      },
      text: `No mountain matched “${q}” in SkiScope or Open-Meteo geocoding.`,
    };
  }
  const fcUrl = `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&daily=snowfall_sum&forecast_days=7&timezone=auto`;
  const fc = await fetchImpl(fcUrl).then(r => r.json()).catch(() => null);
  const days = (fc?.daily?.time || []).map((date, i) => ({
    date,
    snowCm: fc.daily.snowfall_sum?.[i] ?? 0,
  }));
  const next7Cm = days.reduce((a, d) => a + (d.snowCm || 0), 0);
  const data = {
    kind: 'web-lookup',
    found: true,
    query: q,
    name: hit.name,
    where: [hit.admin1, hit.country].filter(Boolean).join(', '),
    lat: hit.latitude,
    lon: hit.longitude,
    elevationM: hit.elevation ?? null,
    next7Cm,
    forecastDays: days,
    estimated: true,
    source: 'web-lookup (Open-Meteo geocoding + snowfall_sum forecast). Not in the SkiScope catalog. Not a station observation.',
    labeled: true,
    isRecordedSnowfall: false,
  };
  return { ok: true, data, text: `${hit.name}: model-est. next 7d (web lookup, not in catalog)` };
}

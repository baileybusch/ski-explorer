/**
 * Typed SkiScope tools shared by the eve agent wrappers and deterministic evals.
 * Last 72h is SNWD peak-rise or model est. — never recorded snowfall.
 */
import { executeTool, loadCatalog } from '../skiscope-tools/index.js';
import { rankResorts, getResort, compareResortsDetail } from '../skiscope-tools/askTools.js';
import { findResort } from '../skiscope-tools/core.js';
import { dumpParts } from '../dumpScore.js';
import { attribution } from '../skiscope-tools/attribution.js';
import { fetchMeteoExtras } from './meteoExtras.js';
import { powderDayCall } from './powderDayCall.js';
import { snowClimateFor } from './climateRegions.js';

export { powderDayCall } from './powderDayCall.js';
export { parseMeteoExtras, fetchMeteoExtras } from './meteoExtras.js';
export { assertClimateRegions, CLIMATE_REGION_SLUGS, snowClimateFor } from './climateRegions.js';

const POWDER_24_IN = 6;
const POWDER_72_IN = 10;

function r1(n) {
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;
}

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

function waterFromObs(obs) {
  if (!obs || (!Number.isFinite(obs.sweIn) && !Number.isFinite(obs.snwdIn))) {
    return {
      sweIn: null,
      snwdIn: null,
      packDensity: null,
      packRatio: null,
      label: 'No station SWE in this snapshot. Storm snow-to-liquid comes from the forecast extras (est.).',
      estimated: true,
    };
  }
  const sweIn = Number.isFinite(obs.sweIn) ? r1(obs.sweIn) : null;
  const snwdIn = Number.isFinite(obs.snwdIn) ? r1(obs.snwdIn) : null;
  const packDensity = sweIn != null && snwdIn && snwdIn > 0.1 ? r1(sweIn / snwdIn) : null;
  const packRatio = sweIn != null && sweIn > 0.05 && snwdIn != null ? r1(snwdIn / sweIn) : null;
  return {
    sweIn,
    snwdIn,
    packDensity,
    packRatio,
    label: 'Station pillow SWE (liquid equivalent of the pack) and SNWD. Pack ratio is depth÷SWE, not this storm\'s snow-to-liquid. Storm SLR is on extras.slr (Open-Meteo est.).',
    estimated: !obs.source || String(obs.source).startsWith('model'),
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

function climateBlock(r, { includeGuide = false } = {}) {
  const snowClimate = snowClimateFor(r, { includeGuide });
  if (!snowClimate) return { region: null, snowClimate: null };
  return {
    region: snowClimate.region,
    snowClimate,
  };
}

function callFrom(conditions, extras) {
  const last24In = conditions?.powder?.last24In ?? 0;
  const last72In = conditions?.powder?.last72In ?? 0;
  const stormSlr = extras?.next3?.[0]?.slr ?? extras?.next7Slr ?? null;
  return powderDayCall({
    last24In,
    last72In,
    slr: stormSlr,
    windSustainedMph: extras?.wind?.speedMph ?? null,
    windGustMph: extras?.wind?.gustMph ?? null,
    snowLevelFt: extras?.snowLevel?.meanFt ?? null,
    baseFt: extras?.snowLevel?.baseFt ?? null,
  });
}

export function searchResorts(args = {}) {
  return executeTool('search_resorts', args, catalog());
}

export function getTrending(args = {}) {
  const cat = catalog();
  const data = rankResorts({ sort: args.sort || 'actual72h', pass: args.pass, region: args.region, limit: args.limit || 6 }, cat);
  return { ok: true, data: withHonesty(data), text: data.rows[0] ? `${data.rows[0].name} leads ${data.sortLabel}` : 'quiet' };
}

/** Sync snapshot conditions. No live Open-Meteo call — safe for evals. */
export function getResortConditions(args = {}) {
  const cat = catalog();
  const data = getResort({ resort: args.resort }, cat);
  if (!data.found) return { ok: false, data, text: `unknown resort ${args.resort}` };
  const r = findResort(cat, data.resort.id);
  const obs = cat.snow?.observed?.[r?.id] || null;
  const parts = r ? dumpParts(r, cat.snow) : null;
  const powder = powderFlag(data.resort);
  const water = waterFromObs(obs);
  const powderCall = powderDayCall({
    last24In: powder.last24In,
    last72In: powder.last72In,
  });
  const base = obs && Number.isFinite(obs.snwdIn)
    ? {
      snwdIn: obs.snwdIn,
      label: 'Station snow depth (pillow), not resort-reported base and not new snow',
      station: obs.station?.name || null,
    }
    : { snwdIn: null, label: 'No station depth in this snapshot', station: null };
  const climate = climateBlock(r, { includeGuide: true });
  const out = withHonesty({
    ...data,
    region: climate.region,
    snowClimate: climate.snowClimate,
    powder,
    powderCall,
    water,
    wind: null,
    snowLevel: r ? { baseFt: r.base != null ? Math.round(r.base * 3.28084) : null, summitFt: r.summit != null ? Math.round(r.summit * 3.28084) : null, meanFt: null, estimated: true, label: 'Live snow level is on getSnowForecast extras (Open-Meteo freezing_level_height, est.).' } : null,
    spread: null,
    extras: null,
    baseDepth: base,
    method: parts?.method || obs?.method || null,
    isRecordedSnowfall: false,
    resort: data.resort ? { ...data.resort, climateRegion: climate.region } : data.resort,
  });
  return { ok: true, data: out, text: data.resort.name };
}

async function attachLiveExtras(base, resort, fetchImpl) {
  if (!base.ok || !resort || !fetchImpl) return base;
  let extras = null;
  try {
    extras = await fetchMeteoExtras(resort, fetchImpl);
  } catch {
    extras = null;
  }
  const powderCall = callFrom(base.data, extras);
  const water = {
    ...(base.data.water || {}),
    stormSlr: extras?.next7Slr ?? extras?.next3?.[0]?.slr ?? null,
    stormWaterIn: extras?.next7WaterIn ?? null,
    feel: extras?.feel ?? extras?.next3?.[0]?.feel ?? null,
  };
  return {
    ...base,
    data: {
      ...base.data,
      extras,
      powderCall,
      water,
      wind: extras?.wind || null,
      snowLevel: extras?.snowLevel || base.data.snowLevel,
      spread: extras?.spread || null,
    },
  };
}

/** Live conditions: snapshot + Open-Meteo extras (SWE/SLR, wind, snow level, model spread). */
export async function getResortConditionsLive(args = {}, fetchImpl = fetch) {
  const base = getResortConditions(args);
  if (!base.ok) return base;
  const r = findResort(catalog(), base.data.resort.id);
  return attachLiveExtras(base, r, fetchImpl);
}

export async function getSnowForecast(args = {}, fetchImpl = fetch) {
  const cat = catalog();
  const snap = executeTool('get_resort_forecast', { resort: args.resort, days: args.days || 7, units: args.units }, cat);
  if (!snap.ok) return snap;
  const r = findResort(cat, snap.data.id || args.resort);
  const cond = r ? getResortConditions({ resort: r.id }) : null;
  let extras = null;
  try {
    extras = r ? await fetchMeteoExtras(r, fetchImpl) : null;
  } catch {
    extras = null;
  }
  const powderCall = callFrom(cond?.data, extras);
  const climate = climateBlock(r, { includeGuide: true });
  return {
    ok: true,
    data: withHonesty({
      kind: 'forecast',
      ...snap.data,
      region: climate.region,
      snowClimate: climate.snowClimate,
      extras,
      powderCall,
      water: {
        stormSlr: extras?.next7Slr ?? null,
        stormWaterIn: extras?.next7WaterIn ?? null,
        feel: extras?.feel ?? null,
        label: 'Storm liquid equivalent and snow-to-liquid from Open-Meteo precipitation_sum vs snowfall_sum. est.',
      },
      wind: extras?.wind || null,
      snowLevel: extras?.snowLevel || null,
      spread: extras?.spread || null,
      estimated: true,
      isRecordedSnowfall: false,
    }),
    text: snap.text,
  };
}

export function compareResorts(args = {}) {
  const cat = catalog();
  const data = compareResortsDetail({ ids: args.ids || [] }, cat);
  const rows = (data.rows || []).map((row) => {
    const r = findResort(cat, row.id);
    const obs = cat.snow?.observed?.[r?.id] || null;
    const climate = climateBlock(r, { includeGuide: false });
    return {
      ...row,
      climateRegion: climate.region,
      region: climate.region,
      snowClimate: climate.snowClimate,
      water: waterFromObs(obs),
      powderCall: powderDayCall({ last24In: row.actual24In, last72In: row.actual72In }),
    };
  });
  return { ok: true, data: withHonesty({ ...data, rows }), text: rows.map(r => r.name).join(' vs ') };
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
    const local = await getResortConditionsLive({ resort: known.id }, fetchImpl);
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
  let extras = null;
  try {
    extras = await fetchMeteoExtras({
      center: [hit.longitude, hit.latitude],
      base: hit.elevation ?? null,
      summit: hit.elevation ?? null,
    }, fetchImpl);
  } catch {
    extras = null;
  }
  const next7Cm = extras?.next7SnowCm ?? null;
  const days = extras?.days?.map(d => ({ date: d.date, snowCm: d.snowCm, precipMm: d.precipMm, slr: d.slr, windMph: d.windMph, gustMph: d.gustMph }))
    || [];
  const data = {
    kind: 'web-lookup',
    found: true,
    query: q,
    name: hit.name,
    where: [hit.admin1, hit.country].filter(Boolean).join(', '),
    lat: hit.latitude,
    lon: hit.longitude,
    elevationM: hit.elevation ?? null,
    next7Cm: next7Cm ?? 0,
    forecastDays: days,
    extras,
    water: {
      stormSlr: extras?.next7Slr ?? null,
      stormWaterIn: extras?.next7WaterIn ?? null,
      feel: extras?.feel ?? null,
      label: 'web-lookup Open-Meteo liquid equivalent vs snowfall_sum. est. Not a station observation.',
    },
    wind: extras?.wind || null,
    snowLevel: extras?.snowLevel || null,
    spread: extras?.spread || null,
    estimated: true,
    source: 'web-lookup (Open-Meteo geocoding + multi-model snowfall_sum / precip / wind / freezing level). Not in the SkiScope catalog. Not a station observation.',
    labeled: true,
    isRecordedSnowfall: false,
    ...climateBlock({
      country: hit.country_code || hit.country || '',
      region: hit.admin1,
      subregion: hit.admin1,
      state: hit.admin1,
      name: hit.name,
      id: 'web-lookup',
    }, { includeGuide: true }),
  };
  return { ok: true, data, text: `${hit.name}: model-est. next 7d (web lookup, not in catalog)` };
}

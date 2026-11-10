/**
 * NRCS SNOTEL / AWDB snow-depth / SWE.
 *
 * Public domain US Government data, no API key.
 * SNWD is snow DEPTH on the pillow, not recorded snowfall. Peak-rise is a
 * depth-change proxy (compaction, wind, and melt also move SNWD). WTEQ is
 * snow-water equivalent. If SNWD did not rise but WTEQ did, we convert at
 * 12:1 (`swe-slr`) — still not a snowfall gauge. Cite:
 * https://www.nrcs.usda.gov/programs-initiatives/sswsf-snow-survey-and-water-supply-forecasting-program/citing-data-from-the
 */
import { metricOf, valueState } from './data/observation.js';

const AWDB = 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1';
const UA = { 'User-Agent': 'SkiScope/1.0 (github.com/baileybusch/ski-explorer)' };

export const MAX_KM = 45;
export const NOISE_IN = 1;
export const SWE_CONFIRM_IN = 0.08;
export const SLR = 12;
export const CAP_IN = 80;

export function haversineKm(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function midElevM(r) {
  if (r.summit && r.base) return r.base + 0.6 * (r.summit - r.base);
  return r.summit || r.base || null;
}

export function parseAwdbTime(s) {
  if (!s) return null;
  const iso = String(s).trim().replace(' ', 'T');
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function seriesOf(station, element) {
  const out = [];
  for (const el of station?.data || []) {
    if (el?.stationElement?.elementCode !== element) continue;
    for (const v of el.values || []) {
      if (v?.value == null || !Number.isFinite(v.value)) continue;
      const t = parseAwdbTime(v.date);
      if (t == null) continue;
      out.push({ t, v: v.value, date: v.date });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function valueAtOrBefore(series, t) {
  let last = null;
  for (const p of series) {
    if (p.t > t) break;
    last = p;
  }
  return last;
}

/**
 * Peak SNWD rise in inches for a lookback window ending at the last obs.
 * This is not recorded snowfall.
 * Guards:
 *  - ignore ≤1″ SNWD flicker unless SWE also rose
 *  - if SNWD didn't rise but SWE did, convert WTEQ at 12:1 (still not snowfall)
 *  - ignore settling (negative SNWD) — peak vs start, not net
 */
export function newSnowInches(snwd, swe, hours) {
  if (!snwd.length) return { inches: 0, observedAt: null, method: 'none' };
  const endT = snwd[snwd.length - 1].t;
  const startT = endT - hours * 3600 * 1000;
  const start = valueAtOrBefore(snwd, startT) || snwd[0];
  let peak = start.v;
  for (const p of snwd) {
    if (p.t < startT || p.t > endT) continue;
    if (p.v > peak) peak = p.v;
  }
  let rise = Math.max(0, peak - start.v);

  let sweRise = 0;
  if (swe.length) {
    const sweStart = valueAtOrBefore(swe, startT) || swe[0];
    const sweEnd = valueAtOrBefore(swe, endT) || swe[swe.length - 1];
    sweRise = Math.max(0, sweEnd.v - sweStart.v);
  }

  let method = 'snwd-peak';
  if (rise <= NOISE_IN && sweRise < SWE_CONFIRM_IN) {
    rise = 0;
    method = 'noise';
  } else if (rise <= 0 && sweRise >= 0.1) {
    rise = sweRise * SLR;
    method = 'swe-slr';
  }
  rise = Math.min(CAP_IN, rise);
  return {
    inches: rise,
    observedAt: snwd[snwd.length - 1].date,
    method,
    peak,
    start: start.v,
    sweRise,
  };
}

export function inchesToCm(inches) {
  return Math.round(inches * 2.54 * 10) / 10;
}

export { isEstimatedSource } from './dumpScore.js';

export function modelEstFromSnow(r, snow) {
  const rec = snow?.resorts?.[r.id] || {};
  const sf = rec.sf || [];
  const today = snow?.today ?? 0;
  let past72Cm = 0;
  for (let i = Math.max(0, today - 2); i <= today; i++) past72Cm += sf[i] || 0;
  const past24Cm = sf[today] || 0;
  return {
    snow24hCm: Math.round(past24Cm * 10) / 10,
    snow72hCm: Math.round(past72Cm * 10) / 10,
    source: 'model-est',
    observedAt: snow?.generated || snow?.fetched || snow?.dates?.[today] || null,
    method: 'open-meteo-snowfall_sum',
  };
}

export function scoreStation(r, st) {
  const [lon, lat] = r.center || [];
  if (lon == null || lat == null || st.latitude == null || st.longitude == null) return Infinity;
  const km = haversineKm(lon, lat, st.longitude, st.latitude);
  if (km > MAX_KM) return Infinity;
  const mid = midElevM(r);
  const elevM = st.elevation != null ? st.elevation * 0.3048 : null; // AWDB elev is feet
  let elevPen = 0;
  if (mid != null && elevM != null) {
    const d = Math.abs(elevM - mid);
    elevPen = d / 50; // 500 m ≈ 10 km
    if (d > 900) return Infinity;
  }
  return km + elevPen;
}

export function pickStation(r, stations) {
  let best = null;
  let bestScore = Infinity;
  for (const st of stations) {
    const s = scoreStation(r, st);
    if (s < bestScore) {
      bestScore = s;
      best = st;
    }
  }
  if (!best || bestScore === Infinity) return null;
  const [lon, lat] = r.center;
  return {
    triplet: best.stationTriplet,
    name: best.name,
    lat: best.latitude,
    lon: best.longitude,
    elevFt: best.elevation,
    km: Math.round(haversineKm(lon, lat, best.longitude, best.latitude) * 10) / 10,
    network: best.networkCode,
  };
}

export function filterSnowStations(all) {
  return (all || []).filter(s => s.networkCode === 'SNTL' || s.networkCode === 'SNTLT');
}

export async function downloadStations() {
  const url = `${AWDB}/stations?activeOnly=true`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`AWDB stations ${res.status}`);
  const all = await res.json();
  return filterSnowStations(all);
}

export function buildSnotelMap(resorts, stations) {
  const map = {};
  for (const r of resorts) {
    if (r.country && r.country !== 'US') continue;
    const pick = pickStation(r, stations);
    if (pick) map[r.id] = pick;
  }
  return map;
}

export async function fetchAwdbHourly(triplets, { begin, end } = {}) {
  if (!triplets.length) return [];
  const today = new Date();
  const beginDate = begin || isoDate(new Date(today.getTime() - 4 * 86400000));
  const endDate = end || isoDate(new Date(today.getTime() + 86400000));
  const out = [];
  const chunk = 40;
  for (let i = 0; i < triplets.length; i += chunk) {
    const slice = triplets.slice(i, i + chunk);
    const q = new URLSearchParams({
      stationTriplets: slice.join(','),
      elements: 'SNWD,WTEQ',
      duration: 'HOURLY',
      beginDate,
      endDate,
    });
    const url = `${AWDB}/data?${q}`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`AWDB data ${res.status}`);
    const json = await res.json();
    out.push(...(Array.isArray(json) ? json : [json]));
  }
  return out;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function observedFromStation(station) {
  const snwd = seriesOf(station, 'SNWD');
  const swe = seriesOf(station, 'WTEQ');
  const h24 = newSnowInches(snwd, swe, 24);
  const h72 = newSnowInches(snwd, swe, 72);
  const snow72 = Math.max(h72.inches, h24.inches);
  const method = snow72 === h24.inches ? h24.method : h72.method;
  return {
    snow24hCm: inchesToCm(h24.inches),
    snow72hCm: inchesToCm(snow72),
    snow24hIn: Math.round(h24.inches * 10) / 10,
    snow72hIn: Math.round(snow72 * 10) / 10,
    observedAt: (snwd[snwd.length - 1] || swe[swe.length - 1] || {}).date || null,
    method,
    snwdIn: snwd.length ? snwd[snwd.length - 1].v : null,
    sweIn: swe.length ? swe[swe.length - 1].v : null,
  };
}

export async function buildObservedSnapshot({ resorts, snow, map, stationsData }) {
  const unique = [...new Set(Object.values(map || {}).map(s => s.triplet).filter(Boolean))];
  const data = stationsData || (unique.length ? await fetchAwdbHourly(unique) : []);
  const byTriplet = Object.fromEntries(data.map(s => [s.stationTriplet, s]));
  const fetched = new Date().toISOString();
  const out = { fetched, source: 'nrcs-snotel+model-est', resorts: {} };
  let snotel = 0;
  let est = 0;
  for (const r of resorts) {
    const meta = map?.[r.id];
    const st = meta ? byTriplet[meta.triplet] : null;
    if (st) {
      const obs = observedFromStation(st);
      const source = `snotel:${meta.triplet}`;
      out.resorts[r.id] = {
        snow24hCm: obs.snow24hCm,
        snow72hCm: obs.snow72hCm,
        source,
        observedAt: toIsoish(obs.observedAt),
        station: meta,
        method: obs.method,
        snwdIn: obs.snwdIn,
        sweIn: obs.sweIn,
        metric: metricOf(obs.method, source),
        windowHours: 72,
        retrievedAt: fetched,
        valueState: valueState(obs.snow72hCm),
      };
      snotel += 1;
    } else {
      const estRec = modelEstFromSnow(r, snow);
      out.resorts[r.id] = {
        ...estRec,
        metric: metricOf(estRec.method, estRec.source),
        windowHours: 72,
        retrievedAt: fetched,
        valueState: valueState(estRec.snow72hCm),
      };
      est += 1;
    }
  }
  out.counts = { snotel, est, stations: unique.length };
  return out;
}

function toIsoish(s) {
  if (!s) return null;
  const t = String(s).trim().replace(' ', 'T');
  return t.length === 16 ? `${t}:00` : t;
}

export { relativeUpdated } from './dumpScore.js';

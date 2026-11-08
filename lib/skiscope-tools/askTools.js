/**
 * Ask SkiScope tools. Pure: callers pass the catalog, so the same code runs in the
 * Node handler (AI SDK tool execute), the MCP tool layer, and the browser fallback.
 *
 * Outputs carry both cm and inches so the model can answer in the user's units and
 * the UI can render without a second lookup. Actual = observed (SNOTEL) or modeled
 * est.; forecast = Open-Meteo next 7 days; climatology = ERA5 historical average.
 */
import { compareBoard, dumpParts } from '../dumpScore.js';
import { stormStatus } from '../stormStatus.js';
import { forecastDays } from '../snowWindow.js';
import { IN } from '../util.js';
import { attribution } from './attribution.js';
import { findResort, filterResorts } from './core.js';

export const ASK_SORTS = {
  actual72h: { board: 'actual72', label: 'Actual 72h' },
  actual24h: { board: 'actual24', label: 'Actual 24h' },
  forecast7d: { board: 'forecast7d', label: 'Forecast 7d' },
};

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const r1 = v => Math.round((v || 0) * 10) / 10;
const MIN_SEASONS = 5;

export function monthNumber(m) {
  if (m == null || m === '') return null;
  if (Number.isFinite(+m) && +m >= 1 && +m <= 12) return Math.round(+m);
  const s = String(m).trim().toLowerCase().slice(0, 3);
  const i = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(s));
  return i >= 0 ? i + 1 : null;
}

function whereOf(r) {
  return r.region || r.state || r.country || null;
}

function whereLabel(region, args) {
  return region?.name || args.country || args.state || 'Worldwide';
}

function sourceMeta(cat) {
  const snow = cat.snow || {};
  return {
    asOf: snow.dates?.[snow.today] || null,
    forecastEnd: snow.dates?.[snow.dates.length - 1] || null,
    horizonDays: Math.max(0, (snow.dates?.length || 0) - 1 - (snow.today || 0)),
    ...attribution(snow),
  };
}

export function snowRowFor(r, cat) {
  const p = dumpParts(r, cat.snow);
  return {
    id: r.id,
    name: r.name,
    where: whereOf(r),
    actual72Cm: r1(p.past72Cm),
    actual24Cm: r1(p.past24Cm),
    next7Cm: r1(p.next7Cm),
    actual72In: r1(p.past72In),
    actual24In: r1(p.past24In),
    next7In: r1(p.next7In),
    estimated: !!p.estimated,
    source: p.source,
  };
}

function factsFor(r) {
  const vertical = r.summit && r.base ? r.summit - r.base : null;
  return {
    summitM: r.summit || null,
    baseM: r.base || null,
    verticalM: vertical,
    runs: r.runs || null,
    lifts: r.lifts || null,
    airport: r.iata || null,
    town: r.town || null,
    passes: r.passes || [],
    web: r.web || null,
  };
}

function climateFor(r, cat) {
  const c = cat.climatology?.resorts?.[r.id];
  if (!c) return null;
  return { hemisphere: c.h, seasons: c.n, avgCm: c.avg };
}

export function rankResorts(args = {}, cat) {
  const sort = ASK_SORTS[args.sort] ? args.sort : 'actual72h';
  const limit = Math.min(12, Math.max(1, args.limit || 6));
  const { list, region } = filterResorts(cat, args);
  let pool = list;
  if (args.observedOnly) pool = pool.filter(r => !dumpParts(r, cat.snow).estimated);
  const ranked = pool.slice().sort((a, b) => compareBoard(a, b, cat.snow, ASK_SORTS[sort].board));
  const rows = ranked.slice(0, limit).map(r => snowRowFor(r, cat));
  const lead = (key) => {
    let best = null;
    for (const r of pool) {
      const row = snowRowFor(r, cat);
      if (!best || row[key] > best[key]) best = row;
    }
    return best && best[key] > 0 ? { id: best.id, name: best.name, cm: best[key], in: best[key.replace('Cm', 'In')] } : null;
  };
  return {
    kind: 'rank',
    sort,
    sortLabel: ASK_SORTS[sort].label,
    where: whereLabel(region, args),
    regionId: region?.id || null,
    pass: args.pass || null,
    total: pool.length,
    rows,
    actualLeader: lead('actual72Cm'),
    forecastLeader: lead('next7Cm'),
    ...sourceMeta(cat),
  };
}

export function getResort(args = {}, cat) {
  const r = findResort(cat, args.resort);
  if (!r) return { kind: 'resort', found: false, query: String(args.resort || ''), ...sourceMeta(cat) };
  const status = stormStatus(r, cat.snow, { units: 'in' });
  const days = forecastDays(r, cat.snow, { days: 7 }).map(d => ({ date: d.date, snowCm: r1(d.snowCm) }));
  return {
    kind: 'resort',
    found: true,
    resort: { ...snowRowFor(r, cat), ...factsFor(r) },
    storm: { kind: status.kind, text: status.text },
    forecastDays: days,
    climate: climateFor(r, cat),
    ...sourceMeta(cat),
  };
}

export function compareResortsDetail(args = {}, cat) {
  const seen = new Set();
  const rows = [];
  for (const id of args.ids || []) {
    const r = findResort(cat, id);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    rows.push({ ...snowRowFor(r, cat), ...factsFor(r) });
    if (rows.length >= 4) break;
  }
  return { kind: 'compare', rows, ...sourceMeta(cat) };
}

function seasonsLabel(clim, hemis) {
  const spans = hemis.map(h => clim?.seasons?.[h]).filter(Boolean);
  if (!spans.length) return null;
  const first = spans.map(s => s.first).sort()[0];
  const last = spans.map(s => s.last).sort().slice(-1)[0];
  return `${first} to ${last}`;
}

export function monthClimatology(args = {}, cat) {
  const clim = cat.climatology || { resorts: {} };
  const month = monthNumber(args.month);
  const { list, region } = filterResorts(cat, args);
  const anyData = list.filter(r => clim.resorts?.[r.id]);
  const mature = anyData.filter(r => (clim.resorts[r.id].n || 0) >= MIN_SEASONS);
  const withData = mature.length ? mature : anyData;
  const hemis = [...new Set(withData.map(r => clim.resorts[r.id].h))];
  const base = {
    kind: month ? 'month' : 'profile',
    label: 'Historical average',
    where: whereLabel(region, args),
    regionId: region?.id || null,
    seasons: seasonsLabel(clim, hemis.length ? hemis : ['N']),
    source: clim.source || 'ERA5 reanalysis via the Open-Meteo historical archive',
    note: 'Historical average from past seasons, not a forecast. Reanalysis runs low in big mountains, so compare resorts and months rather than reading it as resort-reported totals.',
    archiveMonths: clim.months || { N: [11, 12, 1, 2, 3, 4], S: [6, 7, 8, 9] },
    ...sourceMeta(cat),
  };

  if (month) {
    const limit = Math.min(12, Math.max(1, args.limit || 6));
    const rows = withData
      .map(r => {
        const c = clim.resorts[r.id];
        const avg = c.avg?.[month - 1];
        if (avg == null) return null;
        return {
          id: r.id,
          name: r.name,
          where: whereOf(r),
          avgCm: avg,
          avgIn: r1(IN(avg)),
          loCm: c.lo?.[month - 1] ?? null,
          hiCm: c.hi?.[month - 1] ?? null,
          seasons: c.n,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.avgCm - a.avgCm) || a.name.localeCompare(b.name));
    return {
      ...base,
      month,
      monthName: MONTH_NAMES[month - 1],
      total: rows.length,
      outOfArchive: rows.length === 0,
      rows: rows.slice(0, limit),
    };
  }

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const vals = withData.map(r => clim.resorts[r.id].avg?.[m - 1]).filter(v => v != null);
    if (!vals.length) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    months.push({ month: m, monthName: MONTH_NAMES[m - 1], avgCm: r1(avg), avgIn: r1(IN(avg)), resorts: vals.length });
  }
  const south = hemis.length === 1 && hemis[0] === 'S';
  const order = south ? [6, 7, 8, 9] : [11, 12, 1, 2, 3, 4, 6, 7, 8, 9];
  months.sort((a, b) => order.indexOf(a.month) - order.indexOf(b.month));
  const best = months.reduce((b, m) => (!b || m.avgCm > b.avgCm ? m : b), null);
  return { ...base, resorts: withData.length, months, best };
}

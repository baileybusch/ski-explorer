/**
 * Typed SkiScope data tools. The only place that reads snow.json / history.
 * MCP, search, the alert evaluator, and the readout writer all call these.
 */
import { dumpParts } from '../dumpScore.js';
import { stormStatus } from '../stormStatus.js';
import { historyFor } from '../snowHistory.js';
import { forecastDays } from '../snowWindow.js';
import { searchAll, resortsForRegion, regionMatchesResort } from '../search.js';
import { fmtIn } from '../util.js';
import { catalogOf, attribution } from './catalog.js';

function amt(cm, units = 'in') {
  if (cm == null || !Number.isFinite(cm)) return units === 'cm' ? '0 cm' : '0″';
  return units === 'cm' ? `${Math.round(cm)} cm` : `${fmtIn(cm)}″`;
}

function findResort(cat, id) {
  const n = String(id || '').toLowerCase();
  return cat.resorts.find(r => r.id === id || r.id === n || r.name.toLowerCase() === n
    || (r.aliases || []).some(a => String(a).toLowerCase() === n)) || null;
}

function findRegion(cat, id) {
  if (!id) return null;
  const n = String(id).toLowerCase();
  return cat.regions.find(g => g.id === n || g.name.toLowerCase() === n
    || (g.aliases || []).some(a => String(a).toLowerCase() === n)) || null;
}

function passOK(pass) {
  if (!pass || pass === 'all' || pass === 'both') return () => true;
  return r => (r.passes || []).includes(pass);
}

function filterResorts(cat, { region, country, state, pass } = {}) {
  let list = cat.resorts.filter(passOK(pass));
  const g = findRegion(cat, region) || findRegion(cat, country) || findRegion(cat, state);
  if (g) list = list.filter(r => regionMatchesResort(g, r));
  else if (country) list = list.filter(r => String(r.country || '').toLowerCase() === String(country).toLowerCase());
  else if (state) list = list.filter(r => String(r.region || r.state || '').toLowerCase() === String(state).toLowerCase());
  return { list, region: g };
}

function snowRow(r, cat, units = 'in') {
  const parts = dumpParts(r, cat.snow);
  return {
    id: r.id,
    name: r.name,
    region: r.region || r.state || null,
    country: r.country || null,
    pass: r.passes || [],
    past72: parts.past72In,
    next7: parts.next7In,
    dump: parts.dumpIn,
    past72Label: amt(parts.past72Cm, units),
    next7Label: amt(parts.next7Cm, units),
    iata: r.iata || null,
  };
}

function metricValue(row, metric, hist) {
  if (metric === 'past72') return row.past72;
  if (metric === 'next7') return row.next7;
  if (metric === 'std') return hist?.stdIn ?? 0;
  if (metric === 'vsavg') return hist?.vsAvg ?? -999;
  return row.dump;
}

function wrap(data, text, cat, extra = {}) {
  return { ok: true, data, text, meta: { ...attribution(cat.snow), units: extra.units || 'in', ...extra } };
}

export function search_resorts(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const limit = args.limit || 16;
  const passFn = passOK(args.pass);
  const q = args.query || args.region || args.country || args.state || '';
  const { regions, resorts } = searchAll(q, { regions: cat.regions, resorts: cat.resorts, passOK: passFn });
  const g = regions[0] || findRegion(cat, args.region) || findRegion(cat, args.country);
  const fromRegion = g ? resortsForRegion(g, cat.resorts, passFn) : [];
  const list = (fromRegion.length ? fromRegion : resorts).slice(0, limit).map(r => snowRow(r, cat, units));
  const title = g?.name || q || 'resorts';
  return wrap({ query: q, region: g ? { id: g.id, name: g.name } : null, resorts: list },
    `${list.length} resorts for ${title}`, cat, { units });
}

export function list_regions(_args, injected) {
  const cat = catalogOf(injected);
  const regions = cat.regions.map(g => ({ id: g.id, name: g.name, aliases: g.aliases || [] }));
  return wrap({ regions }, `${regions.length} regions`, cat);
}

export function get_leaderboard(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const metric = args.metric || 'dump';
  const limit = args.limit || 10;
  const { list, region } = filterResorts(cat, args);
  const rows = list.map(r => {
    const row = snowRow(r, cat, units);
    const h = historyFor(r, cat.snow, cat.history);
    const stdIn = (h.stdCm || 0) / 2.54;
    const avg = h.sameDate?.length ? h.sameDate.reduce((a, b) => a + (b.cm || 0), 0) / h.sameDate.length / 2.54 : null;
    return { ...row, stdIn, vsAvg: avg ? stdIn - avg : 0, score: metricValue({ ...row, stdIn, vsAvg: avg ? stdIn - avg : 0 }, metric, { stdIn, vsAvg: avg ? stdIn - avg : 0 }) };
  });
  rows.sort((a, b) => (b.score - a.score) || (b.next7 - a.next7) || a.name.localeCompare(b.name));
  const top = rows.slice(0, limit);
  const where = region?.name || args.country || args.state || args.pass || 'worldwide';
  const lead = top[0];
  const text = lead
    ? `${where} leaderboard (${metric}): ${lead.name} ${lead.past72Label} last 72h, ${lead.next7Label} coming`
    : `${where} is quiet`;
  return wrap({ where, metric, region: region ? { id: region.id, name: region.name } : null, rows: top }, text, cat, { units });
}

export function get_resort_snow(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const r = findResort(cat, args.resort);
  if (!r) return { ok: false, error: 'unknown resort', data: null, text: 'unknown resort', meta: attribution(cat.snow) };
  const row = snowRow(r, cat, units);
  const parts = dumpParts(r, cat.snow);
  const text = `${r.name}: ${row.past72Label} last 72h, ${row.next7Label} forecast next 7d`;
  return wrap({ ...row, past72Cm: parts.past72Cm, next7Cm: parts.next7Cm, dumpCm: parts.dumpCm }, text, cat, { units });
}

export function get_resort_forecast(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const r = findResort(cat, args.resort);
  if (!r) return { ok: false, error: 'unknown resort', data: null, text: 'unknown resort', meta: attribution(cat.snow) };
  const days = forecastDays(r, cat.snow, { days: args.days || 7 }).map(d => ({
    date: d.date,
    snowCm: d.snowCm || 0,
    snow: amt(d.snowCm || 0, units),
    tmax: d.tmax ?? null,
    tmin: d.tmin ?? null,
  }));
  const total = days.reduce((a, d) => a + d.snowCm, 0);
  return wrap({ id: r.id, name: r.name, days, total: amt(total, units) },
    `${r.name} next ${days.length}d: ${amt(total, units)}`, cat, { units });
}

export function get_storm_status(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const r = findResort(cat, args.resort);
  if (!r) return { ok: false, error: 'unknown resort', data: null, text: 'unknown resort', meta: attribution(cat.snow) };
  const status = stormStatus(r, cat.snow, { units });
  return wrap({ id: r.id, name: r.name, kind: status.kind, text: status.text, source: status.source }, status.text, cat, { units });
}

export function get_snow_history(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const r = findResort(cat, args.resort);
  if (!r) return { ok: false, error: 'unknown resort', data: null, text: 'unknown resort', meta: attribution(cat.snow) };
  const h = historyFor(r, cat.snow, cat.history);
  const data = {
    id: r.id,
    name: r.name,
    last24: amt(h.current.last24Cm, units),
    last72: amt(h.current.last72Cm, units),
    storm: amt(h.current.stormCm, units),
    std: amt(h.stdCm, units),
    last24Cm: h.current.last24Cm,
    last72Cm: h.current.last72Cm,
    stormCm: h.current.stormCm,
    stdCm: h.stdCm,
    verdict: h.verdict || '',
    sameDate: h.sameDate || [],
  };
  return wrap(data, `${r.name} history: ${data.std} this season. ${data.verdict}`.trim(), cat, { units });
}

export function compare_resorts(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const rows = (args.ids || []).map(id => get_resort_snow({ resort: id, units }, cat)).filter(x => x.ok).map(x => x.data);
  const text = rows.map(r => `${r.name} ${r.past72Label} / ${r.next7Label}`).join('; ') || 'no resorts';
  return wrap({ rows }, text, cat, { units });
}

export function plan_trip_snapshot(args = {}, injected) {
  const cat = catalogOf(injected);
  const units = args.units || 'in';
  const snow = get_resort_snow({ resort: args.resort, units }, cat);
  if (!snow.ok) return snow;
  const forecast = get_resort_forecast({ resort: args.resort, units }, cat);
  const storm = get_storm_status({ resort: args.resort, units }, cat);
  const hist = get_snow_history({ resort: args.resort, units }, cat);
  const data = {
    resort: snow.data,
    start: args.start || null,
    end: args.end || null,
    forecast: forecast.data,
    storm: storm.data,
    history: hist.data,
  };
  const text = `${snow.data.name} trip ${args.start || ''}–${args.end || ''}: ${snow.data.past72Label} last 72h, ${snow.data.next7Label} coming. ${storm.data?.kind || ''}`.trim();
  return wrap(data, text, cat, { units });
}

export const impl = {
  search_resorts, list_regions, get_leaderboard, get_resort_snow,
  get_resort_forecast, get_storm_status, get_snow_history, compare_resorts, plan_trip_snapshot,
};

/**
 * Typed SkiScope data tools. The only place that reads snow.json / history.
 * MCP, search, the alert evaluator, and the readout writer all call these.
 */
import { dumpParts } from '../dumpScore.js';
import { stormStatus } from '../stormStatus.js';
import { historyFor } from '../snowHistory.js';
import { forecastDays } from '../snowWindow.js';
import { searchAll, resortsForRegion } from '../search.js';
import { fmtIn } from '../util.js';
import { catalogOf, attribution } from './catalog.js';
import { findResort, findRegion, passOK, filterResorts } from './core.js';
import { rankResorts, getResort, compareResortsDetail, monthClimatology } from './askTools.js';

function amt(cm, units = 'in') {
  if (cm == null || !Number.isFinite(cm)) return units === 'cm' ? '0 cm' : '0″';
  return units === 'cm' ? `${Math.round(cm)} cm` : `${fmtIn(cm)}″`;
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
    snow72h_observed: parts.past72In,
    snow24h_observed: parts.past24In,
    forecast7d: parts.next7In,
    source: parts.source,
    estimated: parts.estimated,
    observed_at: parts.observedAt,
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
  const metric = args.metric || 'past72';
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
  const est = parts.estimated ? ' est.' : '';
  const text = `${r.name}: ${row.past72Label} last 72h${est}, ${row.next7Label} forecast next 7d`;
  return wrap({
    ...row,
    past72Cm: parts.past72Cm,
    next7Cm: parts.next7Cm,
    dumpCm: parts.dumpCm,
    snow72h_observed: parts.past72In,
    snow24h_observed: parts.past24In,
    forecast7d: parts.next7In,
    source: parts.source,
    observed_at: parts.observedAt,
  }, text, cat, { units });
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

function wrapAsk(fn, textOf) {
  return (args = {}, injected) => {
    const cat = catalogOf(injected);
    const data = fn(args, cat);
    return { ok: data.found !== false, data, text: textOf(data), meta: { ...attribution(cat.snow), units: 'in' } };
  };
}

export const rank_resorts = wrapAsk(rankResorts, d => {
  const top = d.rows[0];
  return top ? `${d.where} by ${d.sortLabel}: ${top.name} ${fmtIn(top.actual72Cm)}″ last 72h, ${fmtIn(top.next7Cm)}″ next 7d` : `${d.where}: no resorts`;
});

export const get_resort = wrapAsk(getResort, d => (d.found
  ? `${d.resort.name}: ${fmtIn(d.resort.actual72Cm)}″ last 72h${d.resort.estimated ? ' est.' : ''}, ${fmtIn(d.resort.next7Cm)}″ next 7d. ${d.storm.text}`
  : `unknown resort ${d.query}`));

export const month_climatology = wrapAsk(monthClimatology, d => {
  if (d.kind === 'month') {
    const top = d.rows[0];
    return top ? `Historical ${d.monthName} average, ${d.where}: ${top.name} ${fmtIn(top.avgCm)}″ (${d.seasons}). Not a forecast.` : `No archive data for ${d.monthName} in ${d.where}.`;
  }
  return d.best ? `${d.where} snowiest month on average: ${d.best.monthName} (${fmtIn(d.best.avgCm)}″ per resort, ${d.seasons}). Not a forecast.` : `No archive data for ${d.where}.`;
});

export { compareResortsDetail };

export const impl = {
  search_resorts, list_regions, get_leaderboard, get_resort_snow,
  get_resort_forecast, get_storm_status, get_snow_history, compare_resorts, plan_trip_snapshot,
  rank_resorts, get_resort, month_climatology,
};

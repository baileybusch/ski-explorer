import { addDays } from './util.js';

/** Inclusive list of YYYY-MM-DD between start and end. */
export function eachDate(start, end) {
  const out = [];
  let d = start;
  while (d <= end) { out.push(d); d = addDays(d, 1); }
  return out;
}

export const SNOW_PRESETS = [
  { id: '24h', label: '24h' },
  { id: '72h', label: '72h' },
  { id: '7d', label: '7d' },
  { id: 'fc7', label: 'Next 7' },
];

export function defaultWindow(snow) {
  return presetWindow(snow, 'fc7');
}

/** Trailing observed (24h / 72h / 7d) or upcoming forecast (fc7). */
export function presetWindow(snow, preset = 'fc7') {
  const dates = snow.dates || [];
  const today = snow.today ?? 0;
  const last = dates[dates.length - 1];
  if (preset === '24h') {
    return { mode: '24h', start: dates[today], end: dates[today], label: 'Last 24h' };
  }
  if (preset === '72h') {
    const i = Math.max(0, today - 2);
    return { mode: '72h', start: dates[i], end: dates[today], label: 'Last 72h' };
  }
  if (preset === '7d') {
    const i = Math.max(0, today - 6);
    return { mode: '7d', start: dates[i], end: dates[today], label: 'Last 7 days' };
  }
  const startI = Math.min(today + 1, dates.length - 1);
  return { mode: 'fc7', start: dates[startI] || dates[today], end: last, label: 'Next 7 days' };
}

/** Next N forecast days from the snapshot (modeled, not observed). */
export function forecastDays(r, snow, { days = 5 } = {}) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  const dates = snow?.dates || [];
  const out = [];
  const start = Math.min(today + 1, dates.length - 1);
  for (let i = start; i < dates.length && out.length < days; i++) {
    out.push({
      date: dates[i],
      snowCm: sf[i] || 0,
      tmax: rec.tmax?.[i],
      tmin: rec.tmin?.[i],
      wcode: rec.wcode?.[i],
    });
  }
  return out;
}

export function snowSpark(r, snow, { back = 6, forward = 7 } = {}) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  const out = [];
  for (let i = today - back; i <= today + forward; i++) {
    if (i >= 0 && i < sf.length) out.push(sf[i] || 0);
    else if (i >= 0) out.push(0);
  }
  return out;
}

export function forecastEnd(snow) {
  return snow.dates[snow.dates.length - 1];
}

function typicalForDate(typical, r, date) {
  if (!typical?.windows) return 0;
  const md = date.slice(5);
  for (const [start, win] of Object.entries(typical.windows)) {
    const arr = win.resorts[r.id];
    if (!arr) continue;
    const startY = date.slice(0, 4);
    // window may cross year (Nov–Apr)
    let cursor = `${+md >= start ? startY : String(+startY - 1)}-${start}`;
    // rebuild from mm-dd start
    const [sm, sd] = start.split('-').map(Number);
    const base = new Date(Date.UTC(+startY, sm - 1, sd));
    // If date is before start in the same year and window is winter, use previous Nov
    const target = new Date(date + 'T12:00Z');
    let origin = new Date(Date.UTC(target.getUTCFullYear(), sm - 1, sd));
    if (target < origin) origin = new Date(Date.UTC(target.getUTCFullYear() - 1, sm - 1, sd));
    const i = Math.round((target - origin) / 864e5);
    if (i >= 0 && i < arr.length) return arr[i] || 0;
    void cursor;
  }
  return 0;
}

export function windowMetrics(r, snow, win, typical) {
  const dates = eachDate(win.start, win.end);
  const idx = Object.fromEntries(snow.dates.map((d, i) => [d, i]));
  let forecast = 0, recent = 0, typicalCm = 0;
  let usedForecast = false, usedTypical = false;
  let tmax, tmin, wcode;
  const rec = snow.resorts[r.id] || {};
  for (const d of dates) {
    if (d in idx) {
      const i = idx[d];
      const v = (rec.sf || r.sf || [])[i] || 0;
      if (i <= snow.today) recent += v;
      else { forecast += v; usedForecast = true; }
      if (rec.tmax) {
        const x = rec.tmax[i], n = rec.tmin?.[i];
        if (x != null) tmax = tmax == null ? x : Math.max(tmax, x);
        if (n != null) tmin = tmin == null ? n : Math.min(tmin, n);
      }
      if (rec.wcode && rec.wcode[i] != null) wcode = rec.wcode[i];
    } else {
      typicalCm += typicalForDate(typical, r, d);
      usedTypical = true;
    }
  }
  // Always expose last-7 / next-7 from the live snapshot for the list chips
  return {
    recent, forecast, typicalCm,
    windowCm: forecast + recent + typicalCm,
    outlookCm: forecast + typicalCm,
    usedForecast, usedTypical,
    tmax, tmin, wcode,
    hasSnow: (rec.sf || r.sf),
  };
}

export function weatherGlyph({ outlookCm, wcode, tmax }) {
  if (wcode != null) {
    if (wcode >= 71 && wcode <= 77) return '❄';
    if (wcode >= 85 && wcode <= 86) return '❄';
    if (wcode >= 61 && wcode <= 67) return '🌧';
    if (wcode >= 95) return '⛈';
    if (wcode === 0) return '☀';
    if (wcode <= 3) return '⛅';
    if (wcode <= 48) return '🌫';
  }
  if (outlookCm >= 8) return '❄';
  if (outlookCm > 0) return '☁';
  if (tmax != null && tmax > 8) return '☀';
  return '·';
}

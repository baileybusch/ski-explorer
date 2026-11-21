/**
 * "This weekend" = the next Saturday + Sunday in the forecast window. The window is the
 * same one the board's Next 7 days column uses: tomorrow through today + 7. Today's snow
 * is already in Last 24h, so on a Saturday "this weekend" is Sunday only, and on a Sunday
 * it is the following Sat + Sun. That keeps the weekend total inside (never above) the
 * 7-day total. Weekend answers must use only these days, never the 7-day total.
 * Browser-safe.
 */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dowOf = iso => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay();

/** Indices into `dates` for the upcoming weekend, starting at `from`. */
export function weekendIdx(dates = [], from = 0, to = Infinity) {
  const out = [];
  for (let i = Math.max(0, from); i < Math.min(dates.length, to + 1); i++) {
    const d = dowOf(dates[i]);
    if (d === 6) out.push(i);
    else if (d === 0) { out.push(i); break; }
    else if (out.length) break;
  }
  return out;
}

export function dayLabel(iso) {
  const t = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  return `${DOW[t.getUTCDay()]} ${MON[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

export function weekendLabel(dates = []) {
  if (!dates.length) return null;
  return dates.length === 1 ? dayLabel(dates[0]) : `${dayLabel(dates[0])}–${dayLabel(dates[dates.length - 1])}`;
}

const r1 = n => Math.round(n * 10) / 10;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** How the chat names the window: "Sunday" when it's one day, else "this weekend". */
export function weekendSay(dates = []) {
  if (!dates.length) return null;
  if (dates.length === 1) {
    const d = new Date(`${String(dates[0]).slice(0, 10)}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? 'this weekend' : WEEKDAY[d.getUTCDay()];
  }
  return 'this weekend';
}

/** Weekend day indices inside the Next 7 days window (tomorrow .. today + 7). */
export function weekendWindowIdx(snow) {
  const dates = snow?.dates || [];
  const today = snow?.today ?? 0;
  return weekendIdx(dates, today + 1, today + 7);
}

/** Weekend snow for one resort from the snow.json daily series (cm + in). */
export function weekendSnow(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec?.sf || [];
  const dates = snow?.dates || [];
  const idx = weekendWindowIdx(snow);
  const cm = idx.reduce((s, i) => s + (sf[i] || 0), 0);
  return { days: idx.map(i => dates[i]), label: weekendLabel(idx.map(i => dates[i])), cm: r1(cm), in: r1(cm / 2.54) };
}

/**
 * Weekend total from a list of daily rows ({ date, snowCm }), e.g. a resort's forecast days.
 * `today` (YYYY-MM-DD) drops today and earlier so the window matches Next 7 days; live
 * Open-Meteo day lists start today.
 */
export function weekendFromDays(days = [], { today = null } = {}) {
  const t = today ? String(today).slice(0, 10) : null;
  const ahead = t ? days.filter(d => String(d.date).slice(0, 10) > t) : days;
  const dates = ahead.map(d => d.date);
  const idx = weekendIdx(dates, 0);
  if (!idx.length) return null;
  const cm = idx.reduce((s, i) => s + (Number(ahead[i].snowCm) || 0), 0);
  const picked = idx.map(i => dates[i]);
  return { label: weekendLabel(picked), say: weekendSay(picked), snowIn: r1(cm / 2.54), days: idx.length };
}

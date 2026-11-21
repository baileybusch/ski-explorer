/**
 * "This weekend" = the next Saturday + Sunday in the forecast (today counts if it is
 * Saturday or Sunday). Weekend answers must use only these days, never the 7-day total.
 * Browser-safe.
 */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dowOf = iso => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay();

/** Indices into `dates` for the upcoming weekend, starting at `from`. */
export function weekendIdx(dates = [], from = 0) {
  const out = [];
  for (let i = Math.max(0, from); i < dates.length; i++) {
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

/** Weekend snow for one resort from the snow.json daily series (cm + in). */
export function weekendSnow(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec?.sf || [];
  const dates = snow?.dates || [];
  const today = snow?.today ?? 0;
  const idx = weekendIdx(dates, today);
  const cm = idx.reduce((s, i) => s + (sf[i] || 0), 0);
  return { days: idx.map(i => dates[i]), label: weekendLabel(idx.map(i => dates[i])), cm: r1(cm), in: r1(cm / 2.54) };
}

/** Weekend total from a list of daily rows ({ date, snowCm }), e.g. a resort's forecast days. */
export function weekendFromDays(days = []) {
  const dates = days.map(d => d.date);
  const idx = weekendIdx(dates, 0);
  if (!idx.length) return null;
  const cm = idx.reduce((s, i) => s + (Number(days[i].snowCm) || 0), 0);
  return { label: weekendLabel(idx.map(i => dates[i])), snowIn: r1(cm / 2.54), days: idx.length };
}

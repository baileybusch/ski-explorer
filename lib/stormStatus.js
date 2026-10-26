/**
 * Tweet-style storm status from the Open-Meteo snapshot in snow.json.
 * Deterministic. No LLM. Daily data only — no invented hourly timing.
 *
 * Status set: Quiet | Building | Active | Peaking | Winding down
 *
 *   Quiet         — past 72h and next 7d both under 2″
 *   Winding down  — meaningful snow already fell, leftover next-7d under 2″
 *   Peaking       — today is the heaviest nearby day, or the forecast peak is tomorrow
 *   Active        — snowing today (≥2″) or a solid last-72h with the peak within 2 days
 *   Building      — next 7d is meaningful and the peak is still 2+ days out
 */
import { IN, fmtIn, parseISO } from './util.js';
import { dumpParts } from './dumpScore.js';

const LIGHT_IN = 2;
const SOLID_IN = 6;
const START_CM = 1;

function weekday(date) {
  return parseISO(date).toLocaleDateString('en-US', { weekday: 'short' });
}

function amount(cm, units = 'in') {
  if (units === 'cm') return `${Math.round(cm)} cm`;
  return `${fmtIn(cm)}″`;
}

function forecastDays(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  const dates = snow?.dates || [];
  const out = [];
  for (let i = today + 1; i < dates.length; i++) {
    out.push({
      date: dates[i],
      cm: sf[i] || 0,
      offset: i - today,
      tmax: rec.tmax?.[i],
      tmin: rec.tmin?.[i],
    });
  }
  return out;
}

function todaySnow(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  return sf[today] || 0;
}

function qualityNote(days) {
  const snowDays = days.filter(d => d.cm >= START_CM);
  const tmaxs = snowDays.map(d => d.tmax).filter(n => n != null && Number.isFinite(n));
  if (!tmaxs.length) return '';
  const maxT = Math.max(...tmaxs);
  if (maxT <= -4) return 'Cold temps = light, dry powder.';
  if (maxT <= 0) return 'Temps stay near freezing, so the snow should stay decent.';
  if (maxT <= 3) return 'Temps flirt with freezing — expect mixed or heavier snow.';
  return 'Warm and wet, expect heavy snow or rain at base.';
}

function statusOf({ past72In, next7In, todayIn, peakOffset, peakIn }) {
  if (past72In < LIGHT_IN && next7In < LIGHT_IN) return 'Quiet';
  if (past72In >= LIGHT_IN && next7In < LIGHT_IN) return 'Winding down';
  const peakSoon = peakIn >= LIGHT_IN && peakOffset <= 1;
  const todayIsPeak = todayIn >= LIGHT_IN && todayIn + 0.05 >= peakIn;
  if (peakSoon || todayIsPeak) return 'Peaking';
  if (todayIn >= LIGHT_IN || (past72In >= SOLID_IN && next7In >= LIGHT_IN && peakOffset <= 2)) return 'Active';
  if (next7In >= LIGHT_IN) return 'Building';
  return 'Quiet';
}

/** @returns {{ kind: string, text: string, source: string }} */
export function stormStatus(r, snow, { units = 'in' } = {}) {
  const days = forecastDays(r, snow);
  const parts = dumpParts(r, snow);
  const todayCm = todaySnow(r, snow);
  const peak = days.reduce((a, d) => (d.cm > (a?.cm || -1) ? d : a), null);
  const start = days.find(d => d.cm >= START_CM) || days.find(d => d.cm > 0) || null;
  const last = [...days].reverse().find(d => d.cm >= START_CM) || peak;
  const kind = statusOf({
    past72In: parts.past72In,
    next7In: parts.next7In,
    todayIn: IN(todayCm),
    peakOffset: peak?.offset || 99,
    peakIn: peak ? IN(peak.cm) : 0,
  });

  const past = amount(parts.past72Cm, units);
  const next = amount(parts.next7Cm, units);
  const extra7 = parts.last7In - parts.past72In >= LIGHT_IN
    ? ` (${amount(parts.last7Cm, units)} over 7d)`
    : '';
  const quality = qualityNote(days);
  const span = start && last
    ? start.date === last.date
      ? weekday(start.date)
      : `${weekday(start.date)}-${weekday(last.date)}`
    : '';
  const peakDay = peak ? weekday(peak.date) : '';

  let text = `Storm status: ${kind}.`;
  if (kind === 'Quiet') {
    const quietLine = units === 'cm' ? 'Nothing over 5 cm in the next 7 days.' : 'Nothing over 2″ in the next 7 days.';
    text = `Storm status: Quiet. ${past} in the last 72h. ${quietLine}`;
  } else if (kind === 'Winding down') {
    text = `Storm status: Winding down. ${past} fell in the last 72h. Only ${next} left in the next 7 days.`;
  } else if (kind === 'Peaking') {
    text = `Storm status: Peaking. ${past} in the last 72h. Heaviest ${peakDay || 'soon'} (~${peak ? amount(peak.cm, units) : next}).`;
    if (quality) text += ` ${quality}`;
  } else {
    const when = span ? ` expected ${span}` : '';
    const peakBit = peakDay ? `, peaking ${peakDay}` : '';
    text = `Storm status: ${kind}. ${past} in the last 72h${extra7}, another ${next}${when}${peakBit}.`;
    if (quality) text += ` ${quality}`;
  }

  return { kind, text, source: 'Modeled forecast.' };
}

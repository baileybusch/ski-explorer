/**
 * Tweet-style storm status from the Open-Meteo snapshot in snow.json.
 * Deterministic. No LLM. Daily data only — no invented hourly timing.
 */
import { IN, fmtIn, parseISO } from './util.js';

const QUIET_IN = 2;
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
      tmax: rec.tmax?.[i],
      tmin: rec.tmin?.[i],
    });
  }
  return out;
}

function recent72Cm(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  let sum = 0;
  for (let i = Math.max(0, today - 2); i <= today; i++) sum += sf[i] || 0;
  return sum;
}

function qualityNote(days) {
  const snowDays = days.filter(d => d.cm >= START_CM);
  const tmaxs = snowDays.map(d => d.tmax).filter(n => n != null && Number.isFinite(n));
  if (!tmaxs.length) return '';
  const maxT = Math.max(...tmaxs);
  if (maxT <= -4) return 'Temps stay cold, so it stays light and dry.';
  if (maxT <= 0) return 'Temps stay near freezing, so the snow should stay decent.';
  if (maxT <= 3) return 'Temps flirt with freezing, so expect mixed or heavier snow.';
  return 'Temps climb above freezing — snow may go wet.';
}

/** @returns {{ kind: 'quiet'|'incoming', text: string, source: string }} */
export function stormStatus(r, snow, { units = 'in' } = {}) {
  const days = forecastDays(r, snow);
  const recent = recent72Cm(r, snow);
  const maxDayIn = days.reduce((m, d) => Math.max(m, IN(d.cm)), 0);
  const quietLine = units === 'cm' ? 'Nothing over 5 cm in the next 7 days.' : 'Nothing over 2″ in the next 7 days.';

  if (!days.length || maxDayIn < QUIET_IN) {
    return {
      kind: 'quiet',
      text: `Storm status: Quiet. ${quietLine} Best recent: ${amount(recent, units)} in the last 72h.`,
      source: 'Modeled forecast.',
    };
  }

  const start = days.find(d => d.cm >= START_CM) || days.find(d => d.cm > 0) || days[0];
  const peak = days.reduce((a, d) => (d.cm > a.cm ? d : a), days[0]);
  const last = [...days].reverse().find(d => d.cm >= START_CM) || peak;
  const total = days
    .filter(d => d.date >= start.date && d.date <= last.date)
    .reduce((a, d) => a + d.cm, 0);
  const quality = qualityNote(days);
  let text = `Storm status: Snow starts ${weekday(start.date)}. Expect ~${amount(total, units)} through ${weekday(last.date)}, heaviest ${weekday(peak.date)}.`;
  if (quality) text += ` ${quality}`;
  return { kind: 'incoming', text, source: 'Modeled forecast.' };
}

/**
 * Resort storm synopsis from the Open-Meteo snapshot in snow.json.
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
  return parseISO(date).toLocaleDateString('en-US', { weekday: 'long' });
}

function amount(cm, units = 'in') {
  if (units === 'cm') return `${Math.round(cm)} cm`;
  return `${fmtIn(cm)}″`;
}

function mountainName(r) {
  const n = String(r?.name || '').replace(/ \([^)]*\)$/, '').trim();
  return n || 'This mountain';
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

/** Temperature fact only — never invents powder quality. */
function tempNote(days) {
  const snowDays = days.filter(d => d.cm >= START_CM);
  const tmaxs = snowDays.map(d => d.tmax).filter(n => n != null && Number.isFinite(n));
  if (!tmaxs.length) return '';
  const maxT = Math.max(...tmaxs);
  if (maxT <= -4) return 'Highs stay well below freezing on the snow days.';
  if (maxT <= 0) return 'Highs stay near freezing on the snow days.';
  if (maxT <= 3) return 'Highs flirt with freezing on the snow days.';
  return 'Highs run above freezing on the snow days, so expect heavier snow.';
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

function netName(parts) {
  return String(parts.source || '').startsWith('cdec:') ? 'CDEC' : 'SNOTEL';
}

/** Under this, the last 3 days read as "little new snow". */
const TRACE_CM = 1.27;

/**
 * Plain words for Last 72h, no station jargon (SNOTEL / CDEC / SWE / snow-depth
 * rise live in `source`, not here): "about 22″ of new snow in 3 days".
 * Water-content conversions and model numbers are marked "est.".
 */
function pastPhrase(parts, units) {
  if (!(parts.past72Cm >= TRACE_CM)) return null;
  const est = parts.estimated || parts.method === 'swe-slr';
  return `about ${amount(parts.past72Cm, units)} of new snow in 3 days${est ? ' (est.)' : ''}`;
}

const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

function sourceLine(parts) {
  if (parts.method === 'swe-slr') {
    return `Last 72h is ${netName(parts)} SWE (WTEQ) converted at 12:1 — not recorded snowfall. Next 7 days is an Open-Meteo forecast.`;
  }
  return parts.estimated
    ? 'Last 72h is an Open-Meteo snowfall estimate, not a station observation. Next 7 days is an Open-Meteo forecast.'
    : `Last 72h is ${netName(parts)} snow-depth (SNWD) peak-rise, not recorded snowfall. Next 7 days is an Open-Meteo forecast.`;
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

  const name = mountainName(r);
  const next = amount(parts.next7Cm, units);
  const quality = tempNote(days);
  const span = start && last
    ? start.date === last.date
      ? weekday(start.date)
      : `${weekday(start.date)}–${weekday(last.date)}`
    : '';
  const peakDay = peak ? weekday(peak.date) : '';
  const peakAmt = peak ? amount(peak.cm, units) : next;
  const quietLine = units === 'cm'
    ? 'the 7-day forecast stays under 5 cm'
    : 'the 7-day forecast stays under 2″';

  const got = pastPhrase(parts, units);
  const nextIsTrace = !(parts.next7Cm >= TRACE_CM);
  let text;
  if (kind === 'Quiet') {
    text = `${name} is quiet. ${got ? cap(got) : 'Little new snow in the last 3 days'}, and ${quietLine}.`;
  } else if (kind === 'Winding down') {
    text = `${name} just got ${got || 'a little new snow'}. ${nextIsTrace ? 'No more snow in the forecast.' : `Only about ${next} more in the forecast.`}`;
  } else if (kind === 'Peaking') {
    text = got
      ? `${name} is in the heart of a storm. ${cap(got)}, heaviest ${peakDay || 'soon'} (~${peakAmt}).`
      : `${name} is in the heart of a storm. Heaviest snow ${peakDay || 'soon'} (~${peakAmt}).`;
  } else if (kind === 'Active') {
    const when = span ? ` ${span}` : '';
    const peakBit = peakDay ? `, heaviest ${peakDay}` : '';
    text = `${name} is in a storm cycle. ${got ? `${cap(got)}, with about` : 'About'} ${next} more coming${when}${peakBit}.`;
  } else {
    const when = span ? ` ${span}` : '';
    const peakBit = peakDay ? `, heaviest ${peakDay}` : '';
    text = `${name} is lining up a storm. ${got ? `${cap(got)}. ` : ''}About ${next} is forecast${when}${peakBit}.`;
  }
  if (quality) text += ` ${quality}`;

  return { kind, text, source: sourceLine(parts) };
}

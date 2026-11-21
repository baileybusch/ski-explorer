/**
 * Compact views of tool outputs for the model (eve `toModelOutput`).
 *
 * The UI cards still get the full tool output; the model only needs the gist.
 * Smaller payloads = cheaper turns and faster first tokens. Every view keeps
 * the honesty labels (observed vs est., source, asOf) and states snow level
 * and wind in plain words so the chat never has to invent phrasing.
 */

import { weekendFromDays } from '../skiscope-tools/weekend.js';

const r1 = n => (n == null || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 10) / 10);
const cmToIn = cm => (cm == null ? null : r1(Number(cm) / 2.54));

function regionGist(snowClimate) {
  if (!snowClimate) return null;
  const guide = String(snowClimate.guide || '');
  const pick = heading => {
    const m = guide.match(new RegExp(`## ${heading}[^\\n]*\\n([\\s\\S]*?)(?:\\n## |$)`));
    if (!m) return null;
    return m[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 2)
      .map(l => l.replace(/^\s*-\s*/, '').replace(/\s*\[[^\]]*\]/g, '').replace(/\*\*/g, '').trim()).join(' ');
  };
  return {
    region: snowClimate.region,
    nearestFit: !!snowClimate.nearestFit,
    climate: pick('Climate type'),
    powderProfile: pick('Powder-day profile'),
    snowQuality: pick('Snow-to-liquid and density'),
  };
}

/** Plain-words snow level vs base. Never "not reached base". */
export function snowLevelWords(snowLevel, powderCall) {
  const lvl = snowLevel?.meanFt ?? powderCall?.snowLevelFt ?? null;
  const base = snowLevel?.baseFt ?? powderCall?.baseFt ?? null;
  const rain = snowLevel?.rainAtBase ?? powderCall?.rainAtBase ?? false;
  if (rain) return `Rain likely at the base (snow level around ${Math.round(lvl / 100) * 100} ft, above the ${base} ft base).`;
  if (lvl != null && base != null) {
    return lvl < base
      ? `Snow level stays below the base (about ${Math.round(lvl / 100) * 100} ft vs ${base} ft base), so it is snow top to bottom.`
      : `Snow level near or just above the base (about ${Math.round(lvl / 100) * 100} ft vs ${base} ft base); lower runs may be wet.`;
  }
  return 'No snow-level reading; nothing points to rain at the base.';
}

export function windWords(wind, powderCall) {
  const s = wind?.speedMph ?? powderCall?.windSustainedMph ?? null;
  const g = wind?.gustMph ?? powderCall?.windGustMph ?? null;
  if (s == null && g == null) return null;
  const hold = powderCall?.windHold || (s ?? 0) >= 45 || (g ?? 0) >= 65;
  const dir = wind?.direction ? ` ${wind.direction}` : '';
  return `${Math.round(s ?? 0)} mph${dir}, gusts ${Math.round(g ?? 0)} mph${hold ? ' (lift holds likely)' : ' (lifts should run)'} est.`;
}

function callGist(pc) {
  if (!pc) return null;
  // Plain label only; internal skill/grade ids stay out of the model's words.
  return { verdict: pc.label, reasons: (pc.reasons || []).slice(0, 2) };
}

function daysGist(days = []) {
  return days.slice(0, 7).map(d => {
    const lo = d.snowCmMin ?? d.snowCm;
    const hi = d.snowCmMax ?? d.snowCm;
    const range = lo != null && hi != null && Math.abs(hi - lo) >= 2.5 ? `${cmToIn(lo)}-${cmToIn(hi)}` : `${cmToIn(d.snowCm ?? 0)}`;
    return [d.date, `${range} in`, d.feel || null, d.slr ? `${d.slr}:1` : null].filter(Boolean).join(' · ');
  });
}

function bestDay(days = []) {
  let best = null;
  for (const d of days) if ((d.snowCm ?? 0) > (best?.snowCm ?? 2.4)) best = d;
  return best ? `${best.date} (~${cmToIn(best.snowCm)} in)` : 'none: under an inch a day in the forecast, so ski what is already down';
}

/** Today's date for the weekend window: the catalog asOf, else the first live day (Open-Meteo starts today). */
function todayOf(d) {
  return d?.asOf || d?.extras?.days?.[0]?.date || null;
}

/**
 * How the chat should word Last 72h. Water-content conversions (SWE x 12) and model
 * numbers are estimates: never "fell". Station snow depth is new snow on the ground.
 */
export function newSnowWords(r = {}) {
  const inches = r.actual72In ?? null;
  if (inches == null) return null;
  const n = Math.round(inches);
  const estimate = r.estimated !== false || /swe|wteq/i.test(String(r.method || ''));
  return estimate ? `about ${n}" of new snow in three days, estimated` : `about ${n}" of new snow in three days`;
}

function resortCore(r = {}) {
  return {
    id: r.id,
    name: r.name,
    where: r.where,
    passes: r.passes || r.pass || [],
    last24In: r.actual24In ?? null,
    last72In: r.actual72In ?? null,
    next7In: r.next7In ?? null,
    observed: r.estimated === false,
    say72: newSnowWords(r),
  };
}

const HONESTY = 'Last 24h/72h are new snow on the ground from snow-depth stations, snow water content, or models, not recorded snowfall. Word it like say72 (e.g. "about 35\" of new snow in three days, estimated"); never say it "fell". Forecasts are model estimates.';

/** One-mountain answers: context first, the call last (agent/instructions.md). */
export const RESORT_ORDER = 'Answer in this order, 3-5 short sentences: what just happened (say72 / stormNow), current conditions (today, base, snowFeel, wind), what is coming (days / bestDay), then the call starting "My take:". Do not open with a verdict.';

/** Phrases the model must never see (it copies them). */
export const BANNED_MODEL_PHRASES = /depth[-_ ]?rise|peak[-_ ]?rise|snwd/i;

/** Scrub internal measurement jargon from strings that reach the model. */
function plain(text) {
  if (text == null) return text;
  return String(text)
    .replace(/snwd[-_ ]?peak[-_ ]?rise/gi, 'new snow at the station')
    .replace(/(station )?snow[-_ ]depth[-_ ]rise/gi, 'new snow at the station')
    .replace(/snwd[-_ ]?(peak[-_ ]?)?rise/gi, 'new snow at the station')
    .replace(/(peak[-_ ]?)?depth[-_ ]?rise/gi, 'new snow at the station')
    .replace(/peak[-_ ]?rise/gi, 'new snow')
    .replace(/snwd[-_ ]?peak/gi, 'station snow depth')
    .replace(/snwd/gi, 'station snow depth');
}

/** Deep-scrub every string in a model view. */
export function scrubView(v) {
  if (typeof v === 'string') return plain(v);
  if (Array.isArray(v)) return v.map(scrubView);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubView(x)]));
  return v;
}

export function resortForModel(out) {
  if (!out?.ok || !out.data) return out?.text || 'not found';
  const d = out.data;
  const spread = d.spread;
  const extraDays = d.extras?.days || [];
  return {
    kind: 'resort',
    ...resortCore(d.resort),
    next7RangeIn: spread ? `${cmToIn(spread.snowCmMin)}-${cmToIn(spread.snowCmMax)}` : null,
    stormNow: d.storm?.text || null,
    snowFeel: d.water?.feel || null,
    stormWaterIn: d.water?.stormWaterIn ?? null,
    stormSlr: d.water?.stormSlr ?? null,
    baseDepthIn: d.water?.snwdIn ?? null,
    wind: windWords(d.wind, d.powderCall),
    snowLevel: snowLevelWords(d.snowLevel, d.powderCall),
    call: callGist(d.powderCall),
    bestDay: bestDay(extraDays.length ? extraDays : d.forecastDays),
    days: daysGist(extraDays.length ? extraDays : d.forecastDays),
    weekend: weekendFromDays(extraDays.length ? extraDays : d.forecastDays, { today: todayOf(d) }),
    regionGist: regionGist(d.snowClimate),
    source: d.resort?.source || d.source,
    asOf: d.asOf,
    howToAnswer: RESORT_ORDER,
    honesty: HONESTY,
  };
}

export function forecastForModel(out) {
  if (!out?.ok || !out.data) return out?.text || 'not found';
  const d = out.data;
  const days = d.extras?.days?.length ? d.extras.days : d.days;
  return {
    kind: 'forecast',
    id: d.id,
    name: d.name,
    total: d.total,
    rangeIn: d.spread ? `${cmToIn(d.spread.snowCmMin)}-${cmToIn(d.spread.snowCmMax)}` : null,
    snowFeel: d.water?.feel || null,
    wind: windWords(d.wind, d.powderCall),
    snowLevel: snowLevelWords(d.snowLevel, d.powderCall),
    call: callGist(d.powderCall),
    bestDay: bestDay(days),
    days: daysGist(days),
    weekend: weekendFromDays(days, { today: todayOf(d) }),
    regionGist: regionGist(d.snowClimate),
    honesty: 'All forecast numbers are model estimates (Open-Meteo / NWS).',
  };
}

export function compareForModel(out) {
  if (!out?.ok || !out.data) return out?.text || 'not found';
  return {
    kind: 'compare',
    rows: (out.data.rows || []).map(r => ({ ...resortCore(r), verdict: r.powderCall?.label || null, region: r.region })),
    honesty: HONESTY,
  };
}

export function rankForModel(out) {
  if (!out?.ok || !out.data) return out?.text || 'not found';
  const d = out.data;
  return {
    kind: 'rank',
    sortLabel: d.sortLabel,
    where: d.where,
    rows: (d.rows || []).slice(0, 8).map(r => {
      const core = resortCore(r);
      if (d.sort !== 'weekend') return core;
      // Weekend ranking: only the Sat + Sun forecast reaches the model, never the 7-day total.
      const { next7In, ...rest } = core;
      return { ...rest, weekendIn: r.weekendIn ?? null };
    }),
    weekendDays: d.sort === 'weekend' ? d.weekendDays || null : undefined,
    // Ready-made ranked pick so open-ended "where?" questions get answered, not bounced.
    pick: d.rows?.[0]?.name || null,
    runnersUp: (d.rows || []).slice(1, 3).map(r => r.name),
    howToAnswer: d.sort === 'weekend'
      ? `Answer now: lead with pick as your call for ${d.weekendDays || 'the weekend'}, quoting weekendIn (forecast for those weekend days only, never a 7-day total), then 1-2 runnersUp. weekendDays never includes today; today's snow is already in last24In. Do not ask which region first.`
      : 'Answer now: lead with pick as your call, then mention 1-2 runnersUp. Do not ask which region first; the app offers region follow-ups.',
    honesty: HONESTY,
  };
}

export function searchForModel(out) {
  if (!out?.ok || !out.data) return out?.text || 'no matches';
  const d = out.data;
  return {
    kind: 'search',
    region: d.region?.name || null,
    resorts: (d.resorts || []).slice(0, 6).map(r => ({
      id: r.id,
      name: r.name,
      where: r.region,
      passes: r.pass || [],
      last72In: r.past72 != null ? r1(r.past72) : null,
      next7In: r.next7 != null ? r1(r.next7) : null,
      observed: r.estimated === false,
    })),
  };
}

export function lookupForModel(out) {
  if (!out?.data) return out?.text || 'not found';
  const d = out.data;
  if (d.lookup === 'catalog') return resortForModel(out);
  if (!d.found) return { kind: 'web-lookup', found: false, query: d.query, note: out.text };
  const days = d.extras?.days || [];
  return {
    kind: 'web-lookup',
    found: true,
    label: 'web lookup (Open-Meteo), not in the SkiScope catalog, all est.',
    name: d.name,
    where: d.where,
    elevationFt: d.elevationM != null ? Math.round(d.elevationM * 3.281) : null,
    next7In: cmToIn(d.next7Cm),
    snowFeel: d.water?.feel || null,
    wind: windWords(d.wind, null),
    snowLevel: snowLevelWords(d.snowLevel, null),
    bestDay: bestDay(days),
    days: daysGist(days),
    regionGist: regionGist(d.snowClimate),
  };
}

export const json = value => ({ type: 'json', value: value == null ? null : scrubView(JSON.parse(JSON.stringify(value))) });

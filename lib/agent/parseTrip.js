/**
 * Deterministic natural-language trip parser.
 *
 * No LLM. Used by /api/agent when Gateway auth is missing, by the browser
 * if the API is down, and by evals/run.mjs.
 *
 * Input: a sentence + gazetteer/resorts + "today".
 * Output: a structured trip guess the UI can apply.
 */
import { addDays, iso } from '../util.js';
import { resortsForRegion, scoreText } from '../search.js';

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const CITIES = {
  denver: { iata: 'DEN', region: 'colorado' },
  colorado: { iata: 'DEN', region: 'colorado' },
  'salt lake': { iata: 'SLC', region: 'utah' },
  slc: { iata: 'SLC', region: 'utah' },
  utah: { iata: 'SLC', region: 'utah' },
  'san diego': { iata: 'SAN' },
  'los angeles': { iata: 'LAX' },
  lax: { iata: 'LAX' },
  tokyo: { iata: 'HND', region: 'japan' },
  sapporo: { iata: 'CTS', region: 'hokkaido' },
  venice: { iata: 'VCE', region: 'dolomites' },
};

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

function upcomingMonthDay(today, month, day) {
  const [ty, tm, td] = today.split('-').map(Number);
  let y = ty;
  if (month < tm || (month === tm && day < td)) y += 1;
  return ymd(y, month, day);
}

function parseDateRange(text, today) {
  const t = text.toLowerCase();

  if (/\bspring break\b/.test(t)) {
    // Next Mar 7–14 — matches Bailey's example phrasing.
    return { from: upcomingMonthDay(today, 3, 7), to: upcomingMonthDay(today, 3, 14), label: 'spring break' };
  }
  if (/\bthis weekend\b/.test(t)) {
    const d = new Date(today + 'T12:00');
    const dow = d.getDay(); // 0 Sun
    const toSat = dow === 0 ? -1 : (6 - dow);
    const sat = addDays(today, toSat);
    const sun = addDays(sat, 1);
    return { from: sat, to: sun, label: 'this weekend' };
  }
  if (/\bnext weekend\b/.test(t)) {
    const d = new Date(today + 'T12:00');
    const dow = d.getDay();
    const toSat = dow === 0 ? 6 : (6 - dow + 7);
    const sat = addDays(today, toSat);
    return { from: sat, to: addDays(sat, 1), label: 'next weekend' };
  }
  if (/\bthis week\b/.test(t)) {
    return { from: today, to: addDays(today, 6), label: 'this week' };
  }
  if (/\bnext week\b/.test(t)) {
    const d = new Date(today + 'T12:00');
    const dow = d.getDay();
    const toMon = dow === 0 ? 1 : (8 - dow);
    const mon = addDays(today, toMon);
    return { from: mon, to: addDays(mon, 6), label: 'next week' };
  }
  if (/\bthis weekend\b/.test(t) === false && /\bweekend\b/.test(t) && !/\bnext\b/.test(t)) {
    const d = new Date(today + 'T12:00');
    const dow = d.getDay();
    const toSat = dow === 0 ? -1 : (6 - dow);
    const sat = addDays(today, toSat);
    return { from: sat, to: addDays(sat, 1), label: 'weekend' };
  }

  const monthOnly = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (monthOnly && !/\d{1,2}/.test(t)) {
    const m = MONTHS[monthOnly[1].toLowerCase()];
    if (m) {
      const from = upcomingMonthDay(today, m, 8);
      return { from, to: upcomingMonthDay(today, m === 12 ? 1 : m + 1, 8), label: monthOnly[1] };
    }
  }

  const isoPair = t.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|through|-|–|—)\s*(\d{4}-\d{2}-\d{2})/);
  if (isoPair) return { from: isoPair[1], to: isoPair[2], label: `${isoPair[1]}–${isoPair[2]}` };

  const md = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|through|-|–|—)\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i);
  if (md) {
    const m1 = MONTHS[md[1].toLowerCase()];
    const d1 = +md[2];
    const m2 = md[3] ? MONTHS[md[3].toLowerCase()] : m1;
    const d2 = +md[4];
    const year = md[5] ? +md[5] : +upcomingMonthDay(today, m1, d1).slice(0, 4);
    let from = ymd(year, m1, d1);
    let to = ymd(m2 < m1 ? year + 1 : year, m2, d2);
    return { from, to, label: `${from}–${to}` };
  }

  return { from: null, to: null, label: null };
}

function parsePeople(text) {
  const t = text.toLowerCase();
  const ak = t.match(/(\d+)\s*adults?\s*(?:and|&|\+)?\s*(\d+)\s*(?:kids?|children|child)/);
  if (ak) return { adults: +ak[1], kids: +ak[2] };
  const ka = t.match(/(\d+)\s*(?:kids?|children)\s*(?:and|&|\+)?\s*(\d+)\s*adults?/);
  if (ka) return { adults: +ka[2], kids: +ka[1] };
  const p = t.match(/\b(?:for|party of|of)?\s*(\d+)\s*(?:people|pax|travelers?)\b/) || t.match(/\bfor\s+(\d+)\b/);
  if (p) {
    const n = Math.min(24, Math.max(1, +p[1]));
    const adults = Math.min(n, 2);
    return { adults, kids: n - adults };
  }
  return { adults: null, kids: null };
}

function parsePass(text) {
  const t = text.toLowerCase();
  if (/\bboth\b/.test(t) && /\bpass/.test(t)) return 'all';
  if (/\bepic\b/.test(t) && /\bikon\b/.test(t)) return 'all';
  if (/\bikon\b/.test(t)) return 'ikon';
  if (/\bepic\b/.test(t)) return 'epic';
  return null;
}

function parseHome(text) {
  const code = text.match(/\b(?:from|home(?:\s+airport)?)\s+([A-Za-z]{3})\b/i);
  if (code) return code[1].toUpperCase();
  const t = text.toLowerCase();
  for (const [name, c] of Object.entries(CITIES)) {
    if (t.includes('from ' + name) || t.includes('home ' + name)) return c.iata;
  }
  return null;
}

function parseNear(text) {
  const t = text.toLowerCase();
  const near = t.match(/\bnear\s+([a-z ]{3,20}?)(?:\s|$|,|\.)/);
  if (!near) return null;
  const name = near[1].trim();
  return CITIES[name] || null;
}

/**
 * @param {string} text
 * @param {{ regions?: any[], resorts?: any[], today?: string }} ctx
 */
export function parseTripSentence(text, ctx = {}) {
  const today = ctx.today || iso(new Date());
  const regions = ctx.regions || [];
  const resorts = ctx.resorts || [];
  const raw = String(text || '').trim();
  const dates = parseDateRange(raw, today);
  const people = parsePeople(raw);
  const pass = parsePass(raw);
  const home = parseHome(raw);
  const near = parseNear(raw);

  const STOP = new Set(['the', 'and', 'for', 'trip', 'from', 'near', 'with', 'this', 'next', 'week', 'weekend', 'spring', 'break', 'best', 'snow', 'pass', 'both', 'adults', 'kids', 'people', 'where', 'what', 'heading', 'right', 'now', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
  const tokens = raw.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
  const regionWords = new Set(regions.flatMap(g => [g.id, g.name, ...(g.aliases || [])]).map(s => String(s).toLowerCase()));

  let region = null;
  let regionScore = 0;
  let exactRank = 0;
  for (const g of regions) {
    const names = [g.id, g.name, ...(g.aliases || [])].map(s => String(s).toLowerCase());
    let rank = 0;
    if (tokens.includes(g.id)) rank = 3;
    else if (tokens.includes(g.name.toLowerCase()) || raw.toLowerCase() === g.name.toLowerCase()) rank = 2;
    else if (names.some(n => n.length >= 3 && tokens.includes(n))) rank = 1;
    if (rank > exactRank) { exactRank = rank; region = g; regionScore = 100; }
  }
  if (!exactRank) {
    for (const g of regions) {
      const needles = [g.name, g.id, ...(g.aliases || [])];
      const s = Math.max(0, ...needles.flatMap(n => [scoreText(raw, n), ...tokens.map(tok => scoreText(n, tok))]));
      if (s > regionScore) { regionScore = s; region = g; }
    }
    if (regionScore < 70) region = near?.region ? regions.find(g => g.id === near.region) || null : null;
  }

  let resort = null;
  let resortScore = 0;
  for (const r of resorts) {
    const distinctive = (r.aliases || []).filter(a => a.length >= 4 && !regionWords.has(a.toLowerCase()));
    const needles = [r.name, r.id, ...distinctive];
    const s = Math.max(0, ...needles.flatMap(n => [scoreText(raw, n), ...tokens.map(tok => scoreText(n, tok))]));
    if (s > resortScore) { resortScore = s; resort = r; }
  }
  if (resortScore < 95) resort = null;
  // A region mention like "Japan … Mar 7-14" must not pick a resort whose
  // alias merely starts with a month token (marmolada ← mar).
  if (resort && region) {
    const blob = raw.toLowerCase();
    const mentioned = [resort.name, resort.id, ...(resort.aliases || [])]
      .some(n => String(n).length >= 4 && blob.includes(String(n).toLowerCase()));
    if (!mentioned) resort = null;
  }

  const mode = /\bplan\b/.test(raw.toLowerCase()) ? 'plan' : (resort ? 'explore' : null);
  const watchlistOnly = /\bwatchlist\b/.test(raw.toLowerCase());
  const sort = /\b(dumping|most snow|best (?:\w+\s+)?snow|top snow|ranked)\b/.test(raw.toLowerCase()) ? 'snow' : null;
  const storms = /\bstorms?\b|\bwinter storm\b|\bstorm track/.test(raw.toLowerCase());
  const low = raw.toLowerCase();
  let metric = 'dump';
  if (/\blast\s*72|past\s*72|recent\b/.test(low)) metric = 'past72';
  else if (/\bnext\s*7|incoming|coming\b/.test(low)) metric = 'next7';
  else if (/\bseason|std|year.?to.?date\b/.test(low)) metric = 'std';
  else if (/\baverage|vs avg|versus\b/.test(low)) metric = 'vsavg';
  else if (sort) metric = 'dump';

  const countryIds = new Set(['japan', 'canada', 'chile', 'china', 'korea', 'andorra', 'switzerland', 'france', 'austria', 'italy', 'australia', 'new-zealand']);
  const stateIds = new Set(['california', 'utah', 'colorado', 'tahoe']);
  let type = 'ranking';
  if (/\bcompare\b|\bvs\.?\b/.test(low) && !resort) type = 'compare';
  else if (resort && (dates.from || /\bapril\b|\bspring break\b|\btrip\b/.test(low))) type = 'trip';
  else if (resort) type = 'resort';
  else if (sort || /\btop\b|\branked\b|\bbest snow\b/.test(low)) type = 'ranking';
  else if (region && countryIds.has(region.id)) type = 'country';
  else if (region && stateIds.has(region.id)) type = 'state';
  else if (region) type = 'region';

  return {
    q: raw,
    type,
    metric,
    region: region ? { id: region.id, name: region.name } : null,
    resort: resort ? { id: resort.id, name: resort.name } : null,
    pass,
    from: dates.from,
    to: dates.to,
    dateLabel: dates.label,
    adults: people.adults,
    kids: people.kids,
    people: people.adults != null ? people.adults + people.kids : null,
    home: home || (near && /from |home /.test(raw.toLowerCase()) ? near.iata : null),
    near: near ? { iata: near.iata, region: near.region || null } : null,
    sort,
    watchlistOnly,
    mode,
    storms,
  };
}

/** Turn a parse result + catalog into UI actions the front end already understands. */
export function parsedToActions(parsed, ctx = {}) {
  const actions = [];
  const trip = {};
  if (parsed.from) trip.start = parsed.from;
  if (parsed.to) trip.end = parsed.to;
  if (parsed.adults != null) trip.adults = parsed.adults;
  if (parsed.kids != null) trip.kids = parsed.kids;
  if (parsed.home) trip.home = parsed.home;
  if (parsed.pass) trip.pass = parsed.pass;
  if (Object.keys(trip).length) actions.push({ type: 'setTrip', trip });
  if (parsed.storms) actions.push({ type: 'setStorms', on: true });

  const resorts = ctx.resorts || [];
  const regions = ctx.regions || [];
  const pass = parsed.pass || ctx.pass || 'ikon';
  const passOK = r => pass === 'all' || (r.passes || []).includes(pass);

  if (parsed.resort) {
    actions.push({ type: 'showResorts', ids: [parsed.resort.id], title: parsed.resort.name });
    if (parsed.type !== 'trip') {
      actions.push({ type: 'openResort', id: parsed.resort.id, mode: parsed.mode || 'explore' });
    }
    return actions;
  }

  if (parsed.region) {
    const g = regions.find(x => x.id === parsed.region.id);
    const ids = g ? resortsForRegion(g, resorts, passOK).map(r => r.id) : [];
    actions.push({ type: 'showResorts', ids, title: parsed.region.name });
    return actions;
  }

  if (parsed.near?.region) {
    const g = regions.find(x => x.id === parsed.near.region);
    if (g) {
      actions.push({ type: 'flyTo', kind: 'region', id: g.id });
      actions.push({ type: 'showResorts', ids: resortsForRegion(g, resorts, passOK).map(r => r.id), title: g.name });
    }
  }
  if (parsed.sort) actions.push({ type: 'setSort', sort: parsed.sort });
  if (parsed.watchlistOnly) actions.push({ type: 'setWatchOnly', on: true });
  return actions;
}

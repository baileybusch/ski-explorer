/**
 * Pure storm-alert evaluator. No I/O, no email, no Blob.
 *
 * evaluateAlerts(rules, snowJson, now) → { alerts, queued }
 *
 * snowJson is the committed snapshot plus optional catalog:
 *   { dates, today, resorts: { id: { sf[] } }, index?: Resort[], regions?: Region[] }
 *
 * Dedupe key: {ruleId}|{resortId}|{pulseStart}|{stormTier}
 * Quiet hours queue instead of send. One send per rule per 12 hours.
 */
import { regionMatchesResort } from './search.js';
import { dumpParts } from './dumpScore.js';
import { DEFAULT_ALERT_MIN_SNOW_IN, DEFAULT_ALERT_WINDOW_HOURS } from './alertDefaults.js';
import { executeTool } from './skiscope-tools/index.js';
import { migrateRule, nextTripStage, consolidateAlerts } from './subscriptions.js';

export const INCH = 2.54;
export const DEFAULT_QUIET = { start: '21:00', end: '07:00', tz: 'America/Los_Angeles' };
export const DEFAULT_RECAP = { weekday: 0, hour: 19, tz: 'America/Los_Angeles' }; // Sunday evening PT
export const STORM_TIERS = [6, 12, 18];
export const WINDOW_HOURS = [24, 48, 72, 168];
export const TWELVE_HOURS_MS = 12 * 3600 * 1000;

export function cmToIn(cm) {
  return (Number(cm) || 0) / INCH;
}

export function stormTierOf(inches) {
  const n = Number(inches) || 0;
  if (n >= 18) return 18;
  if (n >= 12) return 12;
  if (n >= 6) return 6;
  return 0;
}

export function windowDays(windowHours) {
  const h = Number(windowHours) || 72;
  if (h <= 24) return 1;
  if (h <= 48) return 2;
  if (h <= 72) return 3;
  return 7;
}

export function normalizeRule(input = {}, email) {
  const migrated = migrateRule(input);
  const minSnowIn = STORM_TIERS.includes(+migrated.minSnowIn) ? +migrated.minSnowIn : DEFAULT_ALERT_MIN_SNOW_IN;
  const windowHours = WINDOW_HOURS.includes(+migrated.windowHours) ? +migrated.windowHours : DEFAULT_ALERT_WINDOW_HOURS;
  const pass = ['ikon', 'epic', 'both', 'all'].includes(migrated.pass) ? migrated.pass : (migrated.pass || null);
  const watch = ['resort', 'saved', 'region', 'pass'].includes(migrated.watch) ? migrated.watch : null;
  return {
    id: migrated.id || input.id || null,
    email: (email || migrated.email || '').toLowerCase().trim(),
    status: migrated.status || 'active',
    kind: migrated.kind || 'snow',
    type: migrated.type || 'resort',
    watch: watch || (migrated.resorts?.length ? 'resort' : migrated.region ? 'region' : 'pass'),
    resorts: Array.isArray(migrated.resorts) ? migrated.resorts.filter(Boolean).slice(0, 30) : [],
    savedResorts: Array.isArray(migrated.savedResorts) ? migrated.savedResorts.filter(Boolean).slice(0, 30) : [],
    region: migrated.region || null,
    regionScope: migrated.regionScope || 'all',
    tripStart: migrated.tripStart || null,
    tripEnd: migrated.tripEnd || null,
    adults: migrated.adults ?? 2,
    kids: migrated.kids ?? 0,
    tripStagesSent: Array.isArray(migrated.tripStagesSent) ? migrated.tripStagesSent : [],
    pass: pass === 'all' ? 'both' : pass,
    minSnowIn,
    windowHours,
    side: migrated.side || 'forecast',
    units: 'in',
    freq: migrated.freq || 'on-trigger',
    quiet: { ...DEFAULT_QUIET, ...(migrated.quiet || {}) },
    recap: { ...DEFAULT_RECAP, ...(input.recap && typeof input.recap === 'object' ? input.recap : {}) },
    lastFired: migrated.lastFired || null,
    lastKey: migrated.lastKey || null,
    lastKeys: Array.isArray(migrated.lastKeys) ? migrated.lastKeys : (migrated.lastKey ? [migrated.lastKey] : []),
    pendingSend: migrated.pendingSend || null,
    tier: migrated.tier === 'paid' ? 'paid' : 'free',
    paused: !!migrated.paused,
  };
}

function toolCatalog(snowJson) {
  return {
    resorts: snowJson.index || snowJson.resortsList || [],
    snow: snowJson,
    regions: snowJson.regions || [],
    typical: snowJson.typical || { windows: {} },
    history: snowJson.history || { resorts: {} },
  };
}

export function dedupeKey(ruleId, resortId, pulseStart, stormTier) {
  return `${ruleId || 'rul'}|${resortId}|${pulseStart || 'none'}|${stormTier || 0}`;
}

export function localParts(now, tz = 'America/Los_Angeles') {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now instanceof Date ? now : new Date(now)).map(p => [p.type, p.value]));
  return { weekday: parts.weekday, hour: Number(parts.hour), minute: Number(parts.minute), hhmm: `${parts.hour}:${parts.minute}` };
}

export function inQuietHours(now, quiet = DEFAULT_QUIET) {
  const q = { ...DEFAULT_QUIET, ...quiet };
  const { hhmm } = localParts(now, q.tz);
  const start = q.start || DEFAULT_QUIET.start;
  const end = q.end || DEFAULT_QUIET.end;
  if (start <= end) return hhmm >= start && hhmm < end;
  return hhmm >= start || hhmm < end;
}

/** Sunday evening by default; ±2h so a daily Hobby cron still hits it. */
export function shouldSendRecap(now, pref = DEFAULT_RECAP) {
  const p = { ...DEFAULT_RECAP, ...pref };
  const { weekday, hour } = localParts(now, p.tz);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const want = p.weekday ?? DEFAULT_RECAP.weekday;
  const targetHour = p.hour ?? DEFAULT_RECAP.hour;
  return map[weekday] === want && Math.abs(hour - targetHour) <= 2;
}

function catalogOf(snowJson) {
  return {
    index: snowJson.index || snowJson.catalog || [],
    regions: snowJson.regions || [],
  };
}

export function resortMeta(id, snowJson) {
  const fromIndex = (snowJson.index || snowJson.catalog || []).find(r => r.id === id) || {};
  const rec = snowJson.resorts?.[id] || {};
  return { id, name: fromIndex.name || rec.name || id, ...fromIndex, ...rec };
}

export function passOK(r, pass) {
  if (!pass || pass === 'both' || pass === 'all') return true;
  const passes = r.passes || [];
  if (pass === 'ikon') return !!(r.ikon || passes.includes('ikon'));
  if (pass === 'epic') return !!(r.epic || passes.includes('epic'));
  return true;
}

export function resolveWatch(rule, snowJson) {
  const { index, regions } = catalogOf(snowJson);
  const list = index.length
    ? index
    : Object.keys(snowJson.resorts || {}).map(id => resortMeta(id, snowJson));
  const watch = rule.watch || (rule.resorts?.length ? 'resort' : rule.region ? 'region' : 'pass');
  if (watch === 'resort') {
    const ids = new Set(rule.resorts || []);
    return list.filter(r => ids.has(r.id));
  }
  if (watch === 'saved') {
    const ids = new Set(rule.savedResorts?.length ? rule.savedResorts : (rule.resorts || []));
    return list.filter(r => ids.has(r.id));
  }
  if (watch === 'region' && rule.region) {
    const g = regions.find(x => x.id === rule.region);
    if (g) return list.filter(r => passOK(r, rule.pass) && regionMatchesResort(g, r));
    const needle = String(rule.region).toLowerCase();
    return list.filter(r => passOK(r, rule.pass) && (
      String(r.region || '').toLowerCase() === needle
      || String(r.country || '').toLowerCase() === needle
      || r.id === rule.region
    ));
  }
  return list.filter(r => passOK(r, rule.pass || 'both'));
}

/** Best rolling forecast window + pulse start (gap ≥1 day under 1″ starts a new pulse). */
export function forecastWindow(id, snowJson, windowHours = 72) {
  const rec = snowJson.resorts?.[id] || {};
  const sf = rec.sf || [];
  const dates = snowJson.dates || [];
  const today = snowJson.today ?? 0;
  const days = windowDays(windowHours);
  const slice = [];
  for (let i = today + 1; i < sf.length && i < dates.length; i++) {
    slice.push({ i, date: dates[i], cm: sf[i] || 0 });
  }
  let best = 0, bestAt = 0;
  for (let i = 0; i < slice.length; i++) {
    const win = slice.slice(i, i + days).reduce((a, d) => a + d.cm, 0);
    if (win > best) { best = win; bestAt = i; }
  }
  const totalCm = slice.reduce((a, d) => a + d.cm, 0);
  let pulseAt = bestAt;
  while (pulseAt > 0 && slice[pulseAt - 1].cm >= INCH) pulseAt--;
  const snowIn = cmToIn(best);
  const endAt = Math.min(bestAt + days - 1, Math.max(0, slice.length - 1));
  const startDay = slice.find(d => d.cm >= INCH)?.date || slice[bestAt]?.date || null;
  return {
    snowIn,
    totalIn: cmToIn(totalCm),
    stormTier: stormTierOf(snowIn),
    pulseStart: slice[pulseAt]?.date || slice[bestAt]?.date || null,
    windowStart: slice[bestAt]?.date || null,
    windowEnd: slice[endAt]?.date || null,
    startDay,
    byDate: slice[endAt]?.date || null,
    strip: slice.slice(0, 7).map(d => ({ date: d.date, in: cmToIn(d.cm), cm: d.cm })),
  };
}

export function rankRecap(snowJson, { limit = 5 } = {}) {
  const dates = snowJson.dates || [];
  const today = snowJson.today ?? 0;
  const rows = [];
  for (const id of Object.keys(snowJson.resorts || {})) {
    const rec = snowJson.resorts[id];
    const sf = rec.sf || [];
    let recentCm = 0, incomingCm = 0, past72Cm = 0;
    for (let i = Math.max(0, today - 6); i <= today && i < sf.length; i++) recentCm += sf[i] || 0;
    for (let i = Math.max(0, today - 2); i <= today && i < sf.length; i++) past72Cm += sf[i] || 0;
    for (let i = today + 1; i < sf.length && i <= today + 7; i++) incomingCm += sf[i] || 0;
    const meta = resortMeta(id, snowJson);
    rows.push({
      id,
      name: meta.name,
      region: meta.region || meta.state,
      recentCm,
      incomingCm,
      past72Cm,
      recentIn: cmToIn(recentCm),
      incomingIn: cmToIn(incomingCm),
      past72In: cmToIn(past72Cm),
      strip: (dates.slice(today + 1, today + 8)).map((date, k) => ({
        date, in: cmToIn(sf[today + 1 + k] || 0), cm: sf[today + 1 + k] || 0,
      })),
    });
  }
  return {
    recent: [...rows].sort((a, b) => b.recentCm - a.recentCm).slice(0, limit),
    incoming: [...rows].sort((a, b) => b.incomingCm - a.incomingCm).slice(0, limit),
  };
}

function priorKeys(rule) {
  return new Set([...(rule.lastKeys || []), rule.lastKey].filter(Boolean));
}

function withinTwelveHours(rule, now) {
  if (!rule.lastFired) return false;
  const t = new Date(rule.lastFired).getTime();
  if (!Number.isFinite(t)) return false;
  const elapsed = now.getTime() - t;
  return elapsed >= 0 && elapsed < TWELVE_HOURS_MS;
}

function shortName(name) {
  return String(name || '').split(' (')[0];
}

function weekdayShort(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function evaluateAlerts(rules, snowJson, now = new Date()) {
  const when = now instanceof Date ? now : new Date(now);
  const cat = toolCatalog(snowJson);
  const alerts = [];
  const queued = [];
  for (const raw of rules || []) {
    const rule = normalizeRule(raw);
    if (!rule.id) rule.id = raw.id || `rul_${rule.email || 'anon'}`;
    if (rule.status && rule.status !== 'active') continue;
    if (rule.kind && rule.kind !== 'snow') continue;
    if (rule.paused) continue;
    if (withinTwelveHours(rule, when)) continue;

    let item = null;
    if (rule.type === 'trip') {
      item = evaluateTrip(rule, cat, when);
    } else if (rule.type === 'region') {
      item = evaluateRegion(rule, cat, snowJson);
    } else {
      item = evaluateResortStorm(rule, snowJson);
    }
    if (!item) continue;
    if (inQuietHours(when, rule.quiet)) queued.push(item);
    else alerts.push(item);
  }
  return { alerts, queued, consolidated: consolidateAlerts([...alerts]) };
}

function evaluateResortStorm(rule, snowJson) {
  const watched = resolveWatch(rule, snowJson);
  const seen = priorKeys(rule);
  const hits = [];
  const newKeys = [];
  for (const r of watched) {
    const metric = forecastWindow(r.id, snowJson, rule.windowHours);
    if (metric.snowIn + 1e-9 < rule.minSnowIn) continue;
    const parts = dumpParts(r, snowJson);
    const facts = executeTool('get_resort_snow', { resort: r.id, units: 'in' }, toolCatalog(snowJson));
    const key = dedupeKey(rule.id, r.id, metric.pulseStart, metric.stormTier);
    const row = {
      resortId: r.id,
      resortName: r.name || r.id,
      snowIn: metric.snowIn,
      past72In: facts.data?.past72 ?? parts.past72In,
      next7In: facts.data?.next7 ?? parts.next7In,
      totalIn: metric.totalIn,
      stormTier: metric.stormTier,
      pulseStart: metric.pulseStart,
      windowStart: metric.windowStart,
      windowEnd: metric.windowEnd,
      startDay: metric.startDay,
      byDate: metric.byDate,
      strip: metric.strip,
      key,
      fresh: !seen.has(key),
    };
    hits.push(row);
    if (row.fresh) newKeys.push(key);
  }
  if (!hits.length || !newKeys.length) return null;
  hits.sort((a, b) => b.snowIn - a.snowIn);
  const lead = hits[0];
  const inches = Math.round(lead.snowIn);
  const by = weekdayShort(lead.byDate || lead.startDay);
  return {
    ruleId: rule.id,
    email: rule.email,
    type: 'resort',
    event: 'storm',
    tier: rule.tier,
    watch: rule.watch,
    minSnowIn: rule.minSnowIn,
    windowHours: rule.windowHours,
    keys: newKeys,
    key: newKeys[0],
    lead,
    affected: hits,
    headline: `${shortName(lead.resortName)} just got ${lead.past72In ? Math.round(lead.past72In) + '"' : 'snow'}`,
    subject: `Situation detected: ${shortName(lead.resortName)} +${inches}" forecast${by ? ` by ${by}` : ''}`,
  };
}

function evaluateRegion(rule, cat, snowJson) {
  const board = executeTool('get_leaderboard', {
    region: rule.region, pass: rule.pass === 'both' ? 'all' : rule.pass,
    metric: 'next7', limit: 8, units: 'in',
  }, { ...cat, resorts: cat.resorts.length ? cat.resorts : (snowJson.index || []) });
  let rows = board.data?.rows || [];
  if (rule.regionScope === 'subset' && rule.resorts?.length) {
    const allow = new Set(rule.resorts);
    rows = rows.filter(r => allow.has(r.id));
  }
  const hot = rows.filter(r => r.next7 + 1e-9 >= rule.minSnowIn || r.past72 >= 2);
  if (!hot.length) return null;
  const seen = priorKeys(rule);
  const pulse = (snowJson.dates || [])[(snowJson.today || 0) + 1] || 'region';
  const key = dedupeKey(rule.id, rule.region || rule.pass || 'region', pulse, 0);
  if (seen.has(key)) return null;
  const affected = hot.map(r => ({
    resortId: r.id, resortName: r.name, snowIn: r.next7, past72In: r.past72, next7In: r.next7, region: r.region,
  }));
  const where = board.data?.where || rule.region || 'the region';
  return {
    ruleId: rule.id,
    email: rule.email,
    type: 'region',
    event: 'leaderboard',
    region: rule.region,
    watch: rule.watch,
    keys: [key],
    key,
    lead: affected[0],
    affected,
    facts: board.data,
    headline: `${where} leaderboard`,
    subject: `Situation detected in ${where}`,
  };
}

function evaluateTrip(rule, cat, when) {
  const stage = nextTripStage(rule.tripStart, rule.tripStagesSent, when);
  if (stage == null) return null;
  const id = (rule.resorts || [])[0];
  if (!id) return null;
  const snap = executeTool('plan_trip_snapshot', { resort: id, start: rule.tripStart, end: rule.tripEnd, units: 'in' }, cat);
  const key = dedupeKey(rule.id, id, `t${stage}`, 0);
  return {
    ruleId: rule.id,
    email: rule.email,
    type: 'trip',
    event: 'countdown',
    stage,
    resortId: id,
    tripStart: rule.tripStart,
    tripEnd: rule.tripEnd,
    keys: [key],
    key,
    lead: { resortId: id, resortName: snap.data?.resort?.name, past72In: snap.data?.resort?.past72, snowIn: snap.data?.resort?.next7 },
    affected: [{ resortId: id, resortName: snap.data?.resort?.name, past72In: snap.data?.resort?.past72, snowIn: snap.data?.resort?.next7 }],
    facts: snap.data,
    headline: `${snap.data?.resort?.name || id} T-${stage}`,
    subject: `Situation detected: ${snap.data?.resort?.name || id} T-${stage}`,
  };
}

export { consolidateAlerts };

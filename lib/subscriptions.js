/**
 * Alert subscriptions v2: resort | region | trip.
 * One email can hold many; sends consolidate per window.
 */
import { DEFAULT_ALERT_MIN_SNOW_IN, DEFAULT_ALERT_WINDOW_HOURS } from './alertDefaults.js';

export const SUB_TYPES = ['resort', 'region', 'trip'];
export const TRIP_CADENCE = [14, 7, 3, 1, 0];

export function migrateRule(input = {}) {
  const type = SUB_TYPES.includes(input.type)
    ? input.type
    : input.tripStart || input.start
      ? 'trip'
      : (input.watch === 'region' || input.watch === 'pass' || input.region)
        ? 'region'
        : 'resort';
  return {
    ...input,
    type,
    watch: type === 'region' ? (input.watch === 'pass' ? 'pass' : 'region') : 'resort',
    resorts: Array.isArray(input.resorts) ? input.resorts.filter(Boolean).slice(0, 40) : [],
    region: input.region || null,
    regionScope: input.regionScope === 'subset' ? 'subset' : 'all',
    tripStart: input.tripStart || input.start || null,
    tripEnd: input.tripEnd || input.end || null,
    adults: input.adults ?? 2,
    kids: input.kids ?? 0,
    minSnowIn: input.minSnowIn || DEFAULT_ALERT_MIN_SNOW_IN,
    windowHours: input.windowHours || DEFAULT_ALERT_WINDOW_HOURS,
    paused: !!input.paused,
  };
}

export function tripStage(start, now = new Date()) {
  if (!start) return null;
  const [y, m, d] = String(start).split('-').map(Number);
  if (!y || !m || !d) return null;
  const t0 = Date.UTC(y, m - 1, d);
  const n = now instanceof Date ? now : new Date(now);
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((t0 - today) / 86400000);
}

export function nextTripStage(start, sent = [], now = new Date()) {
  const days = tripStage(start, now);
  if (days == null || days < 0) return null;
  if (TRIP_CADENCE.includes(days) && !sent.includes(days)) return days;
  return null;
}

/** Combine per-subscriber events into one send. */
export function consolidateAlerts(items = []) {
  const by = new Map();
  for (const item of items) {
    const k = (item.email || 'anon').toLowerCase();
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(item);
  }
  return [...by.entries()].map(([email, events]) => {
    const bits = events.map(e => e.headline || e.subject || 'update');
    const subject = events.length === 1
      ? (events[0].subject || `Situation detected: ${bits[0]}`)
      : `Situation detected: ${bits.slice(0, 3).join(' + ')}`;
    return { email, events, subject, keys: events.flatMap(e => e.keys || [e.key]).filter(Boolean) };
  });
}

export function ruleLabel(rule, names = []) {
  const r = migrateRule(rule);
  if (r.type === 'trip') {
    const who = (r.resorts || []).map(id => names.find(n => n.id === id)?.name || id).join(', ') || 'a trip';
    return `Trip · ${who}${r.tripStart ? ` ${r.tripStart}` : ''}`;
  }
  if (r.type === 'region') {
    return `Region · ${r.region || r.pass || 'worldwide'}${r.regionScope === 'subset' ? ' (subset)' : ''}`;
  }
  const who = (r.resorts || []).map(id => names.find(n => n.id === id)?.name || id).join(', ') || 'a resort';
  return `Resort · ${who}`;
}

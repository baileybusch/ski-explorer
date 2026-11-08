/**
 * Welcome series after double opt-in:
 *   W1 at confirm   welcome, what this is, your mountains with actual + forecast snow
 *   W2 day 2        how alerts work + how to use Ask
 *   W3 day 5        add mountains / regions + share with friends
 * Then storm alerts per subscription and the weekly recap (api/cron/alerts.js).
 * Progress lives on the subscriber record (sub.welcome.sent[step] = ISO time). Sending is gated
 * by EMAIL_ALERTS_ENABLED like every other email; this module only decides what is due.
 */
import { rankRecap, resolveWatch } from './evaluateAlerts.js';

export const WELCOME_STEPS = [
  { id: 'w1', day: 0, label: 'Welcome' },
  { id: 'w2', day: 2, label: 'How alerts work + Ask' },
  { id: 'w3', day: 5, label: 'Add mountains + share' },
];

/** Past this age a missed step is skipped rather than sent late. */
const STALE_DAYS = 10;

export function welcomeDue(sub, now = Date.now()) {
  if (!sub || sub.status !== 'active' || !sub.confirmed) return null;
  if (sub.prefs?.stormAlerts === false && sub.prefs?.recap === false) return null;
  const start = Date.parse(sub.confirmed);
  if (!Number.isFinite(start)) return null;
  const sent = sub.welcome?.sent || {};
  const ageDays = (now - start) / 864e5;
  for (const step of WELCOME_STEPS) {
    if (sent[step.id]) continue;
    if (ageDays < step.day) return null;
    if (ageDays > step.day + STALE_DAYS) continue;
    return step.id;
  }
  return null;
}

export function markWelcome(sub, step, now = Date.now()) {
  sub.welcome = { ...(sub.welcome || {}), sent: { ...(sub.welcome?.sent || {}), [step]: new Date(now).toISOString() } };
  return sub;
}

/**
 * The subscriber's mountains with actual (72h) and forecast (7d) snow for W1.
 * Resort rules list their resorts; region / pass rules show the region's top 3 right now.
 */
export function welcomeRows(sub, snowJson, { limit = 6 } = {}) {
  const all = rankRecap(snowJson, { limit: Infinity }).incoming;
  const byId = new Map(all.map(r => [r.id, r]));
  const out = [];
  const seen = new Set();
  const push = (row, group) => {
    if (!row || seen.has(row.id) || out.length >= limit) return;
    seen.add(row.id);
    out.push({ ...row, group });
  };
  const rules = sub?.rules?.length ? sub.rules : [{ watch: 'resort', resorts: sub?.resorts || [] }];
  for (const rule of rules) {
    if (rule.paused) continue;
    if ((rule.watch === 'resort' || rule.watch === 'saved' || rule.type === 'trip') && rule.resorts?.length) {
      rule.resorts.forEach(id => push(byId.get(id), null));
      continue;
    }
    const group = (snowJson.regions || []).find(g => g.id === rule.region)?.name
      || (rule.pass && rule.pass !== 'both' ? `${rule.pass[0].toUpperCase()}${rule.pass.slice(1)} resorts` : 'All resorts');
    resolveWatch(rule, snowJson)
      .map(r => byId.get(r.id))
      .filter(Boolean)
      .sort((a, b) => (b.past72Cm + b.incomingCm) - (a.past72Cm + a.incomingCm))
      .slice(0, 3)
      .forEach(row => push(row, group));
  }
  return out;
}

/** What W1–W3 call the subscription in subject lines: "Alta", "Utah", "Alta + 2 more". */
export function watchLabel(sub, snowJson) {
  const names = [];
  for (const rule of sub?.rules || []) {
    if (rule.region) names.push((snowJson.regions || []).find(g => g.id === rule.region)?.name || rule.region);
    else for (const id of rule.resorts || []) names.push(resolveName(id, snowJson));
  }
  if (!names.length) for (const id of sub?.resorts || []) names.push(resolveName(id, snowJson));
  const uniq = [...new Set(names.filter(Boolean))];
  if (!uniq.length) return 'your mountains';
  return uniq.length === 1 ? uniq[0] : `${uniq[0]} + ${uniq.length - 1} more`;
}

function resolveName(id, snowJson) {
  return (snowJson.index || []).find(r => r.id === id)?.name?.split(' (')[0] || null;
}

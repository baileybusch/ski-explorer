/**
 * Funnel insights: what people ask and what they sign up for.
 * Pure functions only (schema, inference, aggregation, CSV, demo seed). Storage is in
 * lib/insightsStore.js; the admin dashboard and CSV exports read through buildDashboard.
 */
import { mentionedResorts } from './ask/answer.js';
import { MONTH_NAMES } from './skiscope-tools/askTools.js';

export const EVENT_TYPES = ['chat', 'signup', 'link', 'dns', 'offer', 'unsubscribe'];
export const SOURCE_BUCKETS = ['home', 'resort', 'region', 'chat', 'other'];
const OFFER_ACTIONS = new Set(['shown', 'accepted', 'dismissed']);

const ID_RE = /^[a-z0-9-]{2,40}$/;
const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Signup source → dashboard bucket. Pass pages count with region pages (both are category pages). */
export function sourceBucket(source = '') {
  const s = String(source || '').toLowerCase();
  if (s === 'home' || s === 'signup') return 'home';
  if (s === 'resort') return 'resort';
  if (s === 'region' || s === 'pass') return 'region';
  if (s === 'chat') return 'chat';
  return 'other';
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const ids = (xs, max) => [...new Set((Array.isArray(xs) ? xs : []).filter(x => typeof x === 'string' && ID_RE.test(x)))].slice(0, max);
const email = e => (typeof e === 'string' && e.length < 200 && EMAIL_RE.test(e.trim()) ? e.trim().toLowerCase() : null);

/** Resorts, regions and calendar months a question is about. */
export function inferInterests(text, cat = {}) {
  const blob = ` ${norm(text)} `;
  const resorts = mentionedResorts(text, cat).map(r => r.id).slice(0, 4);
  const regions = [];
  for (const g of cat.regions || []) {
    const needles = [g.id.replace(/-/g, ' '), g.name, ...(g.aliases || [])].map(norm).filter(n => n.length >= 3);
    if (needles.some(n => blob.includes(` ${n} `))) regions.push(g.id);
  }
  const months = [];
  MONTH_NAMES.forEach((name, i) => {
    const full = name.toLowerCase();
    if (blob.includes(` ${full} `) || (full !== 'may' && blob.includes(` ${full.slice(0, 3)} `))) months.push(i + 1);
  });
  return { resorts, regions: regions.slice(0, 3), months: months.slice(0, 3) };
}

/** Normalize one event. Returns null for anything malformed; never keeps unknown fields. */
export function cleanEvent(raw = {}, { now = Date.now(), env = 'development' } = {}) {
  const type = EVENT_TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return null;
  const at = Number.isFinite(Date.parse(raw.at)) && raw.trusted ? new Date(raw.at).toISOString() : new Date(now).toISOString();
  const base = {
    id: typeof raw.id === 'string' && /^[a-z0-9]{6,24}$/.test(raw.id) ? raw.id : Math.random().toString(36).slice(2, 12),
    type,
    at,
    env: String(raw.env || env).slice(0, 16),
    sid: typeof raw.sid === 'string' && SID_RE.test(raw.sid) ? raw.sid : null,
    email: email(raw.email),
  };
  if (raw.demo === true) base.demo = true;
  if (type === 'chat') {
    const q = String(raw.q || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!q) return null;
    return { ...base, q, resorts: ids(raw.resorts, 4), regions: ids(raw.regions, 3), months: (raw.months || []).filter(m => Number.isInteger(m) && m >= 1 && m <= 12).slice(0, 3), mode: raw.mode === 'llm' ? 'llm' : 'fallback' };
  }
  if (type === 'signup') {
    if (!base.email) return null;
    const kind = ['resort', 'region', 'trip'].includes(raw.kind) ? raw.kind : (raw.region ? 'region' : 'resort');
    return {
      ...base,
      source: String(raw.source || 'other').slice(0, 20),
      bucket: sourceBucket(raw.source),
      kind,
      resorts: ids(raw.resorts, 30),
      region: typeof raw.region === 'string' && ID_RE.test(raw.region) ? raw.region : null,
      consentVersion: typeof raw.consentVersion === 'string' ? raw.consentVersion.slice(0, 24) : null,
      preview: raw.preview === true,
    };
  }
  if (type === 'link') return base.sid && base.email ? base : null;
  if (type === 'dns') return base.sid || base.email ? { ...base, optOut: raw.optOut !== false } : null;
  if (type === 'offer') {
    if (!OFFER_ACTIONS.has(raw.action)) return null;
    const t = raw.target || {};
    return { ...base, action: raw.action, target: { type: t.type === 'region' ? 'region' : 'resort', id: ID_RE.test(t.id || '') ? t.id : null } };
  }
  if (type === 'unsubscribe') return base.email ? base : null;
  return null;
}

function bump(map, key, n = 1) {
  if (key == null || key === '') return;
  map.set(key, (map.get(key) || 0) + n);
}

const top = (map, n = 10) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n).map(([id, count]) => ({ id, count }));

export function questionKey(q) {
  return norm(q).replace(/\b(the|a|an|right|now|please|is|are|what|which|whats)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Everything /admin shows, from raw events. Sessions are linked to an email by any event that
 * carries both (link, signup, signed-in chat), so questions asked before signup join the profile.
 * Do Not Sell is the latest dns event per email or session (an email inherits its sessions' opt-out).
 */
export function buildDashboard(events = [], { now = Date.now(), days = 30, names = {} } = {}) {
  const sorted = [...events].filter(Boolean).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const sidEmail = new Map();
  for (const e of sorted) if (e.sid && e.email) sidEmail.set(e.sid, e.email);
  const who = e => e.email || (e.sid && sidEmail.get(e.sid)) || null;

  const dnsBySid = new Map();
  const dnsByEmail = new Map();
  for (const e of sorted.filter(x => x.type === 'dns')) {
    if (e.sid) dnsBySid.set(e.sid, e.optOut);
    const em = who(e);
    if (em) dnsByEmail.set(em, e.optOut);
  }
  for (const [sid, opt] of dnsBySid) {
    const em = sidEmail.get(sid);
    if (em && !dnsByEmail.has(em)) dnsByEmail.set(em, opt);
  }

  const startDay = new Date(now - (days - 1) * 864e5).toISOString().slice(0, 10);
  const byDay = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
    byDay.set(d, Object.fromEntries(SOURCE_BUCKETS.map(b => [b, 0])));
  }

  const subs = new Map();
  const subResorts = new Map();
  const subRegions = new Map();
  const askedResorts = new Map();
  const askedRegions = new Map();
  const askedMonths = new Map();
  const questions = new Map();
  const questionText = new Map();
  const sessions = new Set();
  const offers = { shown: 0, accepted: 0, dismissed: 0 };
  let chats = 0;
  let signups = 0;

  const profile = em => {
    if (!subs.has(em)) subs.set(em, { email: em, firstSource: null, signedUpAt: null, watching: { resorts: new Set(), regions: new Set() }, asked: { resorts: new Map(), regions: new Map(), months: new Map() }, questions: 0, lastQuestion: null, demo: false });
    return subs.get(em);
  };

  for (const e of sorted) {
    if (e.sid) sessions.add(e.sid);
    if (e.type === 'signup') {
      signups++;
      const p = profile(e.email);
      if (!p.signedUpAt) { p.signedUpAt = e.at; p.firstSource = e.bucket || sourceBucket(e.source); }
      if (e.demo) p.demo = true;
      e.resorts.forEach(r => { p.watching.resorts.add(r); });
      if (e.region) p.watching.regions.add(e.region);
      const d = e.at.slice(0, 10);
      if (d >= startDay && byDay.has(d)) byDay.get(d)[e.bucket || sourceBucket(e.source)]++;
    }
    if (e.type === 'chat') {
      chats++;
      const k = questionKey(e.q);
      bump(questions, k);
      if (!questionText.has(k)) questionText.set(k, e.q);
      e.resorts.forEach(r => bump(askedResorts, r));
      e.regions.forEach(r => bump(askedRegions, r));
      e.months.forEach(m => bump(askedMonths, m));
    }
    if (e.type === 'offer' && offers[e.action] != null) offers[e.action]++;
  }

  for (const e of sorted.filter(x => x.type === 'chat')) {
    const em = who(e);
    if (!em || !subs.has(em)) continue;
    const p = subs.get(em);
    p.questions++;
    p.lastQuestion = e.q;
    e.resorts.forEach(r => bump(p.asked.resorts, r));
    e.regions.forEach(r => bump(p.asked.regions, r));
    e.months.forEach(m => bump(p.asked.months, m));
  }

  for (const p of subs.values()) {
    p.watching.resorts.forEach(r => bump(subResorts, r));
    p.watching.regions.forEach(r => bump(subRegions, r));
  }

  const label = id => names[id] || id;
  const subscribers = [...subs.values()].map(p => ({
    email: p.email,
    firstSource: p.firstSource,
    signedUpAt: p.signedUpAt,
    watchingResorts: [...p.watching.resorts],
    watchingRegions: [...p.watching.regions],
    askedResorts: top(p.asked.resorts, 5).map(x => x.id),
    askedRegions: top(p.asked.regions, 5).map(x => x.id),
    askedMonths: top(p.asked.months, 3).map(x => x.id),
    questions: p.questions,
    lastQuestion: p.lastQuestion,
    doNotSell: dnsByEmail.get(p.email) === true,
    demo: p.demo,
  })).sort((a, b) => String(b.signedUpAt).localeCompare(String(a.signedUpAt)));

  return {
    generatedAt: new Date(now).toISOString(),
    days,
    totals: {
      subscribers: subs.size,
      signups,
      chats,
      sessions: sessions.size,
      linkedSessions: sidEmail.size,
      doNotSell: subscribers.filter(s => s.doNotSell).length,
      offers,
    },
    signupsByDay: [...byDay.entries()].map(([date, counts]) => ({ date, ...counts })),
    signupsBySource: Object.fromEntries(SOURCE_BUCKETS.map(b => [b, subscribers.filter(s => s.firstSource === b).length])),
    topSubscribed: {
      resorts: top(subResorts).map(x => ({ ...x, name: label(x.id) })),
      regions: top(subRegions).map(x => ({ ...x, name: label(x.id) })),
    },
    topQuestions: top(questions).map(x => ({ q: questionText.get(x.id), count: x.count })),
    topAsked: {
      resorts: top(askedResorts).map(x => ({ ...x, name: label(x.id) })),
      regions: top(askedRegions).map(x => ({ ...x, name: label(x.id) })),
      months: top(askedMonths, 12).map(x => ({ ...x, name: MONTH_NAMES[x.id - 1] })),
    },
    subscribers,
  };
}

function csvCell(v) {
  const s = Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map(r => columns.map(c => csvCell(r[c])).join(','))].join('\n') + '\n';
}

export const SUBSCRIBER_COLUMNS = ['email', 'firstSource', 'signedUpAt', 'watchingResorts', 'watchingRegions', 'askedResorts', 'askedRegions', 'askedMonths', 'questions', 'doNotSell', 'demo'];

/** Partner/sponsor exports drop anyone who opted out of sale/sharing (CCPA). */
export function subscribersCsv(dash, { partners = false } = {}) {
  const rows = partners ? dash.subscribers.filter(s => !s.doNotSell) : dash.subscribers;
  return toCsv(rows, partners ? SUBSCRIBER_COLUMNS.filter(c => c !== 'doNotSell') : SUBSCRIBER_COLUMNS);
}

export function chatsCsv(events = [], { partners = false, optedOut = new Set() } = {}) {
  const rows = events.filter(e => e.type === 'chat' && !(partners && (optedOut.has(e.email) || optedOut.has(e.sid))));
  return toCsv(rows.map(e => ({ ...e, email: partners ? '' : e.email })), ['at', 'q', 'resorts', 'regions', 'months', 'sid', 'email', 'mode']);
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/**
 * Seeded fake funnel for the dashboard's demo toggle. Every event carries demo: true and every
 * address is demo+N@example.com, so it can never be mistaken for (or mixed into) real data.
 */
export function demoEvents({ now = Date.now(), seed = 7, count = 64 } = {}) {
  const r = rng(seed);
  const pick = xs => xs[Math.floor(r() * xs.length)];
  const resorts = ['alta', 'snowbird', 'jackson-hole', 'palisades', 'mammoth', 'niseko-annupuri', 'whistler-blackcomb', 'vail', 'big-sky', 'steamboat'];
  const regions = ['utah', 'california', 'japan', 'colorado', 'alps', 'british-columbia'];
  const qs = [
    ['Which resort is getting the most snow right now?', [], []],
    ['Good resort for a Japan ski trip', [], ['japan']],
    ['Best resorts to go to in March', [], [], [3]],
    ['Alta vs Snowbird', ['alta', 'snowbird'], ['utah']],
    ['California resorts with the most projected snow', [], ['california']],
    ['Is Jackson Hole getting snow this week?', ['jackson-hole'], []],
    ['Best in January for Colorado', [], ['colorado'], [1]],
    ['Niseko in February', ['niseko-annupuri'], ['japan'], [2]],
  ];
  const sources = ['home', 'home', 'resort', 'resort', 'region', 'region', 'chat', 'other'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const at = new Date(now - Math.floor(r() * 28 * 864e5)).toISOString();
    const sid = `demo${String(i).padStart(4, '0')}sess`;
    const em = `demo+${i}@example.com`;
    const asks = 1 + Math.floor(r() * 3);
    for (let k = 0; k < asks; k++) {
      const [q, rs, gs, ms = []] = pick(qs);
      out.push({ id: `dc${i}x${k}`, type: 'chat', at: new Date(Date.parse(at) - (k + 1) * 6e5).toISOString(), env: 'demo', sid, email: null, q, resorts: rs, regions: gs, months: ms, mode: r() < 0.7 ? 'llm' : 'fallback', demo: true });
    }
    if (r() < 0.7) {
      const source = pick(sources);
      const kind = source === 'region' || r() < 0.2 ? 'region' : 'resort';
      out.push({ id: `ds${i}`, type: 'signup', at, env: 'demo', sid, email: em, source, bucket: sourceBucket(source), kind, resorts: kind === 'resort' ? [pick(resorts)] : [], region: kind === 'region' ? pick(regions) : null, consentVersion: 'ss-consent-2', preview: false, demo: true });
      if (r() < 0.12) out.push({ id: `dd${i}`, type: 'dns', at, env: 'demo', sid, email: em, optOut: true, demo: true });
      if (source === 'chat') out.push({ id: `do${i}`, type: 'offer', at, env: 'demo', sid, email: null, action: 'accepted', target: { type: 'resort', id: pick(resorts) }, demo: true });
    } else if (r() < 0.5) {
      out.push({ id: `do${i}`, type: 'offer', at, env: 'demo', sid, email: null, action: r() < 0.5 ? 'dismissed' : 'shown', target: { type: 'region', id: pick(regions) }, demo: true });
    }
  }
  return out;
}

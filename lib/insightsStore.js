/**
 * Insights event store on the existing private Vercel Blob store.
 *
 * Hobby Blob allows ~2,000 advanced operations (put/list) a month, so events are buffered per
 * function instance and written as one batch file (insights/<env>/raw/<day>/<ts>-<rand>.json)
 * rather than one put per question. Reads compact finished days into
 * insights/<env>/daily/<day>.json so the dashboard stays a handful of gets.
 * Without BLOB_READ_WRITE_TOKEN (local dev) events live in process memory.
 */
import { put, get, del, list } from '@vercel/blob';
import { cleanEvent } from './insights.js';

const A = { access: 'private' };
const FLUSH_AT = 25;
const FLUSH_DELAY_MS = 15_000;

export const insightsEnv = () => process.env.VERCEL_ENV || 'development';
const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const root = () => `insights/${insightsEnv()}`;

const state = globalThis.__ssInsights || (globalThis.__ssInsights = { memory: [], buffer: [], timer: null });

async function readJSON(path) {
  const r = await get(path, { ...A, useCache: false }).catch(() => null);
  if (!r || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

const writeJSON = (path, obj) => put(path, JSON.stringify(obj), { ...A, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });

async function waitUntilSafe(p) {
  try {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(p);
  } catch {
    p.catch(() => {});
  }
}

export async function flushEvents() {
  if (!state.buffer.length) return 0;
  const batch = state.buffer.splice(0);
  clearTimeout(state.timer);
  state.timer = null;
  const day = batch[0].at.slice(0, 10);
  const name = `${root()}/raw/${day}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  try {
    await writeJSON(name, batch);
  } catch (err) {
    console.warn('[insights] flush failed', err?.message || err);
    state.buffer.unshift(...batch.slice(-200));
    return 0;
  }
  return batch.length;
}

/**
 * Record events. `durable` writes now (signups, opt-outs); everything else is batched and
 * flushed after FLUSH_DELAY_MS or FLUSH_AT events, whichever comes first.
 */
export async function recordEvents(raws, { durable = false, now = Date.now() } = {}) {
  const events = (Array.isArray(raws) ? raws : [raws]).map(r => cleanEvent(r, { now, env: insightsEnv() })).filter(Boolean);
  if (!events.length) return [];
  if (!blobOn()) {
    state.memory.push(...events);
    if (state.memory.length > 5000) state.memory.splice(0, state.memory.length - 5000);
    return events;
  }
  state.buffer.push(...events);
  if (durable || state.buffer.length >= FLUSH_AT) {
    await flushEvents();
  } else if (!state.timer) {
    await waitUntilSafe(new Promise(resolve => {
      state.timer = setTimeout(() => flushEvents().finally(resolve), FLUSH_DELAY_MS);
    }));
  }
  return events;
}

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.cursor;
  } while (cursor);
  return out;
}

/** All events for the last `days` days, compacting finished raw days on the way. */
export async function readEvents({ days = 90, now = Date.now() } = {}) {
  if (!blobOn()) return [...state.memory, ...state.buffer];
  await flushEvents();
  const today = new Date(now).toISOString().slice(0, 10);
  const since = new Date(now - days * 864e5).toISOString().slice(0, 10);
  const [raw, daily] = await Promise.all([listAll(`${root()}/raw/`), listAll(`${root()}/daily/`)]);

  const rawByDay = new Map();
  for (const b of raw) {
    const day = b.pathname.split('/')[3];
    if (!rawByDay.has(day)) rawByDay.set(day, []);
    rawByDay.get(day).push(b.pathname);
  }
  const dailyDays = new Set(daily.map(b => b.pathname.split('/').pop().replace('.json', '')));
  const events = [];

  for (const day of dailyDays) {
    if (day < since) continue;
    const xs = await readJSON(`${root()}/daily/${day}.json`);
    if (Array.isArray(xs)) events.push(...xs);
  }
  for (const [day, paths] of rawByDay) {
    const batches = await Promise.all(paths.map(readJSON));
    const xs = batches.filter(Array.isArray).flat();
    if (day < today) {
      const prior = dailyDays.has(day) ? events.filter(e => e.at.slice(0, 10) === day) : [];
      const seen = new Set(prior.map(e => e.id));
      const merged = [...prior, ...xs.filter(e => !seen.has(e.id))];
      await writeJSON(`${root()}/daily/${day}.json`, merged);
      await del(paths).catch(() => {});
      if (day >= since) events.push(...xs.filter(e => !seen.has(e.id)));
    } else {
      events.push(...xs);
    }
  }
  return events;
}

/** Test/dev only: reset the in-memory store. */
export function resetMemoryStore() {
  state.memory.length = 0;
  state.buffer.length = 0;
}

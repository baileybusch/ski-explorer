/**
 * Live snow data for the eve tools: the same /api/observed the browser loads
 * (src/lib/catalog.ts), on the same public host, so the chat and the page agree.
 *
 * - Short in-memory cache (LIVE_TTL_MS). Concurrent calls share one fetch.
 * - Falls back to the embedded snapshot when the live fetch fails or there is
 *   no deployment origin (local dev, evals), retrying after FAIL_TTL_MS.
 * - snow.json / resorts / gazetteer are static assets from the same commit as the
 *   eve bundle, so only the observed rows can drift; that's what we refresh.
 */
import { buildCatalog, setCatalog, loadRaw } from '../skiscope-tools/catalog.js';

export const LIVE_TTL_MS = 3 * 60 * 1000;
export const FAIL_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 2500;

let baseRaw = null;
let state = { t: 0, ok: false, source: 'snapshot', fetched: null, origin: null, error: null };
let inflight = null;

/** Embedded (build-time) raw JSON; embeddedData.ts calls this in the eve bundle. */
export function setBaseRaw(raw) {
  baseRaw = raw;
}

const procEnv = () => (typeof process !== 'undefined' && process.env) || {};

/**
 * The public host the browser uses. Production -> the production domain; previews ->
 * the branch alias (same CDN cache entry as the page's /api/observed), then the
 * deployment URL. Vercel system env vars only; nothing to configure.
 */
export function liveOrigin(env = procEnv()) {
  const host = env.VERCEL_ENV === 'production'
    ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
    : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  return host ? `https://${String(host).replace(/^https?:\/\//, '').replace(/\/+$/, '')}` : null;
}

function base() {
  return baseRaw || loadRaw();
}

/** Rebuild the catalog with a given observed snapshot (fresh snow object; base stays untouched). */
function install(observed) {
  const b = base();
  setCatalog(buildCatalog({ ...b, snow: { ...b.snow }, observed }));
}

export function liveDataState() {
  return { ...state };
}

/** For tests. */
export function resetLiveData() {
  state = { t: 0, ok: false, source: 'snapshot', fetched: null, origin: null, error: null };
  inflight = null;
}

/**
 * Make sure the shared catalog uses live observed data (cached a few minutes).
 * Never throws; on failure the embedded snapshot stays in place.
 */
export async function ensureLiveData({ fetchImpl = globalThis.fetch, env = procEnv(), now = Date.now, force = false } = {}) {
  const ttl = state.ok ? LIVE_TTL_MS : FAIL_TTL_MS;
  if (!force && state.t && now() - state.t < ttl) return liveDataState();
  if (inflight) return inflight;
  inflight = (async () => {
    const origin = liveOrigin(env);
    if (!origin || typeof fetchImpl !== 'function') {
      state = { t: now(), ok: false, source: 'snapshot', fetched: base().observed?.fetched || null, origin: null, error: 'no-origin' };
      return liveDataState();
    }
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), TIMEOUT_MS) : null;
    try {
      const res = await fetchImpl(`${origin}/api/observed`, { headers: { Accept: 'application/json' }, signal: ac?.signal });
      if (!res?.ok) throw new Error(`HTTP ${res?.status}`);
      const observed = await res.json();
      if (!observed || typeof observed.resorts !== 'object' || !Object.keys(observed.resorts).length) throw new Error('empty observed');
      install(observed);
      state = { t: now(), ok: true, source: 'live', fetched: observed.fetched || null, origin, error: null };
    } catch (err) {
      install(base().observed);
      state = { t: now(), ok: false, source: 'snapshot', fetched: base().observed?.fetched || null, origin, error: String(err?.message || err) };
      console.warn('[eve] live observed fetch failed; using embedded snapshot', state.error);
    } finally {
      if (timer) clearTimeout(timer);
      inflight = null;
    }
    return liveDataState();
  })();
  return inflight;
}

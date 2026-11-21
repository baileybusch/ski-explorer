/**
 * Per-IP limits for the public SkiScope chat.
 *
 * Only real questions (POST /eve/v1/session/<id>) count toward the strict
 * anti-abuse limit. Background plumbing (creating a session, the stream
 * GETs and their reconnects, cancel/end, health) gets its own much looser
 * bucket, so an idle open tab can't lock someone out of asking.
 */
export const WINDOW_MS = 10 * 60 * 1000;
export const LIMITS = { message: 20, background: 300 };
export const RATE_LIMITED_CODE = 'rate_limited';
export const RATE_LIMITED_MESSAGE = 'Too many questions, try again in a few minutes.';

const MESSAGE_PATH = /^\/eve(?:\/[a-z0-9-]+)?\/v1\/session\/[^/]+\/?$/i;

/**
 * 'message' for a question sent to a session, else 'background'.
 * eve uses POST /session/<id> both to prewarm an existing session (empty body)
 * and to send a turn, so pass `hasBody: false` for an empty JSON body.
 */
export function requestKind(method, pathname, { hasBody = true } = {}) {
  return hasBody && String(method).toUpperCase() === 'POST' && MESSAGE_PATH.test(pathname) ? 'message' : 'background';
}

/** True when a POST carries a non-empty JSON object (a turn), false for a prewarm ({} / empty). */
export async function hasTurnBody(request) {
  try {
    const text = await request.clone().text();
    if (!text.trim()) return false;
    const body = JSON.parse(text);
    return !!body && typeof body === 'object' && Object.keys(body).length > 0;
  } catch {
    return true; // unreadable bodies count as questions (strict side)
  }
}

export function ipOf(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

/** In-memory sliding-window limiter, one bucket per (kind, ip). */
export function createLimiter({ limits = LIMITS, windowMs = WINDOW_MS, now = () => Date.now() } = {}) {
  const hits = new Map();
  let calls = 0;
  function sweep(t) {
    for (const [k, arr] of hits) {
      const kept = arr.filter(x => t - x < windowMs);
      if (kept.length) hits.set(k, kept); else hits.delete(k);
    }
  }
  return {
    /** Records the hit and returns true, or returns false when over the limit. */
    allow(kind, ip) {
      const t = now();
      if (++calls % 500 === 0) sweep(t);
      const key = `${kind}:${ip}`;
      const arr = (hits.get(key) || []).filter(x => t - x < windowMs);
      if (arr.length >= (limits[kind] ?? limits.background)) {
        hits.set(key, arr);
        return false;
      }
      arr.push(t);
      hits.set(key, arr);
      return true;
    },
    /** Hits currently in the window for one bucket (diagnostics). */
    count(kind, ip) {
      const t = now();
      return (hits.get(`${kind}:${ip}`) || []).filter(x => t - x < windowMs).length;
    },
    /** Checks a Request: classifies it (reading a clone of the body when needed), then applies its bucket. */
    async check(request) {
      const url = new URL(request.url, 'http://local');
      let kind = requestKind(request.method, url.pathname);
      if (kind === 'message' && !(await hasTurnBody(request))) kind = 'background';
      return { kind, ok: this.allow(kind, ipOf(request)) };
    },
  };
}

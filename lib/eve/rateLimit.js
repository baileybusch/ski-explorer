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

/** 'message' for a question sent to a session, else 'background'. */
export function requestKind(method, pathname) {
  return String(method).toUpperCase() === 'POST' && MESSAGE_PATH.test(pathname) ? 'message' : 'background';
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
    /** Checks a Request: classifies it, then applies its bucket. */
    check(request) {
      const url = new URL(request.url, 'http://local');
      const kind = requestKind(request.method, url.pathname);
      return { kind, ok: this.allow(kind, ipOf(request)) };
    },
  };
}

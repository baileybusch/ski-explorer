/**
 * Tiny in-memory rate limit for the public /api/agent endpoint.
 * Fluid Compute reuses instances, so this catches bursts on one isolate.
 * It is not a global quota — good enough to slow casual abuse.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 30;
const hits = new Map();

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX) {
    hits.set(ip, arr);
    return { ok: false, retryAfter: Math.ceil((arr[0] + WINDOW_MS - now) / 1000) };
  }
  arr.push(now);
  hits.set(ip, arr);
  return { ok: true };
}

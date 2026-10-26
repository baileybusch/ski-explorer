/**
 * Auth request rate limit. In-memory per isolate (same pattern as /api/agent).
 * 5 / email / 15 min and 20 / IP / 15 min.
 */
const WINDOW_MS = 15 * 60 * 1000;
const hits = new Map();

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function bump(key, max, now) {
  const arr = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= max) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((arr[0] + WINDOW_MS - now) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  return { ok: true };
}

export function authRateLimit({ email, ip, now = Date.now() } = {}) {
  const emailHit = email ? bump(`e:${String(email).toLowerCase()}`, 5, now) : { ok: true };
  const ipHit = ip ? bump(`i:${ip}`, 20, now) : { ok: true };
  if (!emailHit.ok) return emailHit;
  if (!ipHit.ok) return ipHit;
  return { ok: true };
}

export function resetAuthLimitForEval() {
  hits.clear();
}

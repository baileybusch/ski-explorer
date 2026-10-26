/**
 * Signed tokens for magic-link sign-in, email manage links, sessions, confirm, unsub.
 *
 * Format:  ss1.<base64url(json payload)>.<base64url(hmac-sha256)>
 * Payload: { v: 1, e: email, p: purpose, exp: unixSeconds, j?: jti }
 *
 * One-time purposes (signin, confirm, manage) carry a jti and must be consumed.
 * Session cookies are long-lived and not consumed.
 *
 * HMAC key: AUTH_TOKEN_SECRET (live). CRON_SECRET is a fallback.
 */
import crypto from 'node:crypto';

export const AUTH_TOKEN_VERSION = 'ss1';
export const SIGNIN_TTL_SEC = 30 * 60;
export const MANAGE_TTL_SEC = 7 * 24 * 60 * 60;
export const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
export const CONFIRM_TTL_SEC = 7 * 24 * 60 * 60;
export const UNSUB_TTL_SEC = 365 * 24 * 60 * 60;

export const ONE_TIME = new Set(['signin', 'confirm', 'manage']);
const PURPOSES = new Set(['signin', 'session', 'manage', 'confirm', 'unsub']);

export function resolveAuthSecret(override) {
  if (override) return String(override);
  return process.env.AUTH_TOKEN_SECRET || process.env.CRON_SECRET || '';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function hmac(body, secret) {
  return crypto.createHmac('sha256', secret).update(`${AUTH_TOKEN_VERSION}.${body}`).digest('base64url');
}

export function newJti() {
  return crypto.randomBytes(16).toString('hex');
}

export function signAuthToken({ email, purpose = 'manage', ttlSec, now = Date.now(), jti } = {}, secretOverride) {
  const secret = resolveAuthSecret(secretOverride);
  if (!secret) throw new Error('AUTH_TOKEN_SECRET missing');
  const p = PURPOSES.has(purpose) ? purpose : 'manage';
  const ttl = ttlSec ?? (
    p === 'signin' ? SIGNIN_TTL_SEC
      : p === 'session' ? SESSION_TTL_SEC
        : p === 'confirm' ? CONFIRM_TTL_SEC
          : p === 'unsub' ? UNSUB_TTL_SEC
            : MANAGE_TTL_SEC
  );
  const payload = {
    v: 1,
    e: String(email || '').toLowerCase().trim(),
    p,
    exp: Math.floor(now / 1000) + ttl,
  };
  if (ONE_TIME.has(p)) payload.j = jti || newJti();
  if (!payload.e || !payload.e.includes('@')) throw new Error('email required');
  const body = b64url(JSON.stringify(payload));
  return `${AUTH_TOKEN_VERSION}.${body}.${hmac(body, secret)}`;
}

export function verifyAuthToken(token, secretOverride, { purpose, now = Date.now() } = {}) {
  const secret = resolveAuthSecret(secretOverride);
  if (!secret) return { ok: false, reason: 'no-secret' };
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== AUTH_TOKEN_VERSION) return { ok: false, reason: 'format' };
  const [, body, sig] = parts;
  const expect = hmac(body, secret);
  try {
    if (sig.length !== expect.length) return { ok: false, reason: 'sig' };
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return { ok: false, reason: 'sig' };
  } catch {
    return { ok: false, reason: 'sig' };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'payload' };
  }
  if (!payload || payload.v !== 1 || !payload.e || !payload.exp) return { ok: false, reason: 'payload' };
  if (purpose && payload.p !== purpose) return { ok: false, reason: 'purpose' };
  if (payload.exp <= Math.floor(now / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, email: payload.e, purpose: payload.p, exp: payload.exp, jti: payload.j || null };
}

const used = new Map();

export function consumeJti(jti, now = Date.now()) {
  if (!jti) return { ok: false, reason: 'no-jti' };
  const exp = used.get(jti);
  if (exp && exp > now) return { ok: false, reason: 'replay' };
  used.set(jti, now + SIGNIN_TTL_SEC * 1000);
  if (used.size > 5000) {
    for (const [k, v] of used) {
      if (v <= now) used.delete(k);
    }
  }
  return { ok: true };
}

export function peekJti(jti) {
  return used.has(jti);
}

export function resetConsumedForEval() {
  used.clear();
}

export const SESSION_COOKIE = 'ss_sess';

export function sessionCookieHeader(token, { secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SEC}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader({ secure = true } = {}) {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(header, name = SESSION_COOKIE) {
  if (!header) return '';
  const hit = String(header).split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : '';
}

export function csrfOk(req) {
  if (!req || req.method === 'GET' || req.method === 'HEAD') return true;
  const host = String(req.headers?.host || '');
  const origin = String(req.headers?.origin || '');
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  const referer = String(req.headers?.referer || '');
  if (!referer) return true;
  try { return new URL(referer).host === host; } catch { return false; }
}

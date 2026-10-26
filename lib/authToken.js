/**
 * Short-lived signed tokens for magic-link sign-in and email "Manage" links.
 *
 * Format:  ss1.<base64url(json payload)>.<base64url(hmac-sha256)>
 * Payload: { v: 1, e: email, p: 'signin'|'manage', exp: unixSeconds }
 *
 * HMAC key: AUTH_TOKEN_SECRET (required in live). CRON_SECRET is a fallback.
 * Tokens are not stored. The Blob `subs/<32-hex>.json` remains the durable
 * subscriber id used by unsubscribe and the cron.
 *
 * TTL: sign-in 30 minutes; manage-from-email 7 days.
 */
import crypto from 'node:crypto';

export const AUTH_TOKEN_VERSION = 'ss1';
export const SIGNIN_TTL_SEC = 30 * 60;
export const MANAGE_TTL_SEC = 7 * 24 * 60 * 60;

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

export function signAuthToken({ email, purpose = 'manage', ttlSec, now = Date.now() } = {}, secretOverride) {
  const secret = resolveAuthSecret(secretOverride);
  if (!secret) throw new Error('AUTH_TOKEN_SECRET missing');
  const p = purpose === 'signin' ? 'signin' : 'manage';
  const ttl = ttlSec ?? (p === 'signin' ? SIGNIN_TTL_SEC : MANAGE_TTL_SEC);
  const payload = {
    v: 1,
    e: String(email || '').toLowerCase().trim(),
    p,
    exp: Math.floor(now / 1000) + ttl,
  };
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
  return { ok: true, email: payload.e, purpose: payload.p, exp: payload.exp };
}

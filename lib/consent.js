/**
 * Email-list consent. There are no user accounts or passwords.
 * Privacy copy and signup copy must use CONSENT_TEXT / CONSENT_VERSION together.
 */
import crypto from 'node:crypto';
import { CONSENT_VERSION, PENDING_TTL_MS } from './consentText.js';

export { CONSENT_VERSION, CONSENT_TEXT, PENDING_TTL_MS } from './consentText.js';

export const NEUTRAL_SIGNUP = {
  ok: true,
  status: 'check-email',
  message: 'Check your email for a confirmation link.',
};

export const NEUTRAL_MANAGE = {
  ok: true,
  status: 'check-email',
  message: 'If that address is on file, we sent a sign-in link.',
};

export function hashIp(ip, salt = '') {
  const raw = String(ip || '').trim();
  if (!raw || raw === 'unknown') return null;
  return crypto.createHash('sha256').update(`${salt}|${raw}`).digest('hex').slice(0, 32);
}

export function consentRecord({ source = 'signup', ip, salt, now = Date.now() } = {}) {
  return {
    at: new Date(now).toISOString(),
    source: String(source || 'signup').slice(0, 40),
    version: CONSENT_VERSION,
    ipHash: hashIp(ip, salt || process.env.AUTH_TOKEN_SECRET || process.env.CRON_SECRET || 'preview'),
  };
}

export function isPendingExpired(sub, now = Date.now()) {
  if (!sub || sub.status !== 'pending') return false;
  const created = Date.parse(sub.created || '');
  if (!Number.isFinite(created)) return true;
  return now - created > PENDING_TTL_MS;
}

export function canReceiveEmail(sub, now = Date.now()) {
  if (!sub) return false;
  if (sub.status === 'unsubscribed') return false;
  if (sub.status !== 'active') return false;
  if (isPendingExpired(sub, now)) return false;
  return true;
}

/**
 * Magic-link request / verify / account update.
 * Sending is gated by EMAIL_ALERTS_ENABLED. Preview hosts get { preview: true } and send nothing.
 * Live writes require a session cookie or a freshly consumed one-time token.
 */
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';
import {
  SIGNIN_TTL_SEC, SESSION_COOKIE, clearSessionCookieHeader, consumeJti, csrfOk,
  readCookie, sessionCookieHeader, signAuthToken, verifyAuthToken,
} from '../lib/authToken.js';
import { authRateLimit, clientIp } from '../lib/authLimit.js';
import { normalizePrefs, defaultPrefs } from '../lib/accountPrefs.js';
import { findByEmail, saveSub, deleteSub, sendEmail, isEmail, SITE, body } from './_lib.js';
import { NEUTRAL_MANAGE, isPendingExpired } from '../lib/consent.js';

function json(res, code, payload) {
  res.setHeader('cache-control', 'no-store');
  res.status(code).json(payload);
}

function publicAccount(sub, email) {
  return {
    email,
    prefs: normalizePrefs(sub?.prefs),
    rules: sub?.rules || [],
    status: sub?.status || 'preview',
  };
}

function setSession(res, email) {
  const token = signAuthToken({ email, purpose: 'session' });
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  res.setHeader('Set-Cookie', sessionCookieHeader(token, { secure }));
}

function clearSession(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  res.setHeader('Set-Cookie', clearSessionCookieHeader({ secure }));
}

function sessionFromReq(req) {
  const raw = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!raw) return null;
  const v = verifyAuthToken(raw, undefined, { purpose: 'session' });
  return v.ok ? v : null;
}

function consumeOneTime(token, purpose) {
  const v = verifyAuthToken(token, undefined, purpose ? { purpose } : {});
  if (!v.ok) return v;
  if (v.jti) {
    const c = consumeJti(v.jti);
    if (!c.ok) return { ok: false, reason: c.reason };
  }
  return v;
}

export default async function handler(req, res) {
  const action = String(req.query.action || (req.method === 'GET' ? 'me' : 'request'));

  if (req.method === 'POST' && action === 'request') {
    const b = await body(req);
    const email = String(b.email || '').toLowerCase().trim();
    if (!isEmail(email)) return json(res, 400, { error: 'Enter a valid email' });
    const limited = authRateLimit({ email, ip: clientIp(req) });
    if (!limited.ok) return json(res, 429, { error: 'Try again later', retryAfter: limited.retryAfter });
    if (!EMAIL_ALERTS_ENABLED) {
      return json(res, 200, { ...NEUTRAL_MANAGE, preview: true, sent: false });
    }
    let token;
    try {
      token = signAuthToken({ email, purpose: 'signin', ttlSec: SIGNIN_TTL_SEC });
    } catch {
      return json(res, 500, { error: 'AUTH_TOKEN_SECRET is not set' });
    }
    const href = `${SITE}/manage?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: email,
      subject: 'Your SkiScope sign-in link',
      text: `Sign in (expires in 30 minutes):\n${href}\n\nIf you didn't ask for this, ignore it.`,
      html: `<p>Enter your email and we sent this sign-in link. It expires in 30 minutes.</p><p><a href="${href}">Open preference center</a></p>`,
    });
    return json(res, 200, { ...NEUTRAL_MANAGE, sent: true });
  }

  if (req.method === 'POST' && action === 'signout') {
    clearSession(res);
    return json(res, 200, { ok: true });
  }

  if ((req.method === 'GET' || req.method === 'POST') && (action === 'verify' || action === 'exchange')) {
    const incoming = req.method === 'POST' ? await body(req) : {};
    const token = req.query.token || incoming.token;
    const verified = consumeOneTime(token);
    if (!verified.ok || !['signin', 'manage', 'confirm'].includes(verified.purpose)) {
      return json(res, 401, { error: 'Link expired or invalid' });
    }
    const sub = await findByEmail(verified.email);
    if (verified.purpose === 'confirm' && sub && sub.status !== 'active' && !isPendingExpired(sub)) {
      sub.status = 'active';
      sub.confirmed = new Date().toISOString();
      await saveSub(sub);
    }
    try { setSession(res, verified.email); } catch { /* preview without secret */ }
    return json(res, 200, { ok: true, ...publicAccount(sub, verified.email) });
  }

  const sess = sessionFromReq(req);
  if (req.method === 'GET' && (action === 'me' || !action || action === 'verify')) {
    if (!sess) return json(res, 401, { error: 'Sign in required' });
    const sub = await findByEmail(sess.email);
    return json(res, 200, publicAccount(sub, sess.email));
  }

  if (!sess) return json(res, 401, { error: 'Sign in required' });
  if (!csrfOk(req)) return json(res, 403, { error: 'Bad origin' });

  const incoming = req.method === 'POST' ? await body(req) : {};
  const sub = await findByEmail(sess.email);

  if (req.method === 'POST' && action === 'save') {
    if (sub) {
      if (incoming.prefs) sub.prefs = normalizePrefs({ ...sub.prefs, ...incoming.prefs });
      if (Array.isArray(incoming.rules)) sub.rules = incoming.rules.slice(0, 20);
      await saveSub(sub);
    }
    return json(res, 200, { ok: true, ...publicAccount(sub, sess.email) });
  }

  if (req.method === 'POST' && action === 'unsubscribe') {
    if (sub) {
      sub.prefs = { ...defaultPrefs(), stormAlerts: false, recap: false, sponsor: false };
      sub.status = 'unsubscribed';
      (sub.rules || []).forEach(r => { r.paused = true; });
      await saveSub(sub);
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && action === 'delete') {
    if (sub) await deleteSub(sub);
    clearSession(res);
    return json(res, 200, { ok: true, deleted: true });
  }

  return json(res, 400, { error: 'Unknown action' });
}

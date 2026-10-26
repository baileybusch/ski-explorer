/**
 * Magic-link request / verify / account update.
 * Sending is gated by EMAIL_ALERTS_ENABLED. Preview hosts get { preview: true } and send nothing.
 */
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';
import { signAuthToken, verifyAuthToken, SIGNIN_TTL_SEC } from '../lib/authToken.js';
import { normalizePrefs, defaultPrefs } from '../lib/accountPrefs.js';
import { findByEmail, saveSub, deleteSub, sendEmail, isEmail, SITE, body } from './_lib.js';

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

export default async function handler(req, res) {
  const action = String(req.query.action || (req.method === 'GET' ? 'verify' : 'request'));

  if (req.method === 'POST' && action === 'request') {
    const b = await body(req);
    const email = String(b.email || '').toLowerCase().trim();
    if (!isEmail(email)) return json(res, 400, { error: 'Enter a valid email' });
    if (!EMAIL_ALERTS_ENABLED) {
      return json(res, 200, { ok: true, preview: true, sent: false, message: 'Preview — nothing was emailed.' });
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
      html: `<p>Sign in to SkiScope. This link expires in 30 minutes.</p><p><a href="${href}">Open manage account</a></p>`,
    });
    return json(res, 200, { ok: true, sent: true });
  }

  const incoming = req.method === 'POST' ? await body(req) : {};
  const token = req.query.token || incoming.token;
  const verified = verifyAuthToken(token);
  if (!verified.ok) return json(res, 401, { error: 'Link expired or invalid', reason: verified.reason });

  const sub = await findByEmail(verified.email);

  if (req.method === 'GET' || action === 'verify') {
    return json(res, 200, publicAccount(sub, verified.email));
  }

  if (req.method === 'POST' && action === 'save') {
    if (sub) {
      if (incoming.prefs) sub.prefs = normalizePrefs({ ...sub.prefs, ...incoming.prefs });
      if (Array.isArray(incoming.rules)) sub.rules = incoming.rules.slice(0, 20);
      await saveSub(sub);
    }
    return json(res, 200, { ok: true, ...publicAccount(sub, verified.email) });
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
    return json(res, 200, { ok: true, deleted: true });
  }

  return json(res, 400, { error: 'Unknown action' });
}

import { findByEmail, createSub, saveSub, sendEmail, confirmEmail, emailConfigured, isEmail, body } from './_lib.js';
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';
import { normalizeRule } from '../lib/evaluateAlerts.js';
import { authRateLimit, clientIp } from '../lib/authLimit.js';
import { consentRecord, NEUTRAL_SIGNUP } from '../lib/consent.js';
import { csrfOk } from '../lib/authToken.js';

function previewEnv() {
  return process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
}

function parseRule(b, email) {
  const resorts = [...new Set((b.resorts || []).filter(r => typeof r === 'string' && /^[a-z0-9-]{2,40}$/.test(r)))].slice(0, 30);
  const saved = [...new Set((b.savedResorts || []).filter(r => typeof r === 'string' && /^[a-z0-9-]{2,40}$/.test(r)))].slice(0, 30);
  return normalizeRule({
    watch: b.watch,
    resorts,
    savedResorts: saved,
    region: typeof b.region === 'string' && /^[a-z0-9-]{2,40}$/.test(b.region) ? b.region : null,
    pass: b.pass,
    minSnowIn: b.minSnowIn,
    windowHours: b.windowHours,
    freq: b.freq || 'on-trigger',
    tier: 'free',
  }, email);
}

function json(res, code, payload) {
  res.setHeader('cache-control', 'no-store');
  res.status(code).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!csrfOk(req)) return json(res, 403, { error: 'Bad origin' });
  const b = await body(req);
  const email = String(b.email || '').toLowerCase().trim();
  if (!isEmail(email)) return json(res, 400, { error: 'Enter a valid email' });
  const limited = authRateLimit({ email, ip: clientIp(req) });
  if (!limited.ok) return json(res, 429, { error: 'Try again later', retryAfter: limited.retryAfter });
  const rule = parseRule(b, email);
  const ids = rule.resorts;
  const consent = consentRecord({ source: b.source || 'signup', ip: clientIp(req) });

  if (!EMAIL_ALERTS_ENABLED) {
    if (previewEnv()) {
      return json(res, 200, { ...NEUTRAL_SIGNUP, preview: true, sent: false, wrote: false });
    }
    return json(res, 503, { error: 'Email alerts are paused' });
  }

  let sub = await findByEmail(email);
  if (!sub) {
    sub = await createSub(email, ids, { freq: 'on-trigger', rule, consent });
  } else {
    sub.resorts = [...new Set([...(sub.resorts || []), ...ids])];
    if (!Array.isArray(sub.rules)) sub.rules = [];
    const existing = sub.rules.find(r => r.watch === rule.watch && r.region === rule.region && String(r.pass) === String(rule.pass));
    if (existing) {
      existing.minSnowIn = rule.minSnowIn;
      existing.windowHours = rule.windowHours;
      existing.resorts = [...new Set([...(existing.resorts || []), ...ids])];
      existing.savedResorts = rule.savedResorts;
    } else {
      if (!rule.id) rule.id = `rul_${sub.token.slice(0, 8)}`;
      sub.rules.push(rule);
    }
    if (!sub.consent) sub.consent = consent;
    if (sub.status !== 'active') sub.status = 'pending';
    await saveSub(sub);
  }

  if (sub.status !== 'active') {
    await sendEmail({ to: sub.email, subject: 'Confirm your SkiScope snow alerts', html: confirmEmail(sub) });
  }

  void emailConfigured;
  return json(res, 200, { ...NEUTRAL_SIGNUP, sent: true });
}

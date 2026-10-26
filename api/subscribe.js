import { findByEmail, createSub, saveSub, sendEmail, confirmEmail, emailConfigured, isEmail, body } from './_lib.js';
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';
import { normalizeRule } from '../lib/evaluateAlerts.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = await body(req);
  const email = String(b.email || '').toLowerCase().trim();
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  const rule = parseRule(b, email);
  const ids = rule.resorts;

  if (!EMAIL_ALERTS_ENABLED) {
    if (previewEnv()) {
      return res.json({
        status: 'preview',
        preview: true,
        sent: false,
        wrote: false,
        rule: { watch: rule.watch, minSnowIn: rule.minSnowIn, windowHours: rule.windowHours, pass: rule.pass, region: rule.region, resorts: ids },
        message: 'Preview only — nothing was saved or sent.',
      });
    }
    return res.status(503).json({ error: 'Email alerts are paused' });
  }

  let sub = await findByEmail(email);
  if (!sub) sub = await createSub(email, ids, { freq: 'on-trigger', rule });
  else {
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
    if (sub.status !== 'active' && (b.freq === 'daily' || b.freq === 'weekly' || b.freq === 'on-trigger')) sub.freq = b.freq;
    await saveSub(sub);
  }
  if (sub.status === 'active') return res.json({ status: 'active', message: `Added. You're already subscribed — <a href="/alerts">manage alerts</a> from the link in any email.` });
  const sent = await sendEmail({ to: sub.email, subject: 'Confirm your SkiScope snow alerts', html: confirmEmail(sub) });
  if (!emailConfigured()) return res.json({ status: 'pending', emailConfigured: false, message: 'Saved. Email delivery is not switched on yet, so the confirmation email could not be sent. You will be able to confirm once it is live.' });
  if (sent.skipped) return res.json({ status: 'pending', message: 'Saved. Sending is still locked — confirmation will go out when alerts are enabled.' });
  if (sent.status >= 300) return res.status(502).json({ error: 'Could not send confirmation email' });
  res.json({ status: 'pending', message: `Check ${sub.email} and tap the confirmation link to start alerts.` });
}

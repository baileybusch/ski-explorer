/**
 * Pulse job: evaluate dump alerts + Sunday-evening recap.
 * Sending stays behind EMAIL_ALERTS_ENABLED. Wired in vercel.json; this
 * handler is a no-op while the flag is false.
 */
import { readFileSync } from 'node:fs';
import { loadData, sendEmail, allActive, saveSub, emailConfigured } from '../_lib.js';

const readJSON = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';
import { evaluateAlerts, shouldSendRecap, rankRecap } from '../../lib/evaluateAlerts.js';
import { stormAlertEmail, recapEmail } from '../../lib/emails.js';

export const config = { maxDuration: 300 };

function attachCatalog(snow, index, regions) {
  return { ...snow, index, regions: regions || [] };
}

export default async function handler(req, res) {
  if (!EMAIL_ALERTS_ENABLED) {
    return res.json({
      ok: true, sent: 0, paused: true,
      note: 'Email alerts are paused (EMAIL_ALERTS_ENABLED=false). Evaluator is implemented; nothing is sent.',
    });
  }
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!emailConfigured()) return res.json({ ok: true, sent: 0, note: 'RESEND_API_KEY not set; nothing sent' });

  const now = new Date();
  const allow = (process.env.DIGEST_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const [data, subs] = await Promise.all([loadData(), allActive()]);
  let snow = { dates: [], today: 0, resorts: {} };
  try { snow = readJSON('../../public/data/snow.json'); } catch { /* attach from loadData below */ }
  const index = data.resorts || [];
  let regions = [];
  try { regions = readJSON('../../public/data/gazetteer.json').regions || []; } catch { /* optional */ }
  snow = attachCatalog(snow, index, regions);

  const rules = [];
  const byRule = new Map();
  for (const s of subs) {
    if (allow.length && !allow.includes(s.email)) continue;
    for (const raw of (s.rules || [])) {
      const rule = { ...raw, email: s.email, status: s.status };
      if (!rule.id) rule.id = `rul_${s.token.slice(0, 8)}`;
      rules.push(rule);
      byRule.set(rule.id, s);
    }
  }

  const { alerts, queued } = evaluateAlerts(rules, snow, now);
  let sent = 0, failed = 0;
  for (const alert of alerts) {
    const sub = byRule.get(alert.ruleId);
    if (sub?.prefs?.stormAlerts === false) continue;
    const mail = stormAlertEmail({
      alert, token: sub?.token, email: alert.email,
      sponsor: { on: sub?.prefs?.sponsor === true },
    });
    const r = await sendEmail({ to: alert.email, ...mail });
    if (r.status && r.status < 300) {
      sent++;
      if (sub) {
        const rule = (sub.rules || []).find(x => (x.id || `rul_${sub.token.slice(0, 8)}`) === alert.ruleId);
        if (rule) {
          rule.lastFired = now.toISOString();
          rule.lastKey = alert.key;
          rule.lastKeys = [...new Set([...(rule.lastKeys || []), ...alert.keys])].slice(-40);
          rule.pendingSend = null;
        }
        await saveSub(sub);
      }
    } else {
      failed++;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  let recapSent = 0;
  if (shouldSendRecap(now)) {
    const ranked = rankRecap(snow, { limit: 5 });
    for (const s of subs) {
      if (allow.length && !allow.includes(s.email)) continue;
      if (s.prefs?.recap === false) continue;
      const mail = recapEmail({
        recent: ranked.recent, incoming: ranked.incoming, token: s.token, kind: 'weekly', email: s.email,
        sponsor: { on: s.prefs?.sponsor === true },
      });
      const r = await sendEmail({ to: s.email, ...mail });
      if (r.status && r.status < 300) recapSent++;
      else failed++;
      await new Promise(r => setTimeout(r, 600));
    }
  }

  res.json({
    ok: true,
    evaluated: rules.length,
    alerts: alerts.length,
    queued: queued.length,
    sent,
    recapSent,
    failed,
  });
}

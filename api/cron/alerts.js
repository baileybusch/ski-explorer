/**
 * Pulse job: evaluate dump alerts + Sunday-evening recap.
 * Sending stays behind EMAIL_ALERTS_ENABLED. Wired in vercel.json; this
 * handler is a no-op while the flag is false.
 */
import { readFileSync } from 'node:fs';
import { loadData, sendEmail, allActive, saveSub, emailConfigured } from '../_lib.js';

const readJSON = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';
import { evaluateAlerts, shouldSendRecap, rankRecap, consolidateAlerts } from '../../lib/evaluateAlerts.js';
import { situationEmail, combinedEmail, recapEmail } from '../../lib/emails.js';
import { writeReadout } from '../../lib/readout.js';
import { loadCatalog } from '../../lib/skiscope-tools/index.js';

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
  const catalog = loadCatalog();
  const packs = consolidateAlerts(alerts);
  let sent = 0, failed = 0;
  for (const pack of packs) {
    const first = pack.events[0];
    const sub = byRule.get(first?.ruleId);
    if (sub?.prefs?.stormAlerts === false) continue;
    const readouts = [];
    for (const ev of pack.events) {
      readouts.push(await writeReadout(ev, { catalog }));
    }
    const mail = pack.events.length === 1
      ? situationEmail({
        alert: pack.events[0], readout: readouts[0], token: sub?.token, email: pack.email,
        sponsor: { on: sub?.prefs?.sponsor === true },
      })
      : combinedEmail({
        pack, readouts, token: sub?.token, email: pack.email,
        sponsor: { on: sub?.prefs?.sponsor === true },
      });
    const r = await sendEmail({ to: pack.email, ...mail });
    if (r.status && r.status < 300) {
      sent++;
      const seen = new Set();
      for (const alert of pack.events) {
        const owner = byRule.get(alert.ruleId);
        if (!owner || seen.has(owner.token)) continue;
        seen.add(owner.token);
        for (const ev of pack.events.filter(e => byRule.get(e.ruleId) === owner)) {
          const rule = (owner.rules || []).find(x => (x.id || `rul_${owner.token.slice(0, 8)}`) === ev.ruleId);
          if (rule) {
            rule.lastFired = now.toISOString();
            rule.lastKey = ev.key;
            rule.lastKeys = [...new Set([...(rule.lastKeys || []), ...(ev.keys || [])])].slice(-40);
            if (ev.type === 'trip' && ev.stage != null) {
              rule.tripStagesSent = [...new Set([...(rule.tripStagesSent || []), ev.stage])];
            }
            rule.pendingSend = null;
          }
        }
        await saveSub(owner);
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

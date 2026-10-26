/**
 * Render-only preview of storm-alert + recap emails from committed snow.json.
 * Never sends. Protected: Bearer CRON_SECRET when set, otherwise preview/dev only.
 */
import { readFileSync } from 'node:fs';
import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';
import { evaluateAlerts, rankRecap } from '../../lib/evaluateAlerts.js';
import { stormAlertEmail, recapEmail } from '../../lib/emails.js';

function loadJSON(rel) {
  return JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
}

function demoAlert(snow, index) {
  const catalog = { ...snow, index };
  const { incoming } = rankRecap(catalog, { limit: 5 });
  const lead = incoming[0] || { id: 'alta', name: 'Alta', incomingIn: 12 };
  const rules = [{
    id: 'rul_preview',
    email: 'preview@skiscope.local',
    status: 'active',
    watch: 'pass',
    pass: 'both',
    minSnowIn: 6,
    windowHours: 168,
    tier: 'free',
  }];
  const { alerts } = evaluateAlerts(rules, catalog, new Date(snow.dates[snow.today] + 'T18:00:00-07:00'));
  if (alerts[0]) {
    alerts[0].affected = alerts[0].affected.map(row => {
      const meta = index.find(r => r.id === row.resortId) || {};
      return { ...row, iata: meta.iata, center: meta.center, region: meta.region };
    });
    return alerts[0];
  }
  const metricIn = lead.incomingIn || 8;
  return {
    subject: `Storm incoming: ${lead.name} ${Math.round(metricIn)}"`,
    lead: { resortId: lead.id, resortName: lead.name, snowIn: metricIn, startDay: snow.dates[(snow.today || 0) + 1], strip: lead.strip, iata: index.find(r => r.id === lead.id)?.iata },
    affected: incoming.slice(0, 5).map(r => ({
      resortId: r.id, resortName: r.name, snowIn: r.incomingIn, startDay: r.strip?.[0]?.date, strip: r.strip, region: r.region,
    })),
  };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const env = process.env.VERCEL_ENV;
  const auth = req.headers.authorization === `Bearer ${secret}`;
  const openPreview = env === 'preview' || env === 'development' || env === 'test';
  if (secret && !auth && !openPreview) return res.status(401).json({ error: 'unauthorized' });
  if (!secret && env === 'production' && !EMAIL_ALERTS_ENABLED) return res.status(401).json({ error: 'unauthorized' });

  const type = String(req.query.type || 'alert');
  const snow = loadJSON('../../public/data/snow.json');
  const index = loadJSON('../../public/data/resorts-index.json');
  const catalog = { ...snow, index };
  const ranked = rankRecap(catalog, { limit: 5 });

  const sponsor = { on: true, example: true };
  const payload = type === 'recap' || type === 'last-storm'
    ? recapEmail({ recent: ranked.recent, incoming: ranked.incoming, token: null, kind: type === 'last-storm' ? 'last-storm' : 'weekly', sponsor })
    : stormAlertEmail({ alert: demoAlert(snow, index), token: null, sponsor });

  if (req.query.format === 'json') {
    return res.json({ subject: payload.subject, text: payload.text, htmlBytes: payload.html.length, sent: false });
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-email-subject', encodeURIComponent(payload.subject));
  res.send(payload.html);
}

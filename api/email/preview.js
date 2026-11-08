/**
 * Render-only preview of every email template from committed snow.json. Never sends.
 * ?type=index lists them all: welcome W1–W3, confirm, resort / region alerts, recaps.
 * Protected: Bearer CRON_SECRET or a signed-in /admin session; open on preview/dev deployments.
 */
import { readFileSync } from 'node:fs';
import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';
import { evaluateAlerts, rankRecap } from '../../lib/evaluateAlerts.js';
import { stormAlertEmail, recapEmail, situationEmail, welcomeEmail } from '../../lib/emails.js';
import { welcomeRows, watchLabel, WELCOME_STEPS } from '../../lib/welcome.js';
import { confirmEmail } from '../_lib.js';
import { isAdmin } from '../admin/render.js';
import { writeReadout, deterministicReadout } from '../../lib/readout.js';
import { loadCatalog } from '../../lib/skiscope-tools/index.js';

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
    subject: `Storm incoming: ${lead.name} +${Math.round(metricIn)}" forecast`,
    lead: { resortId: lead.id, resortName: lead.name, snowIn: metricIn, past72In: lead.past72In || 0, startDay: snow.dates[(snow.today || 0) + 1], strip: lead.strip, iata: index.find(r => r.id === lead.id)?.iata },
    affected: incoming.slice(0, 5).map(r => ({
      resortId: r.id, resortName: r.name, snowIn: r.incomingIn, past72In: r.past72In || 0, startDay: r.strip?.[0]?.date, strip: r.strip, region: r.region,
    })),
  };
}

const PREVIEW_SUB = {
  token: '0'.repeat(32),
  email: 'preview@example.com',
  status: 'active',
  confirmed: new Date().toISOString(),
  resorts: ['alta', 'snowbird'],
  rules: [
    { id: 'rul_a', watch: 'resort', type: 'resort', resorts: ['alta', 'snowbird'], pass: 'both' },
    { id: 'rul_b', watch: 'region', type: 'region', region: 'japan', resorts: [], pass: 'both' },
  ],
};

export const TEMPLATES = [
  ...WELCOME_STEPS.map((s, i) => ({ type: `welcome-${i + 1}`, label: `W${i + 1} · ${s.label}`, when: s.day ? `day ${s.day} after confirm` : 'immediately after confirm' })),
  { type: 'confirm', label: 'Double opt-in confirmation', when: 'at signup' },
  { type: 'alert', label: 'Storm alert · resort', when: 'per subscription, on trigger' },
  { type: 'region', label: 'Storm alert · region leaderboard', when: 'per region subscription, on trigger' },
  { type: 'template', label: 'Storm alert · template note (no AI)', when: 'fallback when the AI readout is off' },
  { type: 'recap', label: 'Weekly recap', when: 'Sunday' },
  { type: 'last-storm', label: 'Last-storm recap', when: 'after a big storm' },
];

function indexPage() {
  const rows = TEMPLATES.map(t => `<li><a href="?type=${t.type}" target="_blank" rel="noreferrer">${t.label}</a><span>${t.when}</span></li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email templates</title>
<style>body{margin:0;background:#08090b;color:#f2f3f5;font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif}main{max-width:640px;margin:0 auto;padding:32px 20px}h1{font-size:28px;margin:0 0 6px}p{color:#7a808a;margin:0 0 20px}ul{list-style:none;padding:0;margin:0}li{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(242,243,245,.12)}a{color:#f2f3f5;font-weight:600}span{color:#7a808a;font-size:13px;text-align:right}</style></head>
<body><main><h1>Email templates</h1><p>Render-only previews from the committed snow snapshot. Nothing is sent from here.</p><ul>${rows}</ul></main></body></html>`;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const env = process.env.VERCEL_ENV;
  const auth = (secret && req.headers.authorization === `Bearer ${secret}`) || isAdmin(req);
  const openPreview = env === 'preview' || env === 'development' || env === 'test';
  if (secret && !auth && !openPreview) return res.status(401).json({ error: 'unauthorized' });
  if (!secret && !auth && env === 'production' && !EMAIL_ALERTS_ENABLED) return res.status(401).json({ error: 'unauthorized' });

  const type = String(req.query.type || 'alert');
  if (type === 'index') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.send(indexPage());
  }
  const snow = loadJSON('../../public/data/snow.json');
  const index = loadJSON('../../public/data/resorts-index.json');
  const regions = loadJSON('../../public/data/gazetteer.json').regions || [];
  const catalog = { ...snow, index, regions };
  const ranked = rankRecap(catalog, { limit: 5 });

  const sponsor = { on: true, example: true };
  let payload;
  const welcome = type.match(/^welcome-([123])$/);
  if (welcome) {
    const step = `w${welcome[1]}`;
    payload = welcomeEmail({ step, rows: welcomeRows(PREVIEW_SUB, catalog), label: watchLabel(PREVIEW_SUB, catalog), shareRegion: 'utah', token: null });
  } else if (type === 'confirm') {
    payload = { subject: 'Confirm your SkiScope snow alerts', html: confirmEmail(PREVIEW_SUB), text: '' };
  } else if (type === 'recap' || type === 'last-storm') {
    payload = recapEmail({ recent: ranked.recent, incoming: ranked.incoming, token: null, kind: type === 'last-storm' ? 'last-storm' : 'weekly', sponsor });
  } else {
    const alert = demoAlert(snow, index);
    const tools = loadCatalog();
    const readout = await writeReadout({
      type: type === 'region' ? 'region' : 'resort',
      region: type === 'region' ? 'japan' : undefined,
      resortId: alert.lead?.resortId,
      resortName: alert.lead?.resortName,
      subject: alert.subject,
    }, { catalog: tools });
    if (type === 'template') {
      readout.text = deterministicReadout({ type: 'resort', event: 'storm', resortName: alert.lead?.resortName }, readout.facts);
      readout.mode = 'deterministic';
    }
    payload = situationEmail({ alert: { ...alert, type: type === 'region' ? 'region' : 'resort' }, readout, token: null, sponsor });
    void stormAlertEmail;
  }

  if (req.query.format === 'json') {
    return res.json({ subject: payload.subject, text: payload.text, htmlBytes: payload.html.length, sent: false });
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-email-subject', encodeURIComponent(payload.subject));
  res.send(payload.html);
}

#!/usr/bin/env node
/**
 * Render storm-alert + recap emails from committed snow.json.
 * Writes HTML + text. Optional screenshots if playwright-core is installed.
 * Never sends unless: --send AND RESEND_API_KEY AND recipient is baileybusch@gmail.com.
 *
 *   npm run email:preview
 *   node scripts/email-preview.mjs --send --to baileybusch@gmail.com
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rankRecap, evaluateAlerts } from '../lib/evaluateAlerts.js';
import { stormAlertEmail, recapEmail, situationEmail, combinedEmail } from '../lib/emails.js';
import { canSendEmail, sendEmail } from '../api/_lib.js';
import { writeReadout, deterministicReadout } from '../lib/readout.js';
import { loadCatalog } from '../lib/skiscope-tools/index.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'tmp', 'email-preview');
const TEST_ONLY = 'baileybusch@gmail.com';

function load(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function demoAlert(snow, index) {
  const catalog = { ...snow, index };
  const { incoming } = rankRecap(catalog, { limit: 8 });
  const { alerts } = evaluateAlerts([{
    id: 'rul_preview',
    email: TEST_ONLY,
    status: 'active',
    watch: 'pass',
    pass: 'both',
    minSnowIn: 6,
    windowHours: 168,
    tier: 'free',
  }], catalog, new Date(snow.dates[snow.today] + 'T18:00:00-07:00'));
  if (alerts[0]) {
    alerts[0].affected = alerts[0].affected.map(row => {
      const meta = index.find(r => r.id === row.resortId) || {};
      return { ...row, iata: meta.iata, center: meta.center, region: meta.region };
    });
    const leadMeta = index.find(r => r.id === alerts[0].lead.resortId) || {};
    alerts[0].lead = { ...alerts[0].lead, iata: leadMeta.iata, center: leadMeta.center };
    return alerts[0];
  }
  const lead = incoming[0] || { id: 'alta', name: 'Alta', incomingIn: 8, strip: [] };
  return {
    subject: `Storm incoming: ${lead.name} +${Math.round(lead.incomingIn || 8)}" forecast`,
    lead: { resortId: lead.id, resortName: lead.name, snowIn: lead.incomingIn || 8, past72In: lead.past72In || 0, startDay: snow.dates[(snow.today || 0) + 1], strip: lead.strip, iata: index.find(r => r.id === lead.id)?.iata, center: index.find(r => r.id === lead.id)?.center },
    affected: incoming.slice(0, 5).map(r => ({
      resortId: r.id, resortName: r.name, snowIn: r.incomingIn, past72In: r.past72In || 0, startDay: r.strip?.[0]?.date, strip: r.strip, region: r.region,
    })),
  };
}

async function screenshot(htmlPath, pngPath) {
  try {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('file://' + htmlPath, { waitUntil: 'load' });
    await page.screenshot({ path: pngPath, fullPage: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

const args = new Set(process.argv.slice(2));
const send = args.has('--send');
const toArg = process.argv.includes('--to') ? process.argv[process.argv.indexOf('--to') + 1] : '';

const snow = load('public/data/snow.json');
const index = load('public/data/resorts-index.json');
const catalog = { ...snow, index };
const tools = loadCatalog();
const ranked = rankRecap(catalog, { limit: 5 });
const sponsor = { on: true, example: true };
const demo = demoAlert(snow, index);
const readout = await writeReadout({
  type: 'resort', event: 'storm', resortId: demo.lead?.resortId, resortName: demo.lead?.resortName, subject: demo.subject,
}, { catalog: tools });
const templateReadout = { ...readout, text: deterministicReadout({ type: 'resort', event: 'storm', resortName: demo.lead?.resortName }, readout.facts), mode: 'deterministic' };
const alert = situationEmail({ alert: demo, readout, token: 'previewtoken00000000000000000000', email: TEST_ONLY, sponsor });
const alertTemplate = situationEmail({ alert: demo, readout: templateReadout, token: 'previewtoken00000000000000000000', email: TEST_ONLY, sponsor });
const recap = recapEmail({ recent: ranked.recent, incoming: ranked.incoming, token: 'previewtoken00000000000000000000', kind: 'weekly', email: TEST_ONLY, sponsor });
const last = recapEmail({ recent: ranked.recent, incoming: ranked.incoming, token: 'previewtoken00000000000000000000', kind: 'last-storm', email: TEST_ONLY, sponsor });
const regionDemo = { type: 'region', region: 'japan', subject: 'Situation detected in Japan', facts: { where: 'Japan', rows: ranked.incoming.slice(0, 5).map(r => ({ id: r.id, name: r.name, past72: r.past72In, next7: r.incomingIn })) }, affected: ranked.incoming.slice(0, 5).map(r => ({ resortId: r.id, resortName: r.name, past72In: r.past72In, next7In: r.incomingIn })) };
const regionRo = await writeReadout({ type: 'region', region: 'japan' }, { catalog: tools });
const region = situationEmail({ alert: regionDemo, readout: regionRo, token: 'previewtoken00000000000000000000', email: TEST_ONLY, sponsor });
const combined = combinedEmail({
  pack: { email: TEST_ONLY, events: [demo, regionDemo], subject: 'Situation detected: two watches' },
  readouts: [readout, regionRo],
  token: 'previewtoken00000000000000000000',
  email: TEST_ONLY,
  sponsor,
});

mkdirSync(outDir, { recursive: true });
const files = {
  'storm-alert.html': alert.html,
  'storm-alert.txt': alert.text,
  'storm-alert-template.html': alertTemplate.html,
  'recap.html': recap.html,
  'recap.txt': recap.text,
  'last-storm.html': last.html,
  'region-alert.html': region.html,
  'combined-alert.html': combined.html,
};
for (const [name, body] of Object.entries(files)) writeFileSync(join(outDir, name), body);
writeFileSync(join(outDir, 'subjects.json'), JSON.stringify({ alert: alert.subject, recap: recap.subject, lastStorm: last.subject }, null, 2));

console.log(`wrote ${outDir}`);
console.log(`  alert  ${alert.subject}`);
console.log(`  recap  ${recap.subject}`);

let shots = 0;
if (await screenshot(join(outDir, 'storm-alert.html'), join(outDir, 'storm-alert.png'))) shots++;
if (await screenshot(join(outDir, 'recap.html'), join(outDir, 'recap.png'))) shots++;
console.log(shots ? `  screenshots ${shots}` : '  screenshots skipped (no playwright-core)');

if (send) {
  const to = String(toArg || '').toLowerCase().trim();
  if (to !== TEST_ONLY) {
    console.error('refused: test send is only allowed to baileybusch@gmail.com');
    process.exit(2);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('refused: RESEND_API_KEY is not set');
    process.exit(2);
  }
  if (!canSendEmail(to, { forceTest: true })) {
    console.error('refused: address not allowlisted for a paused send');
    process.exit(2);
  }
  const which = args.has('--recap') ? recap : alert;
  const result = await sendEmail({ to, subject: `[preview] ${which.subject}`, html: which.html, text: which.text, unsubscribeUrl: which.unsubscribeUrl, forceTest: true });
  console.log(result.skipped ? `send skipped: ${result.skipped}` : `send status ${result.status}`);
}

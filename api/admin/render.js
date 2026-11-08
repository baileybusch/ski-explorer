import { saveSub, findByEmail, confirmEmail, digestEmail, loadData, allActive } from '../_lib.js';
import { ADMIN_COOKIE, adminCookieHeader, passwordOk, signAdminSession, verifyAdminSession } from '../../lib/adminAuth.js';
import { readCookie, csrfOk } from '../../lib/authToken.js';
import { clientIp, rateLimit } from '../../lib/agent/rateLimit.js';
import { buildDashboard, chatsCsv, demoEvents, subscribersCsv } from '../../lib/insights.js';
import { insightsEnv, readEvents } from '../../lib/insightsStore.js';
import { loadCatalog } from '../../lib/skiscope-tools/index.js';

/**
 * Two admin surfaces in one function (Hobby 12-function cap):
 *   /api/admin/render?email=…   Bearer CRON_SECRET; renders confirm + digest for an allowlisted subscriber.
 *   /api/admin?action=…         (rewritten here with surface=dashboard) the /admin insights dashboard:
 *     POST login {password} → HttpOnly cookie · POST logout · GET dashboard[&demo=1][&days=N]
 *     GET export&kind=subscribers|chats&audience=internal|partners[&demo=1] → CSV
 * Demo data is seeded fake events (demo+N@example.com), never mixed with real ones.
 */
async function legacyRender(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  const email = String(req.query.email || '').toLowerCase();
  const allow = (process.env.DIGEST_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(email)) return res.status(403).json({ error: 'not allowlisted' });
  const sub = await findByEmail(email);
  if (!sub) return res.status(404).json({ error: 'no subscription' });
  if (req.query.setFreq === 'weekly' || req.query.setFreq === 'daily') { sub.freq = req.query.setFreq; await saveSub(sub); }
  const data = await loadData();
  const d = digestEmail({ data, followIds: sub.resorts || [], token: sub.token, freq: sub.freq || 'daily' });
  res.json({ status: sub.status, freq: sub.freq, confirm: { subject: 'Confirm your SkiScope snow alerts', html: confirmEmail(sub) }, digest: d });
}

export function isAdmin(req) {
  return verifyAdminSession(readCookie(req.headers?.cookie, ADMIN_COOKIE), process.env.ADMIN_PASSWORD);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

function names() {
  const cat = loadCatalog();
  return Object.fromEntries([...(cat.resorts || []), ...(cat.regions || [])].map(x => [x.id, x.name]));
}

/** Account-level Do Not Sell flags live on subscriber records too; exports honor either source. */
async function accountOptOuts() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return new Set();
  const subs = await allActive().catch(() => []);
  return new Set(subs.filter(s => s?.prefs?.doNotSell === true).map(s => s.email));
}

async function dashboardData(req) {
  const demo = req.query.demo === '1';
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const events = demo ? demoEvents() : await readEvents({ days: 90 });
  const dash = buildDashboard(events, { days, names: names() });
  if (!demo) {
    const optOut = await accountOptOuts();
    for (const s of dash.subscribers) if (optOut.has(s.email)) s.doNotSell = true;
    dash.totals.doNotSell = dash.subscribers.filter(s => s.doNotSell).length;
  }
  return { demo, events, dash };
}

async function dashboard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query.action || 'dashboard');
  const secure = process.env.VERCEL === '1';

  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
    if (!csrfOk(req)) return res.status(403).json({ error: 'Bad origin' });
    if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORD is not configured' });
    if (!rateLimit(`admin:${clientIp(req)}`).ok) return res.status(429).json({ error: 'Too many attempts' });
    const { password } = await readBody(req);
    if (!passwordOk(password, process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Wrong password' });
    res.setHeader('Set-Cookie', adminCookieHeader(signAdminSession(process.env.ADMIN_PASSWORD), { secure }));
    return res.status(200).json({ ok: true });
  }
  if (action === 'logout') {
    res.setHeader('Set-Cookie', adminCookieHeader('', { secure, clear: true }));
    return res.status(200).json({ ok: true });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sign in required' });

  if (action === 'dashboard') {
    const { demo, dash } = await dashboardData(req);
    return res.status(200).json({ ...dash, demo, env: insightsEnv(), store: process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'memory' });
  }
  if (action === 'export') {
    const { demo, events, dash } = await dashboardData(req);
    const partners = req.query.audience === 'partners';
    const kind = req.query.kind === 'chats' ? 'chats' : 'subscribers';
    const optedOut = new Set([
      ...dash.subscribers.filter(s => s.doNotSell).map(s => s.email),
      ...events.filter(e => e.type === 'dns' && e.optOut && e.sid).map(e => e.sid),
    ]);
    for (const e of events) if (e.sid && e.email && optedOut.has(e.email)) optedOut.add(e.sid);
    const csv = kind === 'chats' ? chatsCsv(events, { partners, optedOut }) : subscribersCsv(dash, { partners });
    const name = `${demo ? 'demo-' : ''}${kind}-${partners ? 'partners' : 'internal'}-${dash.generatedAt.slice(0, 10)}.csv`;
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${name}"`);
    return res.status(200).send(csv);
  }
  return res.status(400).json({ error: 'Unknown action' });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.query.surface === 'dashboard') return dashboard(req, res);
  return legacyRender(req, res);
}

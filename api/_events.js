/**
 * POST /api/events  { sid, events: [{ type, ... }] }
 *
 * Browser-side funnel events. Only low-trust types are accepted here: offer shown/dismissed,
 * Do Not Sell opt-outs, and (outside production) preview signups that never reach the server
 * store. Session→email links and real signups are written server-side by subscribe/auth.
 */
import { rateLimit, clientIp } from '../lib/agent/rateLimit.js';
import { csrfOk } from '../lib/authToken.js';
import { recordEvents, insightsEnv } from '../lib/insightsStore.js';
import { sessionEmail } from './_ask.js';

const CLIENT_TYPES = new Set(['offer', 'dns', 'signup']);

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  if (!csrfOk(req)) return res.status(403).json({ error: 'Bad origin' });
  if (!rateLimit(`events:${clientIp(req)}`).ok) return res.status(429).json({ error: 'Slow down' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = sessionEmail(req);
  const preview = insightsEnv() !== 'production';
  const raws = (Array.isArray(body.events) ? body.events : []).slice(0, 10)
    .filter(e => e && CLIENT_TYPES.has(e.type))
    .filter(e => e.type !== 'signup' || preview)
    .map(e => ({
      ...e,
      sid: body.sid,
      email: e.type === 'signup' ? e.email : email,
      preview: e.type === 'signup' ? true : undefined,
      trusted: false,
    }));
  const durable = raws.some(e => e.type === 'dns' || e.type === 'signup');
  const saved = await recordEvents(raws, { durable });
  return res.status(200).json({ ok: true, recorded: saved.length });
}

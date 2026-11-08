/**
 * POST /api/ask  { messages: UIMessage[], units?, board?: { pass, regionId, observedOnly }, snapshot?, sid?, offer? }
 *   →  UI message stream (SSE)
 *
 * Ask SkiScope chat. Gateway model with tools when available; deterministic planner
 * otherwise. Over the per-IP limit we skip the model (free path) instead of erroring.
 * Each question is logged for insights (lib/insights.js) with the anonymous session id and,
 * when signed in, the account email.
 */
import { pipeUIMessageStreamToResponse } from 'ai';
import { clientIp, rateLimit } from '../lib/agent/rateLimit.js';
import { askLlmEnabled, askStream } from '../lib/ask/server.js';
import { loadCatalog } from '../lib/skiscope-tools/index.js';
import { cleanBoardScope, cleanObservedSnapshot, withObservedSnapshot } from '../lib/boardRank.js';
import { getObserved } from './_observed.js';
import { lastUserText } from '../lib/ask/answer.js';
import { OFFER_TOOL } from '../lib/ask/offer.js';
import { inferInterests } from '../lib/insights.js';
import { recordEvents } from '../lib/insightsStore.js';
import { SESSION_COOKIE, readCookie, verifyAuthToken } from '../lib/authToken.js';

export function sessionEmail(req) {
  const raw = readCookie(req.headers?.cookie, SESSION_COOKIE);
  if (!raw) return null;
  try {
    const v = verifyAuthToken(raw, undefined, { purpose: 'session' });
    return v.ok ? v.email : null;
  } catch {
    return null;
  }
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && Array.isArray(m.parts))
    .slice(-12)
    .map(m => ({
      ...m,
      parts: m.parts
        .filter(p => p?.type !== `tool-${OFFER_TOOL}`)
        .map(p => (p?.type === 'text' ? { ...p, text: String(p.text || '').slice(0, 2000) } : p)),
    }))
    .filter(m => m.parts.length);
}

/**
 * The catalog as the asking board sees it: the observed snapshot the client ranked
 * (it may predate this instance's cache), else the same source /api/observed serves.
 */
export async function boardCatalog(body = {}) {
  const base = loadCatalog();
  let snap = cleanObservedSnapshot(body.snapshot, base.resorts);
  if (!snap) {
    try {
      const live = await getObserved();
      snap = { fetched: live.fetched || null, source: live.source || null, observed: live.resorts || {} };
    } catch { /* committed snapshot already in base */ }
  }
  return { ...withObservedSnapshot(base, snap), board: cleanBoardScope(body.board) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const messages = cleanMessages(body.messages);
  const units = body.units === 'cm' ? 'cm' : 'in';
  const lim = rateLimit(`ask:${clientIp(req)}`);
  const useModel = askLlmEnabled() && lim.ok;
  if (!useModel) console.info(`[ask] deterministic (${lim.ok ? 'gateway not configured' : 'rate limited'})`);

  const cat = await boardCatalog(body);
  const q = lastUserText(messages);
  if (q) {
    recordEvents({ type: 'chat', q, sid: body.sid, email: sessionEmail(req), mode: useModel ? 'llm' : 'fallback', ...inferInterests(q, cat) })
      .catch(err => console.warn('[ask] insights', err?.message || err));
  }
  const ac = new AbortController();
  req.on?.('close', () => ac.abort());
  await pipeUIMessageStreamToResponse({
    response: res,
    stream: askStream({ messages, cat, units, useModel, signal: ac.signal, offer: body.offer }),
    headers: { 'Cache-Control': 'no-store' },
  });
}

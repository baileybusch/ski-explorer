/**
 * POST /api/agent
 *
 * Streaming NDJSON:
 *   { type: "status", text }
 *   { type: "done", mode: "deterministic"|"llm", parsed, actions }
 *
 * Always runs the deterministic parser. Tries the LLM loop only when
 * AI Gateway auth is present (OIDC on Vercel, or AI_GATEWAY_API_KEY).
 * Email code in the other /api files is untouched.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clientIp, rateLimit } from '../lib/agent/rateLimit.js';
import { llmAvailable, runDeterministic, runLlm } from '../lib/agent/runAgent.js';

function load(name) {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/data', name), 'utf8'));
}

let cache;
function catalog() {
  if (cache) return cache;
  const resorts = load('resorts-index.json');
  const snow = load('snow.json');
  const gazetteer = load('gazetteer.json');
  let typical = { windows: {} };
  try { typical = load('typical.json'); } catch { /* optional */ }
  let history = { resorts: {} };
  try { history = load('history.json'); } catch { /* optional */ }
  cache = { resorts, snow, typical, history, regions: gazetteer.regions || [], today: snow.dates[snow.today] };
  return cache;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const lim = rateLimit(clientIp(req));
  if (!lim.ok) {
    res.setHeader('Retry-After', String(lim.retryAfter));
    return res.status(429).json({ error: 'Slow down — try again in a few minutes.' });
  }

  const text = String(req.body?.text || '').slice(0, 400).trim();
  if (!text) return res.status(400).json({ error: 'Missing text' });

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = obj => res.write(JSON.stringify(obj) + '\n');

  const ctx = { ...catalog(), pass: req.body?.pass || 'ikon' };
  const det = runDeterministic(text, ctx);
  send({ type: 'status', text: 'Parsed trip.', mode: 'deterministic' });

  if (!llmAvailable()) {
    send({ type: 'done', ...det, llm: false });
    return res.end();
  }

  send({ type: 'status', text: 'Checking snow with the agent…', mode: 'llm' });
  try {
    const out = await runLlm(text, ctx, det.parsed);
    send({ type: 'done', ...out, llm: true });
  } catch (err) {
    send({ type: 'status', text: 'Agent unavailable — using the local parser.' });
    send({ type: 'done', ...det, llm: false, error: String(err.message || err) });
  }
  return res.end();
}

/**
 * POST /api/search  { text, pass, units }
 * GET  /api/search?q=Japan
 *
 * Deterministic parser first. LLM refine only when Gateway auth exists.
 * Results come from executeTool, not a direct snow.json read.
 */
import { clientIp, rateLimit } from '../lib/agent/rateLimit.js';
import { runSearch, runSearchMaybeLlm } from '../lib/searchQuery.js';
import { loadCatalog } from '../lib/skiscope-tools/index.js';

const cache = new Map();
const CACHE_MS = 120_000;

function norm(q) {
  return String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

  const lim = rateLimit(`search:${clientIp(req)}`);
  if (!lim.ok) {
    res.setHeader('Retry-After', String(lim.retryAfter));
    return res.status(429).json({ error: 'Slow down — try again in a few minutes.' });
  }

  const text = String(req.method === 'GET' ? (req.query?.q || req.query?.text) : (req.body?.text || req.body?.q || '')).slice(0, 400).trim();
  if (!text) return res.status(400).json({ error: 'Missing text' });
  const pass = req.method === 'GET' ? req.query?.pass : req.body?.pass;
  const units = req.method === 'GET' ? req.query?.units : req.body?.units;
  const key = `${norm(text)}|${pass || ''}|${units || 'in'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ ...hit.value, cached: true });
  }

  const catalog = loadCatalog();
  const ctx = { catalog, pass, units: units || 'in', today: catalog.asOf };
  const out = req.method === 'GET'
    ? runSearch(text, ctx)
    : await runSearchMaybeLlm(text, ctx);
  cache.set(key, { at: Date.now(), value: out });
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  return res.status(200).json(out);
}

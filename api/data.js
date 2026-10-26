/**
 * Public JSON API — same tools as MCP, no subscriber data.
 * GET /api/data?tool=get_leaderboard&region=japan&units=in
 */
import { clientIp, rateLimit } from '../lib/agent/rateLimit.js';
import { executeTool, TOOL_NAMES, loadCatalog } from '../lib/skiscope-tools/index.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const lim = rateLimit(`data:${clientIp(req)}`);
  if (!lim.ok) {
    res.setHeader('Retry-After', String(lim.retryAfter));
    return res.status(429).json({ error: 'Slow down' });
  }

  const q = req.query || {};
  const name = String(q.tool || q.name || '');
  if (!TOOL_NAMES.includes(name)) {
    return res.status(400).json({ error: 'unknown tool', tools: TOOL_NAMES });
  }
  const args = { ...q };
  delete args.tool;
  delete args.name;
  if (args.limit) args.limit = Number(args.limit);
  if (args.days) args.days = Number(args.days);
  if (args.ids) args.ids = String(args.ids).split(',').map(s => s.trim()).filter(Boolean);
  const out = executeTool(name, args, loadCatalog());
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
  return res.status(out.ok ? 200 : 400).json(out);
}

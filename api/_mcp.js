/**
 * POST /api/mcp — MCP Streamable HTTP (JSON-RPC).
 * GET  /api/mcp — server info for humans + Claude install checks.
 */
import { clientIp, rateLimit } from '../lib/agent/rateLimit.js';
import { handleMcpBody, mcpTools, SERVER, PROTOCOL } from '../lib/mcp.js';
import { loadCatalog } from '../lib/skiscope-tools/index.js';

const cache = new Map();
const CACHE_MS = 60_000;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

function cachedCall(body) {
  if (!body || body.method !== 'tools/call') return null;
  const key = JSON.stringify({ name: body.params?.name, arguments: body.params?.arguments || {} });
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  return null;
}

function remember(body, value) {
  if (body?.method === 'tools/call' && value && !value.error) {
    const key = JSON.stringify({ name: body.params?.name, arguments: body.params?.arguments || {} });
    cache.set(key, { at: Date.now(), value });
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      name: SERVER.name,
      version: SERVER.version,
      protocolVersion: PROTOCOL,
      transport: 'streamable-http',
      tools: mcpTools().map(t => t.name),
      install: 'claude mcp add --transport http skiscope https://skiscope.vercel.app/api/mcp',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'GET or POST' });
  }

  const lim = rateLimit(`mcp:${clientIp(req)}`);
  if (!lim.ok) {
    res.setHeader('Retry-After', String(lim.retryAfter));
    return res.status(429).json({ error: 'Slow down — try again in a few minutes.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.method === 'notifications/initialized') return res.status(202).end();

  const hit = cachedCall(body);
  const catalog = loadCatalog();
  const out = hit || handleMcpBody(body, catalog);
  if (!hit) remember(body, out);
  if (out?.notification) return res.status(202).end();

  const accept = String(req.headers.accept || '');
  const payload = Array.isArray(out) ? out.filter(x => !x.notification) : out;
  if (accept.includes('text/event-stream') && !accept.includes('application/json')) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) res.write(`event: message\ndata: ${JSON.stringify(row)}\n\n`);
    return res.end();
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  return res.status(200).json(payload);
}

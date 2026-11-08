/**
 * One Hobby-safe function for the three public tool-layer surfaces:
 *   /api/mcp    MCP Streamable HTTP
 *   /api/search AI / deterministic search
 *   /api/data   public JSON tools
 *   /api/ask    Ask SkiScope chat (AI SDK UI message stream)
 *   /api/events funnel insight events from the browser
 *
 * vercel.json rewrites those paths here (?surface=).
 */
import mcp from './_mcp.js';
import search from './_search.js';
import data from './_data.js';
import observed from './_observed.js';
import ask from './_ask.js';
import events from './_events.js';

export default async function handler(req, res) {
  const surface = String(req.query?.surface || '').toLowerCase();
  const path = String(req.url || '');
  if (surface === 'ask' || path.startsWith('/api/ask')) return ask(req, res);
  if (surface === 'events' || path.startsWith('/api/events')) return events(req, res);
  if (surface === 'mcp' || path.startsWith('/api/mcp')) return mcp(req, res);
  if (surface === 'search' || path.startsWith('/api/search')) return search(req, res);
  if (surface === 'observed' || path.startsWith('/api/observed')) return observed(req, res);
  return data(req, res);
}

/**
 * One Hobby-safe function for the three public tool-layer surfaces:
 *   /api/mcp    MCP Streamable HTTP
 *   /api/search AI / deterministic search
 *   /api/data   public JSON tools
 *
 * vercel.json rewrites those paths here (?surface=).
 */
import mcp from './_mcp.js';
import search from './_search.js';
import data from './_data.js';

export default async function handler(req, res) {
  const surface = String(req.query?.surface || '').toLowerCase();
  const path = String(req.url || '');
  if (surface === 'mcp' || path.startsWith('/api/mcp')) return mcp(req, res);
  if (surface === 'search' || path.startsWith('/api/search')) return search(req, res);
  return data(req, res);
}

/**
 * Single entrypoint for the `api` Vercel Service.
 *
 * With Vercel Services configured, the zero-config `api/` directory is not
 * built ("api_dir_ignored"), so every /api/* path 404'd after the eve merge.
 * vercel.ts routes ^/api/* to this one function, which dispatches to the
 * existing handlers (same (req, res) signature) and applies the old
 * /api/<surface> -> /api/headless?surface=<surface> rewrites.
 *
 * A service entrypoint runs without the @vercel/node request/response helpers
 * (shouldAddHelpers: false), so addHelpers() restores the ones the handlers
 * use: req.query, req.body, req.cookies, res.status/json/send/redirect.
 */
export const config = { maxDuration: 300 };

const HEADLESS_SURFACES = new Set(['mcp', 'search', 'data', 'observed', 'ask', 'events']);

const ROUTES = {
  headless: () => import('./headless.js'),
  agent: () => import('./agent.js'),
  auth: () => import('./auth.js'),
  confirm: () => import('./confirm.js'),
  subscribe: () => import('./subscribe.js'),
  subscription: () => import('./subscription.js'),
  unsubscribe: () => import('./unsubscribe.js'),
  'admin/render': () => import('./admin/render.js'),
  'cron/alerts': () => import('./cron/alerts.js'),
  'cron/digest': () => import('./cron/digest.js'),
  'digest/preview': () => import('./digest/preview.js'),
  'email/preview': () => import('./email/preview.js'),
};

const BODY_LIMIT = 1_000_000;

async function readBody(req) {
  if (req.body !== undefined) return req.body;
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > BODY_LIMIT) break;
    chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (type.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return raw;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

function define(obj, key, value) {
  Object.defineProperty(obj, key, { value, writable: true, configurable: true, enumerable: true });
}

export async function addHelpers(req, res, url) {
  if (!req.query || typeof req.query !== 'object') {
    const query = {};
    for (const [k, v] of url.searchParams) {
      query[k] = k in query ? [].concat(query[k], v) : v;
    }
    define(req, 'query', query);
  }
  if (!req.cookies) define(req, 'cookies', parseCookies(req.headers.cookie));
  if (req.body === undefined) define(req, 'body', await readBody(req));
  if (typeof res.status !== 'function') {
    res.status = code => { res.statusCode = code; return res; };
  }
  if (typeof res.send !== 'function') {
    res.send = body => {
      if (body === undefined || body === null) { res.end(); return res; }
      if (Buffer.isBuffer(body)) {
        if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
        res.end(body);
        return res;
      }
      if (typeof body === 'object') return res.json(body);
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(String(body));
      return res;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = body => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
      return res;
    };
  }
  if (typeof res.redirect !== 'function') {
    res.redirect = (a, b) => {
      const [code, loc] = typeof a === 'number' ? [a, b] : [307, a];
      res.statusCode = code;
      res.setHeader('Location', loc);
      res.end();
      return res;
    };
  }
}

function setQuery(req, extra) {
  const query = { ...(req.query || {}), ...extra };
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true, enumerable: true });
}

/** Map a request path to { key, extraQuery }; exported for tests. */
export function resolveApiRoute(pathname) {
  const p = String(pathname || '').replace(/^\/api\/?/, '').replace(/\/+$/, '').replace(/\.js$/, '');
  if (HEADLESS_SURFACES.has(p)) return { key: 'headless', extra: { surface: p } };
  if (p.startsWith('mcp/')) return { key: 'headless', extra: { surface: 'mcp' } };
  if (p === 'admin') return { key: 'admin/render', extra: { surface: 'dashboard' } };
  if (ROUTES[p]) return { key: p, extra: {} };
  return null;
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const route = resolveApiRoute(url.pathname);
  if (!route) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }
  await addHelpers(req, res, url);
  if (Object.keys(route.extra).length) setQuery(req, route.extra);
  const mod = await ROUTES[route.key]();
  return mod.default(req, res);
}

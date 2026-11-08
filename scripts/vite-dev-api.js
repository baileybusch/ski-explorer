/**
 * Dev-only: mount the serverless handlers that need no secrets on the Vite dev server so the
 * funnel (events, /admin, email previews, OG cards) works under `npm run dev` and Playwright.
 * /api/ask stays on the in-browser fallback unless DEV_API_ASK=1.
 *
 * /admin needs ADMIN_PASSWORD. When it is unset in dev a random one is generated per server
 * start and written to tmp/.admin-dev-password (gitignored) for local login and tests.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const ROUTES = [
  { prefix: '/api/events', module: '/api/_events.js' },
  { prefix: '/api/admin/render', module: '/api/admin/render.js' },
  { prefix: '/api/admin', module: '/api/admin/render.js', query: { surface: 'dashboard' } },
  { prefix: '/api/email/preview', module: '/api/email/preview.js' },
];

function shim(req, res, query) {
  const url = new URL(req.url, 'http://localhost');
  req.query = { ...Object.fromEntries(url.searchParams), ...query };
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => {
    if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = body => { res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); return res; };
  res.redirect = (code, to) => { res.statusCode = typeof code === 'number' ? code : 302; res.setHeader('location', to || code); res.end(); return res; };
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return raw; }
}

export function devApi() {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      process.env.VERCEL_ENV ||= 'development';
      if (!process.env.ADMIN_PASSWORD) {
        process.env.ADMIN_PASSWORD = randomBytes(12).toString('base64url');
        mkdirSync('tmp', { recursive: true });
        writeFileSync('tmp/.admin-dev-password', process.env.ADMIN_PASSWORD, { mode: 0o600 });
      }
      const routes = process.env.DEV_API_ASK === '1' ? [...ROUTES, { prefix: '/api/ask', module: '/api/_ask.js' }] : ROUTES;
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] || '';
        if (path.startsWith('/og/') && path.endsWith('.png')) {
          try {
            const { renderOgPng, ogPages } = await server.ssrLoadModule('/scripts/og.js');
            const page = ogPages().find(p => `/og/${p.slug}.png` === path);
            if (!page) return next();
            res.setHeader('content-type', 'image/png');
            res.end(await renderOgPng(page));
          } catch (err) {
            next(err);
          }
          return;
        }
        const route = routes.find(r => path === r.prefix || path === `${r.prefix}/`);
        if (!route) return next();
        try {
          shim(req, res, route.query);
          req.body = await readBody(req);
          const mod = await server.ssrLoadModule(route.module);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[dev-api] ${path}: ${err?.stack || err}`);
          if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: 'dev api error' })); }
        }
      });
    },
  };
}

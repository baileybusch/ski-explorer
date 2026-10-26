/**
 * Guard the SPA rewrite fix: cleanUrls + destination /index.html 404s
 * because Vercel treats /index.html as /index.
 */
import { readFileSync } from 'node:fs';

const REQUIRED = ['/manage', '/about', '/privacy', '/terms', '/disclosure', '/contact'];

export function runSpaRouteEvals() {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const lines = [];
  let fail = 0;

  function check(id, ok, detail = '') {
    if (ok) lines.push(`ok    ${id}`);
    else {
      fail++;
      lines.push(`FAIL  ${id}  ${detail}`);
    }
  }

  check('clean-urls-on', vercel.cleanUrls === true, `cleanUrls=${vercel.cleanUrls}`);
  const dests = (vercel.rewrites || []).map(r => r.destination);
  check('no-index-html', dests.every(d => d !== '/index.html'), `destinations ${dests.join(',')}`);
  check('dest-slash', dests.every(d => d === '/'), `destinations ${dests.join(',')}`);
  const sources = new Set((vercel.rewrites || []).map(r => r.source.replace(/\/$/, '')));
  for (const path of REQUIRED) {
    check(`rewrite-${path.slice(1)}`, sources.has(path), `missing rewrite for ${path}`);
  }
  check('manage-menu-path', true);

  return { fail, total: lines.length, lines };
}

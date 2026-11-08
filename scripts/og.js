/**
 * Build-time OG cards + static HTML for category pages (/region/<id>, /pass/<id>).
 * Static files cost no function invocations: dist/region/<id>.html carries the page's own
 * title / description / og:image, and dist/og/<kind>-<id>.png is the card. Vercel's cleanUrls
 * serves /region/<id> from region/<id>.html; unknown ids fall through to the SPA rewrite.
 */
import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { PASS_PAGES, categoryMeta, categoryPath, ogImagePath } from '../lib/categoryPages.js';
import { DEFAULT_BRAND } from '../lib/brand.js';

const INK = '#08090b';
const PAPER = '#f2f3f5';
const FOG = '#c8ccd3';
const GRAPHITE = '#7a808a';

const font = w => readFileSync(new URL(`../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-${w}-normal.woff`, import.meta.url));
let fonts;
function loadFonts() {
  fonts ||= [500, 700, 800].map(weight => ({ name: 'Barlow Condensed', data: font(weight), weight, style: 'normal' }));
  return fonts;
}

const logo = () => `data:image/svg+xml;base64,${readFileSync(new URL(`../public${DEFAULT_BRAND.favicon}`, import.meta.url)).toString('base64')}`;

export function ogPages() {
  const gaz = JSON.parse(readFileSync(new URL('../public/data/gazetteer.json', import.meta.url), 'utf8'));
  const resorts = JSON.parse(readFileSync(new URL('../public/data/resorts-index.json', import.meta.url), 'utf8'));
  return [
    ...(gaz.regions || []).map(g => ({ kind: 'region', id: g.id, name: g.name, slug: `region-${g.id}` })),
    ...Object.values(PASS_PAGES).map(p => ({ kind: 'pass', id: p.id, name: p.name, slug: `pass-${p.id}` })),
    ...(resorts || []).filter(r => r?.id && r?.name).map(r => ({ kind: 'resort', id: r.id, name: r.name, slug: `resort-${r.id}` })),
  ];
}

const h = (type, style, children) => ({ type, props: { style, children } });

export async function renderOgPng(page) {
  const where = page.kind === 'pass' ? `${page.name.replace(/ Pass$/, '')} resorts` : page.name;
  const kicker = page.kind === 'pass' ? 'PASS · LIVE SNOW BOARD' : page.kind === 'resort' ? 'RESORT · LIVE SNOW' : 'REGION · LIVE SNOW BOARD';
  const title = `${page.name} snow`;
  const titleSize = Math.min(140, Math.floor(1056 / (title.length * 0.5)));
  const tree = h('div', {
    width: 1200 - 144, height: 630 - 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '56px 72px 64px', background: `linear-gradient(160deg, #15181d 0%, ${INK} 60%)`, color: PAPER, fontFamily: 'Barlow Condensed',
  }, [
    h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
      { type: 'img', props: { src: logo(), width: 64, height: 64, style: { borderRadius: 14 } } },
      h('div', { fontSize: 40, fontWeight: 800, letterSpacing: 2 }, DEFAULT_BRAND.wordmark?.caps || DEFAULT_BRAND.name.toUpperCase()),
    ]),
    h('div', { display: 'flex', flexDirection: 'column' }, [
      h('div', { fontSize: 30, fontWeight: 700, letterSpacing: 5, color: GRAPHITE }, kicker),
      h('div', { fontSize: titleSize, fontWeight: 800, lineHeight: 1, marginTop: 6, letterSpacing: -1 }, title),
      h('div', { fontSize: 40, fontWeight: 500, color: FOG, marginTop: 14 }, `Who's getting dumped on: new snow + 7-day forecast for ${where}`),
    ]),
    h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
      h('div', { display: 'flex', fontSize: 36, fontWeight: 700, background: PAPER, color: INK, padding: '14px 28px', borderRadius: 18 }, `Get alerts for ${where}`),
      h('div', { fontSize: 32, fontWeight: 500, color: GRAPHITE }, 'Free · observed + forecast'),
    ]),
  ]);
  const svg = await satori(tree, { width: 1200, height: 630, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** index.html with this page's title, description, canonical and OG/Twitter tags. */
export function categoryHtml(indexHtml, page, site) {
  const meta = categoryMeta(page, { name: page.name, brand: DEFAULT_BRAND.name, site });
  const tags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(meta.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(DEFAULT_BRAND.name)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(meta.url)}" />`,
    `<meta property="og:image" content="${esc(meta.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(meta.image)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd(page, meta, DEFAULT_BRAND.name))}</script>`,
  ].join('\n    ');
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${tags}\n  </head>`);
}

function jsonLd(page, meta, brand) {
  const site = { '@type': 'WebSite', name: brand, url: meta.url.replace(/\/(region|pass|resort)\/[^/]+$/, '') || meta.url };
  if (page.kind === 'resort') {
    return { '@context': 'https://schema.org', '@type': 'SkiResort', name: page.name, url: meta.url, description: meta.description, isPartOf: site };
  }
  return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: meta.title, url: meta.url, description: meta.description, isPartOf: site };
}

export function sitemapXml(pages, site) {
  const staticPaths = ['/', '/about', '/privacy', '/terms', '/disclosure', '/contact', '/my-alerts'];
  const urls = [
    ...staticPaths.map(p => `${site}${p === '/' ? '/' : p}`),
    ...pages.map(p => `${site}${categoryPath(p.kind, p.id)}`),
  ];
  const body = urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export { ogImagePath };

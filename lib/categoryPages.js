/**
 * Shareable category pages: /region/<gazetteer id> and /pass/<ikon|epic>.
 * Shared by the SPA (routing, header, CTA) and the build (static HTML with title + OG tags,
 * OG card PNGs at /og/<kind>-<id>.png). Browser-safe: no Node imports.
 */
export const PASS_PAGES = {
  ikon: { id: 'ikon', name: 'Ikon Pass', short: 'Ikon' },
  epic: { id: 'epic', name: 'Epic Pass', short: 'Epic' },
};

/** Footer + cross-links. Every gazetteer region also gets a page; these are the featured ones. */
export const CATEGORY_LINKS = [
  { path: '/region/california', label: 'California' },
  { path: '/region/utah', label: 'Utah' },
  { path: '/region/colorado', label: 'Colorado' },
  { path: '/region/japan', label: 'Japan' },
  { path: '/region/alps', label: 'Alps' },
  { path: '/region/british-columbia', label: 'British Columbia' },
  { path: '/pass/ikon', label: 'Ikon' },
  { path: '/pass/epic', label: 'Epic' },
];

const ID_RE = /^[a-z0-9-]{2,40}$/;

/** "/region/california" | "/pass/ikon" | "/resort/alta". Unknown pass ids are rejected; resorts are checked against the catalog in the SPA. */
export function parseCategoryPath(pathname = '') {
  const m = String(pathname).replace(/\/+$/, '').match(/^\/(region|pass|resort)\/([^/]+)$/);
  if (!m) return null;
  const id = decodeURIComponent(m[2]).toLowerCase();
  if (!ID_RE.test(id)) return null;
  if (m[1] === 'pass' && !PASS_PAGES[id]) return null;
  return { kind: m[1], id };
}

export const categoryPath = (kind, id) => `/${kind}/${id}`;
export const ogImagePath = (kind, id) => `/og/${kind}-${id}.png`;

/** Display name; regions resolve against the gazetteer, resorts against the index. */
export function categoryName(page, regions = [], resorts = []) {
  if (!page) return null;
  if (page.kind === 'pass') return PASS_PAGES[page.id]?.name || null;
  if (page.kind === 'resort') return resorts.find(r => r.id === page.id)?.name || null;
  return regions.find(g => g.id === page.id)?.name || null;
}

export function ctaLabel(page, name) {
  if (page?.kind === 'pass') return `Get alerts for ${PASS_PAGES[page.id]?.short || name} resorts`;
  return `Get alerts for ${name}`;
}

/**
 * @param {{ kind: string, id: string }} page
 * @param {{ name: string, brand?: string, site?: string }} opts
 */
export function categoryMeta(page, { name, brand = 'SkiScope', site = '' }) {
  const where = page.kind === 'pass' ? `${name} resorts` : name;
  const title = page.kind === 'resort'
    ? `${name} snow: last 72h and 7-day forecast · ${brand}`
    : `${name} snow: who's getting dumped on · ${brand}`;
  const description = page.kind === 'resort'
    ? `Observed and modeled new snow at ${name}, plus the 7-day forecast. Free email alerts when ${name} gets dumped on.`
    : `Live leaderboard of new snow and the 7-day forecast for ${where}. Free email alerts when ${where} gets dumped on.`;
  return {
    title,
    description,
    heading: `${name} snow`,
    url: `${site}${categoryPath(page.kind, page.id)}`,
    image: `${site}${ogImagePath(page.kind, page.id)}`,
  };
}

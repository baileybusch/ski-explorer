/**
 * Single source for product naming. Client, emails and API helpers read from here.
 * The live site and every server path use DEFAULT_BRAND; other brands are mockups,
 * reachable only in the browser through ?brand=<id> (wordmark variant: ?wordmark=caps|mixed).
 */

/** @typedef {'caps' | 'mixed'} WordmarkVariant */

export const BRANDS = {
  skiscope: {
    id: 'skiscope',
    name: 'SkiScope',
    wordmark: { caps: 'SKISCOPE', mixed: 'SkiScope' },
    wordmarkSplit: 0,
    defaultWordmark: 'caps',
    mark: 'scope',
    title: 'SkiScope · Monitor the snow',
    tagline: 'Monitor the snow',
    emailSender: 'SkiScope',
    favicon: '/logo.svg',
    domain: 'skiscope.vercel.app',
  },
  powtracker: {
    id: 'powtracker',
    name: 'PowTracker',
    wordmark: { caps: 'POWTRACKER', mixed: 'PowTracker' },
    wordmarkSplit: 3,
    defaultWordmark: 'caps',
    mark: 'pow',
    title: 'PowTracker · Where the snow is stacking up',
    tagline: 'Where the snow is stacking up',
    emailSender: 'PowTracker',
    favicon: '/brand/powtracker.svg',
    domain: 'powtracker.com',
  },
};

export const DEFAULT_BRAND_ID = 'skiscope';
export const DEFAULT_BRAND = BRANDS[DEFAULT_BRAND_ID];

export function isBrandId(id) {
  return Object.prototype.hasOwnProperty.call(BRANDS, id);
}

/** Resolve brand + wordmark variant from a query string. Unknown values fall back to the default. */
export function brandFromSearch(search = '') {
  const qs = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const raw = (qs.get('brand') || '').toLowerCase();
  const brand = isBrandId(raw) ? BRANDS[raw] : DEFAULT_BRAND;
  const w = qs.get('wordmark');
  const wordmark = w === 'caps' || w === 'mixed' ? w : brand.defaultWordmark;
  return { brand, wordmark, override: brand.id !== DEFAULT_BRAND_ID || w === 'caps' || w === 'mixed' };
}

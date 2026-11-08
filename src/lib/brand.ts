import { BRANDS, DEFAULT_BRAND, brandFromSearch } from '../../lib/brand.js';

export type Brand = (typeof BRANDS)[keyof typeof BRANDS];
export type WordmarkVariant = 'caps' | 'mixed';

const resolved = brandFromSearch(typeof location !== 'undefined' ? location.search : '');

/** Active brand for this page load. Production is DEFAULT_BRAND unless ?brand= is present. */
export const BRAND: Brand = resolved.brand;
export const WORDMARK: WordmarkVariant = resolved.wordmark as WordmarkVariant;
export const BRAND_OVERRIDE = resolved.override;
export { BRANDS, DEFAULT_BRAND };

/** Brand query params to carry onto internal links so a mockup survives navigation. */
export function brandParams(search = typeof location !== 'undefined' ? location.search : ''): [string, string][] {
  const qs = new URLSearchParams(search);
  return (['brand', 'wordmark'] as const).flatMap(k => {
    const v = qs.get(k);
    return v ? [[k, v] as [string, string]] : [];
  });
}

/** Title + favicon. index.html ships the default brand, so this only touches the DOM on override. */
export function applyBrandToDocument(doc: Document = document) {
  if (!BRAND_OVERRIDE) return;
  doc.title = BRAND.title;
  const icon = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) icon.href = BRAND.favicon;
  doc.documentElement.dataset.brand = BRAND.id;
}

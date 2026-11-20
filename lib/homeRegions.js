/**
 * Home "Browse by region" tiles and the region-scoped chat view (/explore/<id>).
 * Region ids are gazetteer ids, so membership reuses the board's region filter
 * (regionResortIds) and the full board stays at /region/<id>. Browser-safe.
 */
import { regionResortIds, rankBoard } from './boardRank.js';
import { dumpParts } from './dumpScore.js';

export const HOME_REGIONS = [
  { id: 'california', label: 'California' },
  { id: 'utah', label: 'Utah' },
  { id: 'colorado', label: 'Colorado' },
  { id: 'pacific-nw', label: 'PNW' },
  { id: 'british-columbia', label: 'British Columbia' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'japan', label: 'Japan' },
  { id: 'alps', label: 'Alps' },
];

const ID_RE = /^[a-z0-9-]{2,40}$/;
export const explorePath = id => `/explore/${id}`;

/** "/explore/utah" -> "utah"; anything else -> null. */
export function parseExplorePath(pathname = '') {
  const m = String(pathname).replace(/\/+$/, '').match(/^\/explore\/([^/]+)$/);
  if (!m) return null;
  const id = decodeURIComponent(m[1]).toLowerCase();
  return ID_RE.test(id) ? id : null;
}

/** Resorts in a region, most new snow first (same order as the board). */
export function regionRows(region, catalog) {
  if (!region || !catalog) return [];
  const ids = regionResortIds(catalog.resorts || [], region, 'all') || [];
  return rankBoard(catalog.resorts || [], catalog.snow, { pass: 'all', ids, sort: 'actual72' })
    .map(r => ({ r, dump: dumpParts(r, catalog.snow) }));
}

/** Cheap per-tile stat: resort count + the region's top last-72h number (cm). */
export function regionTiles(catalog, list = HOME_REGIONS) {
  const regions = catalog?.regions || [];
  return list
    .map(t => {
      const region = regions.find(g => g.id === t.id);
      if (!region) return null;
      const rows = regionRows(region, catalog);
      if (!rows.length) return null;
      const top = rows[0];
      return {
        ...t,
        name: region.name,
        count: rows.length,
        topCm: top.dump?.past72Cm ?? null,
        topName: top.r.name,
        estimated: !!top.dump?.estimated,
      };
    })
    .filter(Boolean);
}

/**
 * Ephemeral per-turn model context for a region-scoped chat (eve clientContext).
 * Keeps "where's best?" inside the region without changing what the user typed.
 */
export function regionScopeContext(name) {
  return `The user is browsing the ${name} region page. Scope every answer to ${name}: for open-ended questions like "where's best?" or "where's it dumping?", call getTrending with region "${name}" and pick from those resorts. Only go outside ${name} if they name another mountain or region.`;
}

export function regionStarters(name, topName) {
  return [
    `Where's best in ${name} right now?`,
    `Best ${name} day this week?`,
    topName ? `How's ${topName} looking?` : `Any powder in ${name}?`,
  ];
}

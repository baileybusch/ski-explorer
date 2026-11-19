/**
 * Maps every catalog resort to a regional-snow-climates router slug.
 * Geographic `region` on resorts (Utah, Colorado, …) stays for the gazetteer.
 * `climateRegion` is the router slug; tools return it as snowClimate.region.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REGION_SKILL_DIR = join(HERE, '../../agent/skills/regional-snow-climates');

export const CLIMATE_REGION_SLUGS = [
  'alaska',
  'alps-north',
  'alps-south-dolomites',
  'colorado-central-rockies',
  'interior-bc-canadian-rockies',
  'japan',
  'northeast-eastern-canada',
  'pacific-northwest-bc-coast',
  'pyrenees',
  'sierra-nevada-california',
  'southern-hemisphere',
  'tetons-northern-rockies',
  'utah-wasatch',
];

const SLUG_SET = new Set(CLIMATE_REGION_SLUGS);

const guideCache = new Map();

function fit(region, extra = {}) {
  if (!SLUG_SET.has(region)) throw new Error(`unknown climate region slug: ${region}`);
  return {
    region,
    file: `regions/${region}.md`,
    nearestFit: !!extra.nearestFit,
    note: extra.note || null,
  };
}

/**
 * Resorts the router calls out as boundary / uncovered. Always still assigned
 * a valid slug (nearest file) so the catalog check can require 100% coverage.
 */
export const AMBIGUOUS_RESORT_IDS = new Set([
  // Router: Idaho is a boundary (Northern Rockies vs PNW).
  'schweitzer', 'sun-valley',
  // Router: Arizona/New Mexico → closest Central Rockies file.
  'taos',
  // Router: Korea, China, Australia not covered in detail.
  'yunding', 'beidahu', 'lake-songhua', 'yongpyong',
  'thredbo', 'perisher', 'mt-buller', 'hotham', 'falls-creek',
  // Italian west Alps sit between north-side (Chamonix/Zermatt) and south-side files.
  'cervinia', 'courmayeur', 'monterosa',
  // Southern Utah is not the Cottonwoods; still Wasatch-state climate.
  'eagle-point',
  // Midwest: humid continental / Great Lakes, not the Northeast file's core.
  'paoli-peaks', 'boyne', 'highlands-mi', 'mt-brighton', 'snowriver',
  'lutsen', 'afton-alps', 'snow-creek', 'hidden-valley-mo',
  'alpine-valley-oh', 'boston-mills', 'brandywine', 'mad-river',
  'granite-peak', 'wilmot',
]);

const COUNTRY_ISO = {
  'United States': 'US', 'USA': 'US', 'Canada': 'CA', 'Japan': 'JP',
  'France': 'FR', 'Italy': 'IT', 'Switzerland': 'CH', 'Austria': 'AT',
  'Andorra': 'AD', 'Chile': 'CL', 'Argentina': 'AR', 'New Zealand': 'NZ',
  'Australia': 'AU', 'China': 'CN', 'South Korea': 'KR', 'Korea': 'KR',
};

function isoCountry(value) {
  const c = String(value || '').trim();
  if (!c) return '';
  if (c.length === 2) return c.toUpperCase();
  return COUNTRY_ISO[c] || c;
}

export function classifyClimateRegion(r) {
  if (!r) return null;
  const country = isoCountry(r.country);
  const geo = r.region;
  const sub = r.subregion;
  const state = r.state;

  if (country === 'JP') return fit('japan');
  if (country === 'NZ' || country === 'CL' || country === 'AR') return fit('southern-hemisphere');
  if (country === 'AU') {
    return fit('southern-hemisphere', { nearestFit: true, note: 'Router lists Australia as not covered in detail; nearest file is southern-hemisphere.' });
  }
  if (country === 'CN' || country === 'KR') {
    return fit('japan', { nearestFit: true, note: 'Router lists China/Korea as not covered in detail; nearest file is japan (East Asia winter).' });
  }
  if (country === 'AD' || geo === 'Pyrenees') return fit('pyrenees');

  if (geo === 'Dolomites') return fit('alps-south-dolomites');
  if (country === 'IT' && geo === 'Alps') {
    return fit('alps-north', { nearestFit: true, note: 'Aosta / west Italian Alps sit between alps-north (Chamonix/Zermatt) and alps-south-dolomites.' });
  }
  if (country === 'AT' || country === 'CH' || country === 'FR' || geo === 'Alps') return fit('alps-north');
  if (country === 'IT') return fit('alps-south-dolomites');

  if (country === 'CA') {
    if (geo === 'Alberta') return fit('interior-bc-canadian-rockies');
    if (geo === 'British Columbia') {
      if (sub === 'Sea to Sky' || sub === 'North Shore') return fit('pacific-northwest-bc-coast');
      return fit('interior-bc-canadian-rockies');
    }
    if (geo === 'Quebec' || geo === 'Ontario') return fit('northeast-eastern-canada');
  }

  if (country === 'US') {
    if (geo === 'Alaska' || state === 'AK') return fit('alaska');
    if (geo === 'Utah' || state === 'UT') {
      const south = sub === 'Southern Utah';
      return fit('utah-wasatch', south ? { nearestFit: true, note: 'Southern Utah assigned to utah-wasatch (nearest in-state file).' } : {});
    }
    if (geo === 'Colorado' || state === 'CO') return fit('colorado-central-rockies');
    if (geo === 'Wyoming' || geo === 'Montana' || state === 'WY' || state === 'MT') return fit('tetons-northern-rockies');
    if (geo === 'Idaho' || state === 'ID') {
      return fit('tetons-northern-rockies', { nearestFit: true, note: 'Idaho is a router boundary (Northern Rockies vs PNW); using tetons-northern-rockies.' });
    }
    if (geo === 'New Mexico' || state === 'NM') {
      return fit('colorado-central-rockies', { nearestFit: true, note: 'New Mexico is a router boundary; nearest file is colorado-central-rockies.' });
    }
    if (geo === 'California' || geo === 'Tahoe' || geo === 'Southern California' || state === 'CA' || state === 'CA/NV') {
      return fit('sierra-nevada-california');
    }
    if (geo === 'Washington' || geo === 'Oregon' || state === 'WA' || state === 'OR') {
      return fit('pacific-northwest-bc-coast');
    }
    if (['Vermont', 'Maine', 'New Hampshire', 'New York', 'Pennsylvania', 'West Virginia'].includes(geo)
      || ['VT', 'ME', 'NH', 'NY', 'PA', 'WV'].includes(state)) {
      return fit('northeast-eastern-canada');
    }
    if (['Michigan', 'Minnesota', 'Wisconsin', 'Ohio', 'Missouri', 'Indiana'].includes(geo)
      || ['MI', 'MN', 'WI', 'OH', 'MO', 'IN'].includes(state)) {
      return fit('northeast-eastern-canada', { nearestFit: true, note: 'Midwest / Great Lakes assigned to northeast-eastern-canada (humid continental + lake effect).' });
    }
  }
  return null;
}

export function regionGuide(slug) {
  if (!slug || !SLUG_SET.has(slug)) return null;
  if (guideCache.has(slug)) return guideCache.get(slug);
  const path = join(REGION_SKILL_DIR, 'regions', `${slug}.md`);
  if (!existsSync(path)) throw new Error(`missing region file ${path}`);
  const markdown = readFileSync(path, 'utf8');
  guideCache.set(slug, markdown);
  return markdown;
}

/** Payload tools attach. `region` is the router slug. */
export function snowClimateFor(r, { includeGuide = false } = {}) {
  const classified = classifyClimateRegion(r);
  if (!classified) return null;
  const out = {
    region: classified.region,
    file: classified.file,
    skill: 'regional-snow-climates',
    nearestFit: classified.nearestFit,
    note: classified.note,
    load: `eve__skill({ name: "regional-snow-climates" }) then read ${classified.file}`,
  };
  if (includeGuide) out.guide = regionGuide(classified.region);
  return out;
}

export function applyClimateRegion(r) {
  const c = classifyClimateRegion(r);
  if (!c) throw new Error(`unmapped climate region for ${r.id} (${r.name}, ${r.country} ${r.region} ${r.state})`);
  return { ...r, climateRegion: c.region };
}

/**
 * Fails if any resort is missing climateRegion, uses an unknown slug,
 * disagrees with the classifier, or a region file is missing.
 */
export function assertClimateRegions(resorts) {
  const missing = [];
  const unknown = [];
  const mismatch = [];
  const missingFiles = [];
  const ambiguous = [];
  for (const slug of CLIMATE_REGION_SLUGS) {
    if (!existsSync(join(REGION_SKILL_DIR, 'regions', `${slug}.md`))) missingFiles.push(slug);
  }
  for (const r of resorts || []) {
    const classified = classifyClimateRegion(r);
    if (!classified) missing.push(r.id);
    else if (!SLUG_SET.has(classified.region)) unknown.push(`${r.id}:${classified.region}`);
    const stored = r.climateRegion;
    if (!stored) missing.push(r.id);
    else if (!SLUG_SET.has(stored)) unknown.push(`${r.id}:${stored}`);
    else if (classified && stored !== classified.region) mismatch.push(`${r.id}:${stored}!=${classified.region}`);
    if (classified?.nearestFit || AMBIGUOUS_RESORT_IDS.has(r.id)) {
      ambiguous.push({ id: r.id, name: r.name, region: classified?.region || stored, note: classified?.note });
    }
  }
  const errors = [];
  if (missing.length) errors.push(`unmapped: ${[...new Set(missing)].join(', ')}`);
  if (unknown.length) errors.push(`unknown slugs: ${unknown.join(', ')}`);
  if (mismatch.length) errors.push(`stored!=classified: ${mismatch.join(', ')}`);
  if (missingFiles.length) errors.push(`missing files: ${missingFiles.join(', ')}`);
  if (errors.length) {
    const err = new Error(`climate region check failed: ${errors.join(' | ')}`);
    err.details = { missing, unknown, mismatch, missingFiles };
    throw err;
  }
  return { ok: true, total: resorts.length, slugs: CLIMATE_REGION_SLUGS.length, ambiguous };
}

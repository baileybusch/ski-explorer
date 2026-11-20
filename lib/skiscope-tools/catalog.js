/**
 * Shared catalog loader for the tool layer.
 * Callers inject a catalog in tests; Node loads committed JSON.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const moduleRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

let cached = null;

function readJSON(rel, fallback) {
  for (const root of [process.cwd(), moduleRoot]) {
    try {
      return JSON.parse(readFileSync(join(root, rel), 'utf8'));
    } catch { /* try the next root — Vercel functions live at cwd */ }
  }
  return fallback;
}

export const CATALOG_FILES = {
  resorts: 'public/data/resorts-index.json',
  snow: 'public/data/snow.json',
  observed: 'public/data/observed.json',
  gaz: 'public/data/gazetteer.json',
  typical: 'public/data/typical.json',
  history: 'public/data/history.json',
  climatology: 'public/data/climatology.json',
};

/** Build the catalog from already-parsed JSON (eve bundle embeds the files; Node reads them). */
export function buildCatalog(raw = {}) {
  const resorts = raw.resorts || [];
  const snow = raw.snow || { dates: [], today: 0, resorts: {} };
  const observed = raw.observed || { resorts: {}, fetched: null };
  const gaz = raw.gaz || { regions: [] };
  const typical = raw.typical || { windows: {} };
  const history = raw.history || { resorts: {} };
  const climatology = raw.climatology || { resorts: {} };
  snow.observed = observed.resorts || {};
  snow.observedFetched = observed.fetched || null;
  snow.observedSource = observed.source || null;
  return {
    resorts,
    snow,
    observed,
    typical,
    history,
    climatology,
    regions: gaz.regions || [],
    asOf: snow.dates?.[snow.today] || null,
    fetched: observed.fetched || snow.fetched || snow.dates?.[snow.today] || null,
  };
}

let rawCache = null;

/** Raw parsed catalog JSON from disk (Node). Cached; callers must not mutate it. */
export function loadRaw() {
  if (rawCache) return rawCache;
  const raw = {};
  for (const [k, rel] of Object.entries(CATALOG_FILES)) raw[k] = readJSON(rel, undefined);
  rawCache = raw;
  return raw;
}

export function loadCatalog() {
  if (cached) return cached;
  const raw = loadRaw();
  cached = buildCatalog({ ...raw, snow: raw.snow ? { ...raw.snow } : undefined });
  return cached;
}

export function setCatalog(next) {
  cached = next;
}

export function catalogOf(injected) {
  return injected || loadCatalog();
}

export { attribution } from './attribution.js';

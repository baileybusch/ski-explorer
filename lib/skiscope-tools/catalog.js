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

export function loadCatalog() {
  if (cached) return cached;
  const resorts = readJSON('public/data/resorts-index.json', []);
  const snow = readJSON('public/data/snow.json', { dates: [], today: 0, resorts: {} });
  const gaz = readJSON('public/data/gazetteer.json', { regions: [] });
  const typical = readJSON('public/data/typical.json', { windows: {} });
  const history = readJSON('public/data/history.json', { resorts: {} });
  cached = {
    resorts,
    snow,
    typical,
    history,
    regions: gaz.regions || [],
    asOf: snow.dates?.[snow.today] || null,
    fetched: snow.fetched || snow.dates?.[snow.today] || null,
  };
  return cached;
}

export function setCatalog(next) {
  cached = next;
}

export function catalogOf(injected) {
  return injected || loadCatalog();
}

export function attribution(snow) {
  const asOf = snow?.dates?.[snow.today] || snow?.fetched || null;
  return {
    generatedAt: asOf,
    source: snow?.source || 'Open-Meteo snapshot',
    attribution: 'Modeled Open-Meteo snowfall_sum. Not resort-reported totals.',
  };
}

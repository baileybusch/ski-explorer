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
  const observed = readJSON('public/data/observed.json', { resorts: {}, fetched: null });
  const gaz = readJSON('public/data/gazetteer.json', { regions: [] });
  const typical = readJSON('public/data/typical.json', { windows: {} });
  const history = readJSON('public/data/history.json', { resorts: {} });
  snow.observed = observed.resorts || {};
  snow.observedFetched = observed.fetched || null;
  snow.observedSource = observed.source || null;
  cached = {
    resorts,
    snow,
    observed,
    typical,
    history,
    regions: gaz.regions || [],
    asOf: snow.dates?.[snow.today] || null,
    fetched: observed.fetched || snow.fetched || snow.dates?.[snow.today] || null,
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
  const asOf = snow?.observedFetched || snow?.dates?.[snow.today] || snow?.fetched || null;
  return {
    generatedAt: asOf,
    source: snow?.observedSource || snow?.source || 'observed + Open-Meteo forecast',
    attribution: 'US last 72h from NRCS SNOTEL where mapped. Elsewhere modeled (est.). Forecast: Open-Meteo. Not resort-reported totals.',
  };
}

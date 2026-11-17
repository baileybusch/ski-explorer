#!/usr/bin/env node
/**
 * Build public/data/observed.json from NRCS SNOTEL (US), CDEC (California) + Open-Meteo model-est.
 * Also writes public/data/snotel-map.json when --remap is passed or the map is missing.
 *
 * Usage:
 *   node scripts/fetch_observed.mjs
 *   node scripts/fetch_observed.mjs --remap
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { downloadStations, buildSnotelMap, buildObservedSnapshot } from '../lib/snotel.js';

const remap = process.argv.includes('--remap');
const resorts = JSON.parse(readFileSync('public/data/resorts-index.json', 'utf8'));
const snow = existsSync('public/data/snow.json')
  ? JSON.parse(readFileSync('public/data/snow.json', 'utf8'))
  : { dates: [], today: 0, resorts: {} };

let map;
if (remap || !existsSync('public/data/snotel-map.json')) {
  console.log('downloading NRCS station metadata…');
  const stations = await downloadStations();
  console.log('snow stations', stations.length);
  map = buildSnotelMap(resorts, stations);
  writeFileSync('public/data/snotel-map.json', JSON.stringify({
    generated: new Date().toISOString(),
    source: 'NRCS AWDB stations (SNTL/SNTLT)',
    maxKm: 45,
    resorts: map,
  }));
  console.log('mapped', Object.keys(map).length, 'US resorts → snotel-map.json');
} else {
  map = JSON.parse(readFileSync('public/data/snotel-map.json', 'utf8')).resorts || {};
  console.log('using committed snotel-map.json', Object.keys(map).length, 'resorts');
}

const cdecMap = existsSync('public/data/cdec-map.json')
  ? JSON.parse(readFileSync('public/data/cdec-map.json', 'utf8')).resorts || {}
  : {};
// Previous snapshot lets recent SNOTEL rows stand in if NRCS AWDB is down.
const previous = existsSync('public/data/observed.json')
  ? JSON.parse(readFileSync('public/data/observed.json', 'utf8'))
  : null;
const observed = await buildObservedSnapshot({ resorts, snow, map, cdecMap, previous });
writeFileSync('public/data/observed.json', JSON.stringify(observed));
const n = observed.counts || {};
if (observed.warnings) console.warn('warnings', observed.warnings.join(', '));
console.log('ok observed.json snotel', n.snotel, 'cdec', n.cdec, 'est', n.est, 'carried', n.carried, 'stations', n.stations, 'fetched', observed.fetched);

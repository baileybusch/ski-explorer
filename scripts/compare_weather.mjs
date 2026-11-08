#!/usr/bin/env node
/**
 * Optional live compare: Open-Meteo vs MET Norway for a handful of resorts.
 * Network. Not part of npm run eval. Do not pay anyone.
 */
import { readFileSync } from 'node:fs';
import { fetchForecast } from '../lib/weather/index.js';

const ids = (process.argv[2] || 'alta,mammoth,niseko-hirafu,whistler,zermatt,chamonix,vail,hakuba-happo').split(',');
const index = JSON.parse(readFileSync('public/data/resorts-index.json', 'utf8'));
const snow = JSON.parse(readFileSync('public/data/snow.json', 'utf8'));

for (const id of ids) {
  const r = index.find(x => x.id === id);
  if (!r) {
    console.log(id, 'missing');
    continue;
  }
  const snap = snow.resorts[id];
  const om7 = (snap?.sf || []).slice((snow.today || 0) + 1, (snow.today || 0) + 8).reduce((a, n) => a + (n || 0), 0);
  let met = null;
  try {
    met = await fetchForecast({ lat: r.center[1], lon: r.center[0] }, 'metnorway');
  } catch (e) {
    console.log(id, 'met.no failed', e.message);
    continue;
  }
  const met7 = (met.days || []).reduce((a, d) => a + (d.snowCm || 0), 0);
  console.log(`${id.padEnd(16)} open-meteo snapshot next7 ${om7.toFixed(1)} cm   met.no est ${met7.toFixed(1)} cm`);
}

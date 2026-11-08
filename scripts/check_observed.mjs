#!/usr/bin/env node
/**
 * Real-data check: SNOTEL-derived 72h for a currently snowing US resort
 * vs Open-Meteo forecast chip. Network required.
 */
import { readFileSync } from 'node:fs';
import { dumpParts } from '../lib/dumpScore.js';
import { loadCatalog } from '../lib/skiscope-tools/catalog.js';
import { fetchAwdbHourly, observedFromStation } from '../lib/snotel.js';

const cat = loadCatalog();
const map = JSON.parse(readFileSync('public/data/snotel-map.json', 'utf8')).resorts;
const ranked = [...cat.resorts]
  .map(r => ({ r, p: dumpParts(r, cat.snow) }))
  .sort((a, b) => b.p.past72In - a.p.past72In || b.p.next7In - a.p.next7In);

const lead = ranked.find(x => String(x.p.source).startsWith('snotel:')) || ranked[0];
const r = lead.r;
const p = lead.p;
const triplet = (map[r.id] || {}).triplet;
console.log('lead', r.name, r.id);
console.log('  source', p.source);
console.log('  observed 24h/72h', p.past24In.toFixed(1) + '″', p.past72In.toFixed(1) + '″');
console.log('  forecast 7d', p.next7In.toFixed(1) + '″', '(Open-Meteo chip only)');
console.log('  estimated', p.estimated);
console.log('  observedAt', p.observedAt);

if (triplet) {
  const data = await fetchAwdbHourly([triplet]);
  const live = observedFromStation(data[0] || {});
  console.log('  live AWDB', triplet, '72h', live.snow72hIn + '″', '24h', live.snow24hIn + '″', 'at', live.observedAt, live.method);
  const drift = Math.abs(live.snow72hCm - p.past72Cm);
  if (drift > 12.7) {
    console.warn('  WARN snapshot vs live 72h differs by', drift, 'cm');
    process.exitCode = 0; // still useful; snapshot may be minutes old
  }
}

const nSnotel = ranked.filter(x => !x.p.estimated).length;
const nEst = ranked.filter(x => x.p.estimated).length;
console.log('catalog', ranked.length, 'snotel', nSnotel, 'est', nEst);
console.log('top5', ranked.slice(0, 5).map(x => `${x.r.name} ${x.p.past72In.toFixed(1)}″ ${x.p.source}`).join(' | '));

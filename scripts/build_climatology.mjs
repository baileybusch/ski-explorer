/**
 * Build public/data/climatology.json: historical monthly snowfall averages per resort.
 *
 * Input: the committed ERA5 season archives in public/data/seasons/ (Open-Meteo historical
 * archive, daily snowfall_sum at mid-mountain; written by scripts/fetch_seasons.py).
 *   <year>.json    Northern Hemisphere, Nov 1 – Apr 30
 *   <year>sh.json  Southern Hemisphere, Jun 1 – Sep 30
 * No network calls. Re-run after fetch_seasons.py adds seasons or resorts.
 *
 * Output is a historical average, never a forecast.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = 'public/data/seasons';
const OUT = 'public/data/climatology.json';
const round = v => Math.round(v * 10) / 10;

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const files = readdirSync(DIR).filter(f => /^\d{4}(sh)?\.json$/.test(f)).sort();
const totals = {};
const seasonsSeen = { N: new Set(), S: new Set() };

for (const f of files) {
  const hemi = f.includes('sh') ? 'S' : 'N';
  const d = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
  const start = new Date(`${d.start}T00:00:00Z`);
  seasonsSeen[hemi].add(d.season);
  for (const [id, daily] of Object.entries(d.resorts || {})) {
    const byMonth = {};
    daily.forEach((cm, i) => {
      const day = new Date(start.getTime() + i * 86400000);
      const key = `${day.getUTCFullYear()}-${day.getUTCMonth() + 1}`;
      const b = byMonth[key] || (byMonth[key] = { y: day.getUTCFullYear(), m: day.getUTCMonth() + 1, cm: 0, n: 0 });
      b.cm += cm || 0;
      b.n += 1;
    });
    const t = totals[id] || (totals[id] = { h: hemi, months: {}, seasons: new Set() });
    t.seasons.add(d.season);
    for (const b of Object.values(byMonth)) {
      if (b.n < daysInMonth(b.y, b.m)) continue;
      (t.months[b.m] || (t.months[b.m] = [])).push(b.cm);
    }
  }
}

const resorts = {};
for (const [id, t] of Object.entries(totals)) {
  const avg = Array(12).fill(null);
  const lo = Array(12).fill(null);
  const hi = Array(12).fill(null);
  for (const [m, vals] of Object.entries(t.months)) {
    const i = Number(m) - 1;
    avg[i] = round(vals.reduce((a, b) => a + b, 0) / vals.length);
    lo[i] = round(Math.min(...vals));
    hi[i] = round(Math.max(...vals));
  }
  resorts[id] = { h: t.h, n: t.seasons.size, avg, lo, hi };
}

function span(set) {
  const s = [...set].sort();
  return s.length ? { first: s[0], last: s[s.length - 1], count: s.length } : null;
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  kind: 'historical-average',
  source: 'ERA5 reanalysis via the Open-Meteo historical archive (daily snowfall_sum at mid-mountain)',
  note: 'Average snowfall per calendar month across past seasons. A historical average, not a forecast.',
  units: 'cm',
  months: { N: [11, 12, 1, 2, 3, 4], S: [6, 7, 8, 9] },
  seasons: { N: span(seasonsSeen.N), S: span(seasonsSeen.S) },
  resorts,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`climatology: ${Object.keys(resorts).length} resorts, N ${out.seasons.N?.first}..${out.seasons.N?.last}, S ${out.seasons.S?.first || '-'}..${out.seasons.S?.last || '-'}`);

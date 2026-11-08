import { readFileSync, existsSync } from 'node:fs';
import { newSnowInches, inchesToCm } from '../lib/snotel.js';
import { compareDump, boardIsMonotonic, dumpParts } from '../lib/dumpScore.js';
import { loadCatalog } from '../lib/skiscope-tools/index.js';

function series(pairs) {
  return pairs.map(([date, v]) => ({ t: Date.parse(String(date).replace(' ', 'T')), v, date }));
}

const cases = [
  {
    id: 'flicker-not-snow',
    run: () => {
      // Integer pillow 4/5/4/5 with flat SWE must not count as 72h snow.
      const snwd = series([
        ['2026-11-06T00:00', 4],
        ['2026-11-06T06:00', 5],
        ['2026-11-06T12:00', 4],
        ['2026-11-07T00:00', 5],
        ['2026-11-07T12:00', 4],
        ['2026-11-08T00:00', 5],
        ['2026-11-08T09:00', 4],
      ]);
      const swe = series([
        ['2026-11-06T00:00', 1.3],
        ['2026-11-08T09:00', 1.2],
      ]);
      const out = newSnowInches(snwd, swe, 72);
      return out.inches === 0 ? [] : [`flicker counted ${out.inches} in`];
    },
  },
  {
    id: 'peak-rise-keeps-storm-after-settle',
    run: () => {
      const snwd = series([
        ['2026-11-05T00:00', 2],
        ['2026-11-06T00:00', 8],
        ['2026-11-07T00:00', 8],
        ['2026-11-08T09:00', 6],
      ]);
      const swe = series([
        ['2026-11-05T00:00', 0.4],
        ['2026-11-08T09:00', 1.1],
      ]);
      const out = newSnowInches(snwd, swe, 72);
      return Math.abs(out.inches - 6) < 0.05 ? [] : [`peak rise ${out.inches} != 6`];
    },
  },
  {
    id: 'swe-only-estimates',
    run: () => {
      const snwd = series([
        ['2026-11-05T00:00', 10],
        ['2026-11-08T09:00', 10],
      ]);
      const swe = series([
        ['2026-11-05T00:00', 2.0],
        ['2026-11-08T09:00', 2.3],
      ]);
      const out = newSnowInches(snwd, swe, 72);
      return Math.abs(out.inches - 3.6) < 0.05 ? [] : [`swe slr ${out.inches} != 3.6`];
    },
  },
  {
    id: 'inches-to-cm',
    run: () => (inchesToCm(10) === 25.4 ? [] : [`${inchesToCm(10)} != 25.4`]),
  },
];

export function runObservedEvals() {
  let fail = 0;
  const lines = [];
  for (const c of cases) {
    const miss = c.run();
    if (miss.length) {
      fail++;
      lines.push(`FAIL  ${c.id}  ${miss.join('; ')}`);
    } else lines.push(`ok    ${c.id}`);
  }

  if (existsSync(new URL('../public/data/observed.json', import.meta.url))) {
    const cat = loadCatalog();
    const rows = cat.resorts.map(r => ({ r }));
    rows.sort((a, b) => compareDump(a, b, cat.snow));
    if (!boardIsMonotonic(rows, cat.snow)) {
      fail++;
      lines.push('FAIL  catalog-monotonic');
    } else lines.push(`ok    catalog-monotonic  n=${rows.length}`);

    const parts = rows.map(row => dumpParts(row.r, cat.snow));
    const observed = parts.filter(p => !p.estimated).length;
    const est = parts.filter(p => p.estimated).length;
    lines.push(`ok    catalog-sources  snotel=${observed} est=${est}`);
    if (observed < 1) {
      fail++;
      lines.push('FAIL  expected at least one SNOTEL-backed US resort');
    }

    const file = JSON.parse(readFileSync(new URL('../public/data/observed.json', import.meta.url), 'utf8'));
    const alta = file.resorts?.alta;
    if (!alta) {
      fail++;
      lines.push('FAIL  alta missing from observed.json');
    } else if (!String(alta.source || '').startsWith('snotel:')) {
      fail++;
      lines.push(`FAIL  alta source ${alta.source} expected snotel:`);
    } else lines.push(`ok    alta-snotel  ${alta.source}  72h=${alta.snow72hCm}cm`);
  } else {
    lines.push('ok    catalog-monotonic  skipped (no observed.json yet)');
  }

  return { fail, total: cases.length + 3, lines };
}

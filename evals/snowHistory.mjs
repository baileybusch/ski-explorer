import { historyFor, seasonStartFor } from '../lib/snowHistory.js';

const cases = [
  {
    id: 'season-start-n-s',
    run: () => {
      const miss = [];
      if (seasonStartFor('N', '2026-10-26') !== '2026-10-01') miss.push('N in-season');
      if (seasonStartFor('N', '2026-09-30') !== '2025-10-01') miss.push('N off-season');
      if (seasonStartFor('S', '2026-08-01') !== '2026-07-01') miss.push('S in-season');
      if (seasonStartFor('S', '2026-06-15') !== '2025-07-01') miss.push('S off-season');
      return miss;
    },
  },
  {
    id: 'verdict-above-average',
    run: () => {
      const snow = { dates: ['2026-10-26'], today: 0, resorts: { alta: { sf: [20] } } };
      const history = {
        asOf: '2026-10-26',
        resorts: {
          alta: {
            currentStdCm: 118,
            sameDate: [{ year: 2021, cm: 100 }, { year: 2022, cm: 100 }, { year: 2023, cm: 100 }, { year: 2024, cm: 100 }, { year: 2025, cm: 100 }],
            fullSeasons: [],
          },
        },
      };
      const h = historyFor({ id: 'alta', hemisphere: 'N' }, snow, history);
      return /18% above/.test(h.verdict) ? [] : [`verdict ${h.verdict}`];
    },
  },
  {
    id: 'fallback-without-archive',
    run: () => {
      const snow = { dates: ['2026-10-26'], today: 0, resorts: { taos: { sf: [5] } } };
      const h = historyFor({ id: 'taos', hemisphere: 'N', sf: [5] }, snow, { resorts: {} });
      return !h.hasArchive && /not cached/.test(h.verdict) ? [] : ['expected cache miss'];
    },
  },
];

export function runSnowHistoryEvals() {
  let fail = 0;
  const lines = [];
  for (const c of cases) {
    const miss = c.run();
    if (miss.length) {
      fail++;
      lines.push(`FAIL  ${c.id}  ${miss.join('; ')}`);
    } else {
      lines.push(`ok    ${c.id}`);
    }
  }
  return { fail, total: cases.length, lines };
}

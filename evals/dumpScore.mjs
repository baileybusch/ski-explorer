import { compareDump, dumpParts, dumpScoreIn } from '../lib/dumpScore.js';

const snow = {
  today: 3,
  dates: [
    '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03',
    '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07',
  ],
  resorts: {
    // 9″ past 72h + 14″ next 7d = 23″
    dump: { sf: [0, 12.7, 7.62, 2.54, 0, 15.24, 20.32, 0] },
    // 0 + 12″ = 12″
    incoming: { sf: [0, 0, 0, 0, 0, 20.32, 10.16, 0] },
    // 9″ + ~1″ leftover
    recent: { sf: [0, 12.7, 7.62, 2.54, 1, 1, 0, 1] },
    quiet: { sf: [0, 0, 0, 0, 0, 0, 0, 0] },
  },
};

function almost(a, b, eps = 0.05) {
  return Math.abs(a - b) <= eps;
}

const cases = [
  {
    id: 'alta-parts',
    run: () => {
      const p = dumpParts({ id: 'dump' }, snow);
      const miss = [];
      if (!almost(p.past72In, 9)) miss.push(`past72 ${p.past72In} != 9`);
      if (!almost(p.next7In, 14)) miss.push(`next7 ${p.next7In} != 14`);
      if (!almost(p.dumpIn, 23)) miss.push(`dump ${p.dumpIn} != 23`);
      return miss;
    },
  },
  {
    id: 'score-is-sum',
    run: () => {
      const p = dumpParts({ id: 'incoming' }, snow);
      const miss = [];
      if (!almost(p.dumpIn, p.past72In + p.next7In)) miss.push('dumpIn != sum of legs');
      if (!almost(dumpScoreIn({ id: 'incoming' }, snow), 12)) miss.push(`score ${dumpScoreIn({ id: 'incoming' }, snow)} != 12`);
      return miss;
    },
  },
  {
    id: 'order-by-combined',
    run: () => {
      const rows = [
        { r: { id: 'quiet', name: 'Quiet' } },
        { r: { id: 'incoming', name: 'Incoming' } },
        { r: { id: 'dump', name: 'Dump' } },
        { r: { id: 'recent', name: 'Recent' } },
      ];
      const ranked = [...rows].sort((a, b) => compareDump(a, b, snow)).map(x => x.r.id);
      return ranked.join(',') === 'dump,incoming,recent,quiet' ? [] : [`order ${ranked.join(',')} != dump,incoming,recent,quiet`];
    },
  },
  {
    id: 'tie-next7-then-name',
    run: () => {
      const tieSnow = {
        today: 0,
        dates: ['2026-12-01', '2026-12-02'],
        resorts: {
          a: { sf: [2.54, 5.08] },
          b: { sf: [2.54, 7.62] },
          c: { sf: [2.54, 7.62] },
        },
      };
      const rows = [
        { r: { id: 'c', name: 'Charlie' } },
        { r: { id: 'a', name: 'Alpha' } },
        { r: { id: 'b', name: 'Bravo' } },
      ];
      const ranked = [...rows].sort((x, y) => compareDump(x, y, tieSnow)).map(x => x.r.id);
      // b and c share 1″ + 3″; a is 1″ + 2″. Tie between b/c → name A–Z (Bravo before Charlie).
      return ranked.join(',') === 'b,c,a' ? [] : [`tie ${ranked.join(',')} != b,c,a`];
    },
  },
];

export function runDumpScoreEvals() {
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

import { compareDump, dumpParts, dumpScoreIn, boardIsMonotonic } from '../lib/dumpScore.js';

const snow = {
  today: 3,
  dates: [
    '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03',
    '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07',
  ],
  resorts: {
    // 9″ past 72h + 14″ next 7d
    dump: { sf: [0, 12.7, 7.62, 2.54, 0, 15.24, 20.32, 0] },
    // 0 + 12″ forecast
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
      if (!p.estimated) miss.push('model fallback should be estimated');
      return miss;
    },
  },
  {
    id: 'score-is-actual',
    run: () => {
      const p = dumpParts({ id: 'incoming' }, snow);
      const miss = [];
      if (!almost(p.dumpIn, p.past72In + p.next7In)) miss.push('dumpIn != sum of legs');
      if (!almost(dumpScoreIn({ id: 'incoming' }, snow), 0)) miss.push(`score ${dumpScoreIn({ id: 'incoming' }, snow)} != 0 actual`);
      return miss;
    },
  },
  {
    id: 'order-by-actual-not-forecast',
    run: () => {
      // Combined score would rank incoming (12″ coming) above quiet-actual-with-forecast.
      // Actual ranking: dump & recent (9″ fallen) beat incoming (0″ fallen).
      const rows = [
        { r: { id: 'quiet', name: 'Quiet' } },
        { r: { id: 'incoming', name: 'Incoming' } },
        { r: { id: 'dump', name: 'Dump' } },
        { r: { id: 'recent', name: 'Recent' } },
      ];
      const ranked = [...rows].sort((a, b) => compareDump(a, b, snow)).map(x => x.r.id);
      // dump and recent tie on 9″; dump has more forecast → dump, recent, incoming, quiet
      return ranked.join(',') === 'dump,recent,incoming,quiet'
        ? []
        : [`order ${ranked.join(',')} != dump,recent,incoming,quiet`];
    },
  },
  {
    id: 'observed-beats-model-est-on-same-id',
    run: () => {
      const mixed = {
        ...snow,
        observed: {
          incoming: { snow72hCm: 25.4, snow24hCm: 10, source: 'snotel:999:CO:SNTL', observedAt: '2026-12-03T12:00:00' },
        },
      };
      const p = dumpParts({ id: 'incoming' }, mixed);
      const miss = [];
      if (!almost(p.past72In, 10)) miss.push(`observed past72 ${p.past72In} != 10`);
      if (p.estimated) miss.push('snotel should not be estimated');
      if (p.source !== 'snotel:999:CO:SNTL') miss.push(`source ${p.source}`);
      const ranked = [
        { r: { id: 'dump', name: 'Dump' } },
        { r: { id: 'incoming', name: 'Incoming' } },
      ].sort((a, b) => compareDump(a, b, mixed)).map(x => x.r.id);
      if (ranked[0] !== 'incoming') miss.push(`rank ${ranked.join(',')} — Incoming 10″ observed should lead Dump 9″ model`);
      return miss;
    },
  },
  {
    id: 'tie-forecast-then-name',
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
      // all 1″ actual; b and c share 3″ forecast; a has 2″. Tie b/c → Bravo before Charlie.
      return ranked.join(',') === 'b,c,a' ? [] : [`tie ${ranked.join(',')} != b,c,a`];
    },
  },
  {
    id: 'monotonic-helper',
    run: () => {
      const rows = [
        { r: { id: 'dump', name: 'Dump' } },
        { r: { id: 'recent', name: 'Recent' } },
        { r: { id: 'incoming', name: 'Incoming' } },
        { r: { id: 'quiet', name: 'Quiet' } },
      ];
      const ok = boardIsMonotonic(rows, snow);
      const shuffled = [rows[2], rows[0], rows[3], rows[1]];
      const bad = boardIsMonotonic(shuffled, snow);
      if (!ok) return ['sorted list should be monotonic'];
      if (bad) return ['shuffled list should fail'];
      return [];
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

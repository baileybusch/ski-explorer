import { stormStatus } from '../lib/stormStatus.js';

const snow = {
  today: 3,
  dates: [
    '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03',
    '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07',
  ],
  resorts: {
    alta: {
      // Thu Dec 3 is today. Forecast: Fri 0, Sat 15.24 (6″), Sun 20.32 (8″).
      sf: [0, 12.7, 7.62, 2.54, 0, 15.24, 20.32, 0],
      tmax: [2, 1, 0, -1, 1, -6, -5, 2],
      tmin: [-8, -7, -6, -8, -4, -12, -11, -3],
    },
    quiet: {
      sf: [0, 12.7, 7.62, 2.54, 1, 2, 0, 1],
      tmax: [4, 3, 2, 1, 5, 6, 7, 6],
    },
    warm: {
      sf: [0, 0, 0, 0, 0, 20.32, 10.16, 0],
      tmax: [4, 4, 4, 4, 6, 5, 4, 3],
    },
  },
};

const cases = [
  {
    id: 'incoming-cold',
    resort: { id: 'alta' },
    expect: {
      kind: 'incoming',
      includes: ['Storm status: Snow starts Sat.', 'Expect ~14″ through Sun, heaviest Sun.', 'Temps stay cold, so it stays light and dry.'],
    },
  },
  {
    id: 'quiet-with-recent',
    resort: { id: 'quiet' },
    expect: {
      kind: 'quiet',
      includes: ['Storm status: Quiet.', 'Nothing over 2″ in the next 7 days.', 'Best recent: 9″ in the last 72h.'],
    },
  },
  {
    id: 'incoming-warm',
    resort: { id: 'warm' },
    expect: {
      kind: 'incoming',
      includes: ['Snow starts Sat.', 'heaviest Sat.', 'Temps climb above freezing — snow may go wet.'],
    },
  },
  {
    id: 'source-label',
    resort: { id: 'alta' },
    expect: { source: 'Modeled forecast.' },
  },
];

export function runStormStatusEvals() {
  let fail = 0;
  const lines = [];
  for (const c of cases) {
    const out = stormStatus(c.resort, snow, { units: 'in' });
    const miss = [];
    if (c.expect.kind && out.kind !== c.expect.kind) miss.push(`kind ${out.kind} != ${c.expect.kind}`);
    if (c.expect.source && out.source !== c.expect.source) miss.push(`source ${out.source}`);
    for (const chunk of c.expect.includes || []) {
      if (!out.text.includes(chunk)) miss.push(`missing "${chunk}" in "${out.text}"`);
    }
    if (miss.length) {
      fail++;
      lines.push(`FAIL  ${c.id}  ${miss.join('; ')}`);
    } else {
      lines.push(`ok    ${c.id}`);
    }
  }
  return { fail, total: cases.length, lines };
}

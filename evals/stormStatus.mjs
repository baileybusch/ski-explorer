import { stormStatus } from '../lib/stormStatus.js';

const snow = {
  today: 3,
  dates: [
    '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03',
    '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07',
  ],
  resorts: {
    // Thu Dec 3 is today. 9″ last 72h, 14″ Fri–Sun, peak Sun (3 days out) → Building.
    alta: {
      sf: [0, 12.7, 7.62, 2.54, 0, 15.24, 20.32, 0],
      tmax: [2, 1, 0, -1, 1, -6, -5, 2],
      tmin: [-8, -7, -6, -8, -4, -12, -11, -3],
    },
    quiet: {
      sf: [0, 1, 1, 1, 1, 2, 0, 1],
      tmax: [4, 3, 2, 1, 5, 6, 7, 6],
    },
    wind: {
      // 9″ last 72h, leftover next 7d under 2″.
      sf: [0, 12.7, 7.62, 2.54, 1, 1, 0, 1],
      tmax: [2, 1, 0, -1, 1, 0, -1, 0],
    },
    peak: {
      // Tomorrow is the dump (8″). Today quiet. → Peaking.
      sf: [0, 0, 0, 1, 20.32, 2, 0, 0],
      tmax: [-5, -5, -4, -4, -6, -5, -3, -2],
    },
    active: {
      // Today 4″ and peak in 2 days → Active (not yet peaking).
      sf: [0, 5, 5, 10.16, 5, 15.24, 5, 0],
      tmax: [-3, -3, -4, -4, -5, -4, -2, -1],
    },
    warm: {
      sf: [0, 0, 0, 0, 0, 20.32, 10.16, 0],
      tmax: [4, 4, 4, 4, 6, 5, 4, 3],
    },
  },
};

const cases = [
  {
    id: 'building-cold',
    resort: { id: 'alta' },
    expect: {
      kind: 'Building',
      includes: [
        'Storm status: Building.',
        '9″ in the last 72h',
        '+14″ forecast next 7 days',
        'peaking Sun',
        'Cold temps = light, dry powder.',
      ],
    },
  },
  {
    id: 'quiet',
    resort: { id: 'quiet' },
    expect: {
      kind: 'Quiet',
      includes: ['Storm status: Quiet.', 'Nothing over 2″ in the next 7 days.'],
    },
  },
  {
    id: 'winding-down',
    resort: { id: 'wind' },
    expect: {
      kind: 'Winding down',
      includes: ['Storm status: Winding down.', '9″ fell in the last 72h', 'Only'],
    },
  },
  {
    id: 'peaking',
    resort: { id: 'peak' },
    expect: {
      kind: 'Peaking',
      includes: ['Storm status: Peaking.', 'Heaviest Fri'],
    },
  },
  {
    id: 'active',
    resort: { id: 'active' },
    expect: {
      kind: 'Active',
      includes: ['Storm status: Active.'],
    },
  },
  {
    id: 'building-warm',
    resort: { id: 'warm' },
    expect: {
      kind: 'Building',
      includes: ['Storm status: Building.', 'Warm and wet, expect heavy snow or rain at base'],
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

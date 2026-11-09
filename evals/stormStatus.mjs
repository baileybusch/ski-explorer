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
    resort: { id: 'alta', name: 'Alta' },
    expect: {
      kind: 'Building',
      includes: [
        'Alta is lining up a storm',
        '9″ estimated in the last 72 hours',
        'About 14″ is forecast',
        'heaviest Sunday',
        'well below freezing',
      ],
      excludes: ['Storm status:', 'light, dry powder'],
    },
  },
  {
    id: 'quiet',
    resort: { id: 'quiet', name: 'Quiet Ridge' },
    expect: {
      kind: 'Quiet',
      includes: ['Quiet Ridge is quiet', '7-day forecast stays under 2″'],
      excludes: ['Storm status:'],
    },
  },
  {
    id: 'winding-down',
    resort: { id: 'wind', name: 'Windham' },
    expect: {
      kind: 'Winding down',
      includes: ['just came through a storm', '9″ estimated in the last 72 hours', 'Only'],
    },
  },
  {
    id: 'peaking',
    resort: { id: 'peak', name: 'Peak Resort' },
    expect: {
      kind: 'Peaking',
      includes: ['in the heart of it', 'Heaviest Friday'],
    },
  },
  {
    id: 'active',
    resort: { id: 'active', name: 'Active Mountain' },
    expect: {
      kind: 'Active',
      includes: ['is in a live cycle'],
    },
  },
  {
    id: 'building-warm',
    resort: { id: 'warm', name: 'Warm Springs' },
    expect: {
      kind: 'Building',
      includes: ['Warm Springs is lining up a storm', 'above freezing'],
      excludes: ['heavy snow or rain at base'],
    },
  },
  {
    id: 'source-label',
    resort: { id: 'alta', name: 'Alta' },
    expect: { source: 'Last 72h is an Open-Meteo snowfall estimate, not a station observation. Next 7 days is an Open-Meteo forecast.' },
  },
  {
    id: 'swe-slr-not-measured',
    resort: { id: 'alta', name: 'Alta' },
    snow: {
      ...snow,
      observed: {
        alta: { snow72hCm: 22.86, snow24hCm: 2.54, source: 'snotel:766:UT:SNTL', method: 'swe-slr' },
      },
    },
    expect: {
      kind: 'Building',
      includes: ['from SNOTEL water equivalent in the last 72 hours'],
      excludes: ['measured in the last 72 hours', 'estimated in the last 72 hours', 'recorded snowfall'],
      source: 'Last 72h is SNOTEL SWE (WTEQ) converted at 12:1 — not recorded snowfall. Next 7 days is an Open-Meteo forecast.',
    },
  },
  {
    id: 'snwd-peak-not-snowfall',
    resort: { id: 'alta', name: 'Alta' },
    snow: {
      ...snow,
      observed: {
        alta: { snow72hCm: 22.86, snow24hCm: 2.54, source: 'snotel:766:UT:SNTL', method: 'snwd-peak' },
      },
    },
    expect: {
      kind: 'Building',
      includes: ['of SNOTEL snow-depth rise in the last 72 hours'],
      excludes: ['measured in the last 72 hours', 'recorded snowfall', 'estimated in the last 72 hours'],
      source: 'Last 72h is SNOTEL snow-depth (SNWD) peak-rise, not recorded snowfall. Next 7 days is an Open-Meteo forecast.',
    },
  },
];

export function runStormStatusEvals() {
  let fail = 0;
  const lines = [];
  for (const c of cases) {
    const out = stormStatus(c.resort, c.snow || snow, { units: 'in' });
    const miss = [];
    if (c.expect.kind && out.kind !== c.expect.kind) miss.push(`kind ${out.kind} != ${c.expect.kind}`);
    if (c.expect.source && out.source !== c.expect.source) miss.push(`source ${out.source}`);
    for (const chunk of c.expect.includes || []) {
      if (!out.text.includes(chunk)) miss.push(`missing "${chunk}" in "${out.text}"`);
    }
    for (const chunk of c.expect.excludes || []) {
      if (out.text.includes(chunk)) miss.push(`unexpected "${chunk}" in "${out.text}"`);
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

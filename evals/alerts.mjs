/**
 * evaluateAlerts cases: threshold, window, dedupe, quiet hours, pass filter.
 * Run via npm run eval.
 */
import { evaluateAlerts, shouldSendRecap, inQuietHours, dedupeKey, rankRecap } from '../lib/evaluateAlerts.js';

const snow = {
  today: 2,
  dates: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08'],
  resorts: {
    alta: { sf: [0, 0, 0, 15.24, 20.32, 0, 0, 0] },       // 6″ + 8″ on Dec 4–5 → 14″ / 48–72h, 8″ / 24h
    snowbird: { sf: [0, 0, 0, 5.08, 5.08, 5.08, 0, 0] }, // 2+2+2 = 6″ / 72h
    vail: { sf: [0, 0, 0, 30.48, 15.24, 0, 0, 0] },      // 12″ + 6″ = 18″ / 48h
  },
  index: [
    { id: 'alta', name: 'Alta', ikon: '7 days', epic: null, passes: ['ikon'], region: 'Utah', country: 'US' },
    { id: 'snowbird', name: 'Snowbird', ikon: '7 days', epic: null, passes: ['ikon'], region: 'Utah', country: 'US' },
    { id: 'vail', name: 'Vail', ikon: null, epic: 'Unlimited', passes: ['epic'], region: 'Colorado', country: 'US' },
  ],
  regions: [
    { id: 'utah', name: 'Utah', match: { region: ['Utah'] } },
    { id: 'colorado', name: 'Colorado', match: { region: ['Colorado'] } },
  ],
};

const noonPT = iso => new Date(iso); // already offset in string
const DAY = '2026-12-03';

function rule(extra = {}) {
  return {
    id: extra.id || 'rul_t',
    email: 'bailey@example.com',
    status: 'active',
    watch: extra.watch || 'resort',
    resorts: extra.resorts || ['alta'],
    pass: extra.pass,
    region: extra.region,
    minSnowIn: extra.minSnowIn ?? 12,
    windowHours: extra.windowHours ?? 72,
    lastKey: extra.lastKey,
    lastKeys: extra.lastKeys,
    lastFired: extra.lastFired,
    quiet: extra.quiet,
    tier: extra.tier || 'free',
    ...extra,
  };
}

const cases = [
  {
    id: 'threshold-below',
    rules: [rule({ minSnowIn: 18, resorts: ['alta'] })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 0, queued: 0 },
  },
  {
    id: 'threshold-hit',
    rules: [rule({ minSnowIn: 12, resorts: ['alta'] })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 1, lead: 'alta', minIn: 12 },
  },
  {
    id: 'window-24h-misses-48h-hit',
    rules: [
      rule({ id: 'rul_24', windowHours: 24, minSnowIn: 12, resorts: ['alta'] }),
      rule({ id: 'rul_48', windowHours: 48, minSnowIn: 12, resorts: ['alta'] }),
    ],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 1, ruleIds: ['rul_48'] },
  },
  {
    id: 'dedupe-same-pulse',
    rules: [rule({
      resorts: ['alta'],
      lastKey: dedupeKey('rul_t', 'alta', '2026-12-04', 12),
      lastKeys: [dedupeKey('rul_t', 'alta', '2026-12-04', 12)],
    })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 0 },
  },
  {
    id: 'quiet-hours-queue',
    rules: [rule({ resorts: ['alta'] })],
    now: `${DAY}T22:15:00-07:00`,
    expect: { send: 0, queued: 1 },
  },
  {
    id: 'after-quiet-sends',
    rules: [rule({ resorts: ['alta'] })],
    now: `${DAY}T08:00:00-07:00`,
    expect: { send: 1 },
  },
  {
    id: 'pass-ikon-skips-vail',
    rules: [rule({ id: 'rul_ikon', watch: 'pass', pass: 'ikon', resorts: [], minSnowIn: 12, windowHours: 48 })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 1, noResort: 'vail', hasResort: 'alta' },
  },
  {
    id: 'pass-epic-hits-vail',
    rules: [rule({ id: 'rul_epic', watch: 'pass', pass: 'epic', resorts: [], minSnowIn: 12, windowHours: 48 })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 1, lead: 'vail' },
  },
  {
    id: 'twelve-hour-cap',
    rules: [rule({ resorts: ['alta'], lastFired: new Date(`${DAY}T10:00:00-07:00`).toISOString() })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 0 },
  },
  {
    id: 'paid-tier-passthrough',
    rules: [rule({ resorts: ['alta'], tier: 'paid' })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 1, tier: 'paid' },
  },
  {
    id: 'region-utah',
    rules: [rule({ id: 'rul_ut', watch: 'region', region: 'utah', resorts: [], minSnowIn: 6, windowHours: 72 })],
    now: `${DAY}T12:00:00-07:00`,
    expect: { send: 1, hasResort: 'alta', noResort: 'vail' },
  },
];

export function runAlertEvals() {
  let fail = 0;
  const lines = [];
  for (const c of cases) {
    const out = evaluateAlerts(c.rules, snow, noonPT(c.now));
    const miss = [];
    if (c.expect.send != null && out.alerts.length !== c.expect.send) miss.push(`send ${out.alerts.length} != ${c.expect.send}`);
    if (c.expect.queued != null && out.queued.length !== c.expect.queued) miss.push(`queued ${out.queued.length} != ${c.expect.queued}`);
    const bag = [...out.alerts, ...out.queued];
    if (c.expect.lead && bag[0]?.lead?.resortId !== c.expect.lead) miss.push(`lead ${bag[0]?.lead?.resortId} != ${c.expect.lead}`);
    if (c.expect.minIn && bag[0] && bag[0].lead.snowIn + 1e-6 < c.expect.minIn) miss.push(`snowIn ${bag[0].lead.snowIn} < ${c.expect.minIn}`);
    if (c.expect.ruleIds) {
      const got = bag.map(a => a.ruleId).sort().join(',');
      const want = [...c.expect.ruleIds].sort().join(',');
      if (got !== want) miss.push(`rules ${got} != ${want}`);
    }
    if (c.expect.hasResort && !bag.some(a => a.affected.some(r => r.resortId === c.expect.hasResort))) {
      miss.push(`missing ${c.expect.hasResort}`);
    }
    if (c.expect.noResort && bag.some(a => a.affected.some(r => r.resortId === c.expect.noResort))) {
      miss.push(`unexpected ${c.expect.noResort}`);
    }
    if (c.expect.tier && bag[0]?.tier !== c.expect.tier) miss.push(`tier ${bag[0]?.tier} != ${c.expect.tier}`);
    if (miss.length) {
      fail++;
      lines.push(`FAIL  ${c.id}  ${miss.join('; ')}`);
    } else {
      lines.push(`ok    ${c.id}`);
    }
  }

  const quiet = inQuietHours(new Date(`${DAY}T22:00:00-07:00`));
  const open = inQuietHours(new Date(`${DAY}T10:00:00-07:00`));
  if (!quiet || open) { fail++; lines.push('FAIL  quiet-helper'); }
  else lines.push('ok    quiet-helper');

  const recapYes = shouldSendRecap(new Date('2026-12-06T19:30:00-08:00')); // Sunday
  const recapNo = shouldSendRecap(new Date('2026-12-07T19:30:00-08:00')); // Monday
  if (!recapYes || recapNo) { fail++; lines.push('FAIL  recap-sunday'); }
  else lines.push('ok    recap-sunday');

  const ranked = rankRecap(snow, { limit: 2 });
  if (ranked.incoming[0]?.id !== 'vail') { fail++; lines.push(`FAIL  rank-incoming  ${ranked.incoming[0]?.id}`); }
  else lines.push('ok    rank-incoming');

  return { fail, total: cases.length + 3, lines };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { fail, total, lines } = runAlertEvals();
  for (const l of lines) console.log(l);
  console.log(`\n${total - fail}/${total} alert evals passed`);
  process.exit(fail ? 1 : 0);
}

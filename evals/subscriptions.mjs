import { migrateRule, nextTripStage, consolidateAlerts, TRIP_CADENCE } from '../lib/subscriptions.js';
import { evaluateAlerts } from '../lib/evaluateAlerts.js';

export function runSubscriptionEvals() {
  let fail = 0;
  const lines = [];

  const r1 = migrateRule({ watch: 'region', region: 'utah', resorts: [] });
  if (r1.type !== 'region') { fail++; lines.push('FAIL  migrate-region'); }
  else lines.push('ok    migrate-region');

  const r2 = migrateRule({ resorts: ['alta'] });
  if (r2.type !== 'resort') { fail++; lines.push('FAIL  migrate-resort'); }
  else lines.push('ok    migrate-resort');

  const r3 = migrateRule({ resorts: ['mammoth'], tripStart: '2027-03-07' });
  if (r3.type !== 'trip') { fail++; lines.push('FAIL  migrate-trip'); }
  else lines.push('ok    migrate-trip');

  if (TRIP_CADENCE.join() !== '14,7,3,1,0') { fail++; lines.push('FAIL  cadence'); }
  else lines.push('ok    cadence');

  const hit = nextTripStage('2026-12-17', [], new Date('2026-12-03T12:00:00Z'));
  if (hit !== 14) { fail++; lines.push(`FAIL  next-stage-14  ${hit}`); }
  else lines.push('ok    next-stage-14');

  const skip = nextTripStage('2026-12-17', [14], new Date('2026-12-03T12:00:00Z'));
  if (skip != null) { fail++; lines.push('FAIL  next-stage-skip'); }
  else lines.push('ok    next-stage-skip');

  const off = nextTripStage('2026-12-17', [], new Date('2026-12-12T12:00:00Z'));
  if (off != null) { fail++; lines.push(`FAIL  next-stage-off-cadence  ${off}`); }
  else lines.push('ok    next-stage-off-cadence');

  const packs = consolidateAlerts([
    { email: 'a@b.com', headline: 'Alta', subject: 'Situation detected: Alta just got 4"', keys: ['k1'] },
    { email: 'a@b.com', headline: 'Japan', subject: 'Situation detected in Japan', keys: ['k2'] },
    { email: 'c@d.com', headline: 'Vail', subject: 'Situation detected: Vail', keys: ['k3'] },
  ]);
  if (packs.length !== 2 || packs[0].events.length !== 2) {
    fail++;
    lines.push(`FAIL  consolidate  ${packs.length}`);
  } else lines.push('ok    consolidate');

  const snow = {
    today: 2,
    dates: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08'],
    resorts: { alta: { sf: [0, 0, 0, 15, 20, 0, 0, 0] } },
    index: [{ id: 'alta', name: 'Alta', passes: ['ikon'], region: 'Utah', country: 'US' }],
    regions: [{ id: 'utah', name: 'Utah', match: { region: ['Utah'] } }],
  };
  const trip = evaluateAlerts([{
    id: 'rul_trip', email: 'a@b.com', status: 'active', type: 'trip',
    resorts: ['alta'], tripStart: '2026-12-17', tripEnd: '2026-12-24',
  }], snow, new Date('2026-12-03T12:00:00-07:00'));
  if (trip.alerts.length !== 1 || trip.alerts[0].stage !== 14) {
    fail++;
    lines.push(`FAIL  eval-trip  ${trip.alerts[0]?.stage}`);
  } else lines.push('ok    eval-trip');

  return { fail, total: 9, lines };
}

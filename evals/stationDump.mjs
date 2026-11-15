/**
 * CDEC (California) station parsing + observed snapshot, and the overnight
 * "dump" alert. Offline: no network.
 */
import { parseCdecTime, cdecSeries } from '../lib/cdec.js';
import { buildObservedSnapshot } from '../lib/snotel.js';
import { evaluateAlerts, forecastWindow } from '../lib/evaluateAlerts.js';
import { toObservation, validateObservation, sourceKindOf, SOURCE_KINDS } from '../lib/data/observation.js';
import { sourceById } from '../lib/data/sources.js';

function cdecRows(station, startIso, depths, swes) {
  const rows = [];
  const t0 = Date.parse(startIso);
  depths.forEach((v, h) => {
    const d = new Date(t0 + h * 3600000 - 8 * 3600000);
    const s = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()} ${d.getUTCHours()}:00`;
    rows.push({ stationId: station, SENSOR_NUM: 18, date: s, obsDate: s, value: v, units: 'INCHES' });
    rows.push({ stationId: station, SENSOR_NUM: 3, date: s, obsDate: s, value: swes[h], units: 'INCHES' });
  });
  return rows;
}

export async function runStationDumpEvals() {
  let fail = 0;
  const lines = [];
  const check = (id, ok, detail = '') => {
    if (ok) lines.push(`ok    ${id}`);
    else { fail++; lines.push(`FAIL  ${id}${detail ? `  ${detail}` : ''}`); }
  };

  // CDEC time is PST all year.
  check('cdec-time-pst', parseCdecTime('2026-11-13 4:00') === Date.parse('2026-11-13T12:00:00Z'));
  check('cdec-time-bad', parseCdecTime('nope') === null);

  // 72 hourly points: flat 20″, then +12″ over the last 24h (SWE rises too). One -9999 dropped.
  const depths = Array.from({ length: 72 }, (_, h) => (h < 48 ? 20 : 20 + Math.min(12, (h - 47) * 0.6)));
  const swes = Array.from({ length: 72 }, (_, h) => (h < 48 ? 5 : 5 + Math.min(1.2, (h - 47) * 0.06)));
  depths[10] = -9999;
  const series = cdecSeries(cdecRows('MHP', '2026-11-13T00:00:00Z', depths, swes));
  check('cdec-series-split', series.MHP?.SNWD.length === 71 && series.MHP?.WTEQ.length === 72,
    `${series.MHP?.SNWD.length}/${series.MHP?.WTEQ.length}`);

  const resorts = [
    { id: 'mammoth', name: 'Mammoth Mountain', country: 'US', center: [-119.02, 37.64] },
    { id: 'alta', name: 'Alta', country: 'US', center: [-111.64, 40.59] },
  ];
  const snow = { dates: ['2026-11-15'], today: 0, resorts: { mammoth: { sf: [16.1] }, alta: { sf: [0] } } };
  const snap = await buildObservedSnapshot({
    resorts, snow, map: {}, stationsData: [],
    cdecMap: { mammoth: { id: 'MHP', name: 'Mammoth Pass', elevFt: 9400, network: 'CDEC' } },
    cdecData: series,
  });
  const m = snap.resorts.mammoth;
  check('cdec-resort-source', m?.source === 'cdec:MHP', m?.source);
  check('cdec-resort-24h', Math.abs((m?.snow24hCm || 0) - 30.5) < 0.6, String(m?.snow24hCm));
  check('cdec-not-estimated', m?.method === 'snwd-peak' && m?.station?.network === 'CDEC');
  check('unmapped-still-model', snap.resorts.alta?.source === 'model-est');
  check('counts-cdec', snap.counts?.cdec === 1 && snap.counts?.est === 1);

  const obs = toObservation('mammoth', m, { retrievedAt: snap.fetched });
  check('cdec-observation-valid', validateObservation(obs).length === 0, validateObservation(obs).join(', '));
  check('cdec-source-kind', sourceKindOf('cdec:MHP') === SOURCE_KINDS.CDEC && obs.sourceRegistryId === 'cdec-ca-dwr');
  check('cdec-registry', sourceById('cdec-ca-dwr')?.usedInProduction === true);

  // CDEC failure (no data) → model-est, not a crash.
  const down = await buildObservedSnapshot({
    resorts, snow, map: {}, stationsData: [],
    cdecMap: { mammoth: { id: 'MHP' } }, cdecData: {},
  });
  check('cdec-missing-falls-back', down.resorts.mammoth?.source === 'model-est');

  // Overnight dump alert.
  const snowJson = {
    today: 0,
    dates: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'],
    resorts: { mammoth: { sf: [0, 0, 0, 0, 0, 0, 0, 0] }, june: { sf: [0, 0, 0, 0, 0, 0, 0, 0] } },
    observed: {
      mammoth: { snow24hCm: 25.4, snow72hCm: 30.5, source: 'cdec:MHP', method: 'snwd-peak' },
      june: { snow24hCm: 40, snow72hCm: 40, source: 'model-est', method: 'open-meteo-snowfall_sum' },
    },
    index: [
      { id: 'mammoth', name: 'Mammoth Mountain', passes: ['ikon'], ikon: 'Unlimited', region: 'California', country: 'US' },
      { id: 'june', name: 'June Mountain', passes: ['ikon'], ikon: 'Unlimited', region: 'California', country: 'US' },
    ],
    regions: [],
  };
  const rule = extra => ({
    id: 'rul_d', email: 'x@example.com', status: 'active', watch: 'resort',
    resorts: ['mammoth', 'june'], minSnowIn: 6, windowHours: 72, tier: 'free', ...extra,
  });
  const morning = new Date('2026-11-16T07:30:00-08:00');
  const r1 = evaluateAlerts([rule()], snowJson, morning);
  const dump = r1.alerts.find(a => a.event === 'dump');
  check('dump-fires-morning', !!dump && dump.lead.resortId === 'mammoth' && /10"/.test(dump.subject), dump?.subject);
  check('dump-skips-model-est', dump && dump.affected.every(a => a.resortId !== 'june'));
  check('dump-below-threshold', !evaluateAlerts([rule({ minSnowIn: 12 })], snowJson, morning).alerts.some(a => a.event === 'dump'));
  check('dump-not-afternoon', !evaluateAlerts([rule()], snowJson, new Date('2026-11-16T15:00:00-08:00')).alerts.some(a => a.event === 'dump'));
  check('dump-quiet-queues', evaluateAlerts([rule()], snowJson, new Date('2026-11-16T06:00:00-08:00')).queued.some(a => a.event === 'dump'));
  check('dump-dedupe-same-day', !evaluateAlerts([rule({ lastKeys: dump ? dump.keys : [] })], snowJson,
    new Date('2026-11-16T09:30:00-08:00')).alerts.some(a => a.event === 'dump'));
  check('dump-ignores-cooldown', evaluateAlerts([rule({ lastFired: new Date('2026-11-16T06:30:00-08:00').toISOString() })], snowJson, morning)
    .alerts.some(a => a.event === 'dump'));

  // Forecast window now includes local today.
  const fw = forecastWindow('x', { today: 0, dates: ['d0', 'd1', 'd2', 'd3'], resorts: { x: { sf: [20.32, 0, 0, 0] } } }, 72);
  check('forecast-counts-today', Math.round(fw.snowIn) === 8 && fw.pulseStart === 'd0', `${fw.snowIn} ${fw.pulseStart}`);

  return { fail, total: lines.length, lines };
}

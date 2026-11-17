/**
 * CDEC (California) station parsing + observed snapshot, and the overnight
 * "dump" alert. Offline: no network.
 */
import { parseCdecTime, cdecSeries } from '../lib/cdec.js';
import { buildObservedSnapshot, newSnowInches, observedFromSeries, cleanDepth, fetchJsonRetry } from '../lib/snotel.js';
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

  // ── Sensor faults (Nov 17: CDEC MHP depth read -201/-205 → Mammoth showed 80″) ──
  const hr = h => ({ t: Date.parse('2026-11-16T00:00:00Z') + h * 3600000, date: `h${h}` });
  const ser = vals => vals.map((v, h) => ({ ...hr(h), v }));
  const flatSwe = ser(Array.from({ length: 72 }, () => 1.32));
  const risingSwe = ser(Array.from({ length: 72 }, (_, h) => (h < 48 ? 1.32 : 1.32 + Math.min(0.48, (h - 47) * 0.02))));
  const faultDepth = ser(Array.from({ length: 72 }, (_, h) => (h % 5 === 0 ? -205 : (h % 7 === 0 ? 10 : -201))));
  const mhp = observedFromSeries(faultDepth, risingSwe);
  check('fault-depth-not-80in', mhp.snow24hCm < 20, String(mhp.snow24hCm));
  check('fault-depth-uses-swe', Math.abs(mhp.snow24hIn - 5.8) < 0.3 && mhp.method.startsWith('swe-slr'), `${mhp.snow24hIn} ${mhp.method}`);
  const allNeg = observedFromSeries(ser(Array.from({ length: 72 }, () => -205)), risingSwe);
  check('all-negative-depth-swe-fallback', allNeg.method === 'swe-slr' && allNeg.snwdIn === null, `${allNeg.method} ${allNeg.snwdIn}`);
  const cdecNeg = cdecSeries([{ stationId: 'MHP', SENSOR_NUM: 18, date: '2026-11-17 5:00', value: -201 }]);
  check('cdec-drops-negative', !cdecNeg.MHP || cdecNeg.MHP.SNWD.length === 0);

  const spiky = Array.from({ length: 72 }, () => 40);
  spiky[60] = 95;
  check('spike-dropped', cleanDepth(ser(spiky)).length === 71 && newSnowInches(ser(spiky), flatSwe, 24).inches === 0);
  const jump = ser(Array.from({ length: 72 }, (_, h) => (h < 50 ? 20 : 70)));
  const j = newSnowInches(jump, flatSwe, 24);
  check('unbacked-jump-rejected', j.inches === 0 && j.method === 'swe-slr-suspect-depth', `${j.inches} ${j.method}`);
  const realStorm = ser(Array.from({ length: 72 }, (_, h) => (h < 48 ? 20 : 20 + Math.min(40, (h - 47) * 2))));
  const realSwe = ser(Array.from({ length: 72 }, (_, h) => (h < 48 ? 5 : 5 + Math.min(3.5, (h - 47) * 0.175))));
  const rs = newSnowInches(realStorm, realSwe, 24);
  check('real-big-storm-kept', rs.inches === 40 && rs.method === 'snwd-peak', `${rs.inches} ${rs.method}`);
  const normal = newSnowInches(ser(depths.slice(0, 72).map(v => (v < 0 ? 20 : v))), ser(swes), 24);
  check('normal-dump-unchanged', Math.abs(normal.inches - 12) < 0.01, String(normal.inches));

  // ── NRCS AWDB outage (Nov 16–17: 502 failed two runs) ──
  const fake = codes => {
    let i = 0;
    return async () => { const c = codes[Math.min(i++, codes.length - 1)]; return { ok: c === 200, status: c, json: async () => ({ ok: 1 }) }; };
  };
  const got = await fetchJsonRetry('x', 'AWDB data', { delays: [0, 0], fetchImpl: fake([502, 502, 200]) });
  check('awdb-retries-502', got?.ok === 1);
  let threw404 = '';
  const f404 = fake([404, 200]);
  try { await fetchJsonRetry('x', 'AWDB data', { delays: [0, 0], fetchImpl: f404 }); } catch (e) { threw404 = e.message; }
  check('awdb-no-retry-404', threw404 === 'AWDB data 404', threw404);

  const nowT = new Date('2026-11-17T05:00:00Z');
  const usResorts = [{ id: 'alta', name: 'Alta', country: 'US', center: [-111.64, 40.59] }, { id: 'brighton', name: 'Brighton', country: 'US', center: [-111.58, 40.6] }];
  const prev = {
    fetched: '2026-11-16T23:00:00Z',
    resorts: {
      alta: { snow24hCm: 30, snow72hCm: 40, source: 'snotel:1308:UT:SNTL', retrievedAt: '2026-11-16T23:00:00Z', method: 'snwd-peak' },
      brighton: { snow24hCm: 10, snow72hCm: 10, source: 'snotel:366:UT:SNTL', retrievedAt: '2026-11-15T23:00:00Z', method: 'snwd-peak' },
    },
  };
  const awdbDown = async () => { throw new Error('AWDB data 502'); };
  const umap = { alta: { triplet: '1308:UT:SNTL' }, brighton: { triplet: '366:UT:SNTL' } };
  const out = await buildObservedSnapshot({ resorts: usResorts, snow: { dates: [], today: 0, resorts: {} }, map: umap, previous: prev, now: nowT, awdbFetch: awdbDown });
  check('outage-carries-recent', out.resorts.alta?.stale === true && out.resorts.alta.snow24hCm === 30 && out.counts.carried === 1);
  check('outage-old-row-to-est', out.resorts.brighton?.source === 'model-est');
  check('outage-warning', out.warnings?.includes('snotel-unavailable'));
  let liveThrew = false;
  try { await buildObservedSnapshot({ resorts: usResorts, snow: {}, map: umap, now: nowT, awdbFetch: awdbDown }); } catch { liveThrew = true; }
  check('live-path-still-throws', liveThrew);

  const staleJson = { ...snowJson, observed: { ...snowJson.observed, mammoth: { ...snowJson.observed.mammoth, stale: true } } };
  check('dump-skips-stale', !evaluateAlerts([rule()], staleJson, morning).alerts.some(a => a.event === 'dump'));

  return { fail, total: lines.length, lines };
}

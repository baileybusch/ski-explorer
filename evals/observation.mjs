import { readFileSync } from 'node:fs';
import { MAX_KM } from '../lib/snotel.js';
import { dumpParts } from '../lib/dumpScore.js';
import {
  SCHEMA, METRICS, SNOTEL_MAPPING, OBSERVATION_FIELDS,
  metricOf, toObservation, validateObservation, valueState, isRecordedSnowfall,
} from '../lib/data/observation.js';

export function runObservationEvals() {
  let fail = 0;
  const lines = [];
  const check = (id, ok, detail = '') => {
    if (ok) lines.push(`ok    ${id}`);
    else { fail++; lines.push(`FAIL  ${id}${detail ? `  ${detail}` : ''}`); }
  };

  check('schema-id', SCHEMA === 'skiscope.observation.v1');
  check('mapping-matches-snotel', SNOTEL_MAPPING.maxKm === MAX_KM && SNOTEL_MAPPING.elevGapM === 900);
  check('snwd-metric-is-depth-rise', metricOf('snwd-peak', 'snotel:766:UT:SNTL') === METRICS.SNWD_PEAK_RISE);
  check('swe-slr-metric', metricOf('swe-slr', 'snotel:766:UT:SNTL') === METRICS.SWE_SLR);
  check('model-metric', metricOf('open-meteo-snowfall_sum', 'model-est') === METRICS.OPEN_METEO_SNOWFALL_SUM);
  check('none-of-current-metrics-are-snowfall', !isRecordedSnowfall(METRICS.SNWD_PEAK_RISE) && !isRecordedSnowfall(METRICS.SWE_SLR) && !isRecordedSnowfall(METRICS.OPEN_METEO_SNOWFALL_SUM));
  check('missing-vs-zero', valueState(null) === 'missing' && valueState(0) === 'zero' && valueState(3) === 'present');

  const snwd = toObservation('brighton', {
    snow72hCm: 5.1, source: 'snotel:366:UT:SNTL', method: 'snwd-peak',
    observedAt: '2026-11-08T07:00:00',
    station: { triplet: '366:UT:SNTL', name: 'Brighton', lat: 40.6, lon: -111.58, elevFt: 8790, km: 0.1, network: 'SNTL' },
  }, { retrievedAt: '2026-11-08T17:45:52.236Z' });
  const snwdMiss = validateObservation(snwd);
  check('snwd-contract', snwdMiss.length === 0, snwdMiss.join('; '));
  check('snwd-not-snowfall-label', snwd.metric === METRICS.SNWD_PEAK_RISE && snwd.isRecordedSnowfall === false && snwd.quality.includes('snwd_not_snowfall'));
  check('snwd-station-mapping', snwd.station.triplet === '366:UT:SNTL' && snwd.mapping.maxKm === 45 && snwd.mapping.km === 0.1);
  check('no-fake-confidence', !('confidence' in snwd) && snwd.rawRef === null && snwd.revision === null);

  const zero = toObservation('copper', {
    snow72hCm: 0, source: 'snotel:415:CO:SNTL', method: 'noise',
    observedAt: '2026-11-08T09:00:00',
    station: { triplet: '415:CO:SNTL', name: 'Copper Mountain', km: 1.6, network: 'SNTL' },
  }, { retrievedAt: '2026-11-08T17:45:52.236Z' });
  check('zero-is-not-missing', zero.valueState === 'zero' && zero.value === 0 && validateObservation(zero).length === 0);

  const missing = toObservation('nowhere', {});
  check('missing-record', missing.valueState === 'missing' && missing.value == null && validateObservation(missing).length === 0);

  const forged = { ...snwd, isRecordedSnowfall: true, confidence: 0.9 };
  check('rejects-snowfall-and-confidence', validateObservation(forged).length >= 2);

  const file = JSON.parse(readFileSync(new URL('../public/data/observed.json', import.meta.url), 'utf8'));
  const retrievedAt = file.fetched;
  let bad = 0;
  let n = 0;
  for (const [id, rec] of Object.entries(file.resorts || {})) {
    n += 1;
    const obs = toObservation(id, rec, { retrievedAt });
    const miss = validateObservation(obs);
    if (miss.length) {
      bad += 1;
      if (bad <= 3) lines.push(`FAIL  snapshot-${id}  ${miss.join('; ')}`);
    }
    if (obs.isRecordedSnowfall || obs.metric === 'snowfall') bad += 1;
    if ('confidence' in obs) bad += 1;
  }
  check('snapshot-maps-to-contract', bad === 0, `n=${n} bad=${bad}`);
  check('alta-adapter-units-window', (() => {
    const alta = toObservation('alta', file.resorts.alta, { retrievedAt });
    return alta.units === 'cm' && alta.windowHours === 72 && alta.observedAt && alta.retrievedAt === retrievedAt && alta.resortId === 'alta';
  })());

  const parts = dumpParts({ id: 'alta' }, { observed: { alta: file.resorts.alta }, resorts: {}, today: 0, dates: [] });
  check('dumpParts-never-recorded-snowfall', parts.isRecordedSnowfall === false && parts.metric !== 'snowfall');
  check('field-list-complete', OBSERVATION_FIELDS.length >= 16);

  return { fail, total: lines.filter(l => l.startsWith('ok') || l.startsWith('FAIL')).length, lines };
}

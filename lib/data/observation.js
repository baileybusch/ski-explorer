/**
 * Canonical observation / provenance contract.
 *
 * Grounded in fields the pipeline already has. Does not invent confidence
 * scores, raw AWDB series, or revision logs we do not store.
 *
 * SNWD peak-rise is a snow-DEPTH proxy. It is not recorded snowfall.
 * WTEQ × 12:1 is a water-equivalent conversion. Open-Meteo snowfall_sum is a
 * model field. None of these are resort-reported storm totals.
 */
export const SCHEMA = 'skiscope.observation.v1';

export const METRICS = Object.freeze({
  SNWD_PEAK_RISE: 'snwd_peak_rise',
  SWE_SLR: 'swe_slr',
  OPEN_METEO_SNOWFALL_SUM: 'open_meteo_snowfall_sum',
  NONE: 'none',
});

export const SOURCE_KINDS = Object.freeze({
  SNOTEL: 'snotel',
  OPEN_METEO: 'open_meteo',
});

/** Mapping limits actually used by lib/snotel.js — not a quality score. */
export const SNOTEL_MAPPING = Object.freeze({ maxKm: 45, elevGapM: 900 });

export const OBSERVATION_FIELDS = Object.freeze([
  'schema',
  'resortId',
  'metric',
  'sourceKind',
  'sourceId',
  'sourceRegistryId',
  'value',
  'units',
  'windowHours',
  'observedAt',
  'retrievedAt',
  'station',
  'mapping',
  'valueState',
  'quality',
  'revision',
  'rawRef',
  'isRecordedSnowfall',
]);

export function metricOf(method, source) {
  if (method === 'swe-slr') return METRICS.SWE_SLR;
  if (method === 'snwd-peak') return METRICS.SNWD_PEAK_RISE;
  if (method === 'noise') return METRICS.NONE;
  if (method === 'open-meteo-snowfall_sum' || !source || String(source).startsWith('model-est')) {
    return METRICS.OPEN_METEO_SNOWFALL_SUM;
  }
  if (String(source).startsWith('snotel:')) return METRICS.SNWD_PEAK_RISE;
  return METRICS.OPEN_METEO_SNOWFALL_SUM;
}

export function sourceKindOf(source) {
  return String(source || '').startsWith('snotel:') ? SOURCE_KINDS.SNOTEL : SOURCE_KINDS.OPEN_METEO;
}

export function sourceRegistryIdOf(source) {
  return sourceKindOf(source) === SOURCE_KINDS.SNOTEL ? 'nrcs-snotel-awdb' : 'open-meteo-forecast';
}

/** Every metric we currently emit is a proxy or a model field — never recorded snowfall. */
export function isRecordedSnowfall(_metric) {
  return false;
}

export function valueState(cm) {
  if (cm == null || !Number.isFinite(Number(cm))) return 'missing';
  if (Number(cm) === 0) return 'zero';
  return 'present';
}

/** Flags we can actually compute. Never a 0–1 confidence. */
export function qualityFlags(method) {
  if (method === 'swe-slr') return ['swe_converted_12_1', 'snwd_did_not_rise'];
  if (method === 'snwd-peak') return ['snwd_not_snowfall'];
  if (method === 'noise') return ['pillow_flicker_discarded'];
  if (method === 'open-meteo-snowfall_sum') return ['model_estimate'];
  return [];
}

function stationMeta(station) {
  if (!station || typeof station !== 'object') return null;
  const out = {};
  if (station.triplet != null) out.triplet = station.triplet;
  if (station.name != null) out.name = station.name;
  if (station.lat != null) out.lat = station.lat;
  if (station.lon != null) out.lon = station.lon;
  if (station.elevFt != null) out.elevFt = station.elevFt;
  if (station.km != null) out.km = station.km;
  if (station.network != null) out.network = station.network;
  return Object.keys(out).length ? out : null;
}

/**
 * Normalize one observed.json resort record. Missing fields stay null.
 * Does not persist raw series (Hobby-bounded snapshots only).
 */
export function toObservation(resortId, rec, { retrievedAt = null, windowHours = 72 } = {}) {
  const source = rec?.source || null;
  const method = rec?.method || (sourceKindOf(source) === SOURCE_KINDS.SNOTEL ? 'snwd-peak' : 'open-meteo-snowfall_sum');
  const metric = rec?.metric || metricOf(method, source);
  const cm = rec?.snow72hCm;
  const state = rec?.valueState || valueState(cm);
  const station = stationMeta(rec?.station);
  return {
    schema: SCHEMA,
    resortId: resortId || null,
    metric,
    sourceKind: sourceKindOf(source),
    sourceId: source,
    sourceRegistryId: sourceRegistryIdOf(source),
    value: state === 'missing' ? null : Number(cm),
    units: 'cm',
    windowHours: rec?.windowHours || windowHours,
    observedAt: rec?.observedAt || null,
    retrievedAt: rec?.retrievedAt || retrievedAt || null,
    station,
    mapping: station
      ? { maxKm: SNOTEL_MAPPING.maxKm, elevGapM: SNOTEL_MAPPING.elevGapM, km: station.km ?? null }
      : null,
    valueState: state,
    quality: qualityFlags(method),
    revision: null,
    rawRef: null,
    isRecordedSnowfall: false,
  };
}

export function validateObservation(obs) {
  const miss = [];
  if (!obs || typeof obs !== 'object') return ['not an object'];
  for (const field of OBSERVATION_FIELDS) {
    if (!(field in obs)) miss.push(`missing ${field}`);
  }
  if (obs.schema !== SCHEMA) miss.push(`schema ${obs.schema}`);
  if (!Object.values(METRICS).includes(obs.metric)) miss.push(`metric ${obs.metric}`);
  if (!Object.values(SOURCE_KINDS).includes(obs.sourceKind)) miss.push(`sourceKind ${obs.sourceKind}`);
  if (obs.units !== 'cm') miss.push(`units ${obs.units}`);
  if (!['missing', 'zero', 'present'].includes(obs.valueState)) miss.push(`valueState ${obs.valueState}`);
  if (obs.valueState === 'missing' && obs.value != null) miss.push('missing must have null value');
  if (obs.valueState === 'zero' && obs.value !== 0) miss.push('zero must have value 0');
  if (obs.valueState === 'present' && !(Number.isFinite(obs.value) && obs.value !== 0)) miss.push('present needs nonzero value');
  if (obs.isRecordedSnowfall) miss.push('current metrics are not recorded snowfall');
  if (obs.confidence != null || obs.confidenceScore != null) miss.push('must not invent confidence');
  if (obs.metric === METRICS.SNWD_PEAK_RISE && obs.isRecordedSnowfall) {
    miss.push('SNWD peak-rise is not recorded snowfall');
  }
  if (obs.sourceKind === SOURCE_KINDS.SNOTEL && !obs.quality.includes('snwd_not_snowfall')
    && !obs.quality.includes('swe_converted_12_1') && !obs.quality.includes('pillow_flicker_discarded')) {
    miss.push('SNOTEL rows need a depth/SWE quality flag');
  }
  if (!Array.isArray(obs.quality)) miss.push('quality must be an array of known flags');
  if (obs.rawRef != null) miss.push('rawRef must stay null until an immutable store exists');
  return miss;
}

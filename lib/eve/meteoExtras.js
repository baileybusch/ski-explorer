/**
 * Live Open-Meteo extras the snow-expert skills reason from:
 * water (precip/SWE), snow-to-liquid ratio, wind, freezing/snow level, model spread.
 * All forecast fields are modeled estimates — never station observations.
 */
const MODELS = ['gfs_seamless', 'ecmwf_ifs025'];
const TTL_MS = 40 * 60 * 1000;
const cache = new Map();

function r1(n) {
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;
}

export function kmhToMph(kmh) {
  return kmh == null || !Number.isFinite(kmh) ? null : r1(kmh * 0.621371);
}

export function mToFt(m) {
  return m == null || !Number.isFinite(m) ? null : Math.round(m * 3.28084);
}

function series(daily, prefix, model) {
  return daily[`${prefix}_${model}`] || daily[prefix] || [];
}

function sum(arr) {
  return (arr || []).reduce((a, v) => a + (Number(v) || 0), 0);
}

function mean(nums) {
  const xs = nums.filter(n => n != null && Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function compass(deg) {
  if (deg == null || !Number.isFinite(deg)) return null;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function slr(snowCm, precipMm) {
  const snowIn = (Number(snowCm) || 0) / 2.54;
  const waterIn = (Number(precipMm) || 0) / 25.4;
  if (waterIn < 0.05) return null;
  return r1(snowIn / waterIn);
}

function feelFromSlr(ratio) {
  if (ratio == null) return null;
  if (ratio >= 15) return 'light / fluffy';
  if (ratio >= 12) return 'average-light';
  if (ratio >= 8) return 'average';
  return 'heavy / dense (cement)';
}

export function parseMeteoExtras(j, { baseM = null, summitM = null } = {}) {
  const daily = j.daily || {};
  const hourly = j.hourly || {};
  const models = MODELS.filter(m => (daily[`snowfall_sum_${m}`] || []).length);
  const modelIds = models.length ? models : ['best_match'];

  const days = (daily.time || []).map((date, i) => {
    const snows = modelIds.map(m => Number(series(daily, 'snowfall_sum', m)[i]) || 0);
    const waters = modelIds.map(m => Number(series(daily, 'precipitation_sum', m)[i]) || 0);
    const gusts = modelIds.map(m => Number(series(daily, 'wind_gusts_10m_max', m)[i]) || 0);
    const speeds = modelIds.map(m => Number(series(daily, 'wind_speed_10m_max', m)[i]) || 0);
    const dirs = modelIds.map(m => series(daily, 'wind_direction_10m_dominant', m)[i]).filter(v => v != null);
    const snowCm = mean(snows);
    const precipMm = mean(waters);
    const ratio = slr(snowCm, precipMm);
    return {
      date,
      snowCm: r1(snowCm),
      snowCmMin: r1(Math.min(...snows)),
      snowCmMax: r1(Math.max(...snows)),
      precipMm: r1(precipMm),
      waterIn: r1((precipMm || 0) / 25.4),
      slr: ratio,
      feel: feelFromSlr(ratio),
      windMph: kmhToMph(mean(speeds)),
      gustMph: kmhToMph(mean(gusts)),
      windDir: compass(mean(dirs)),
      estimated: true,
      models: Object.fromEntries(modelIds.map((m, k) => [m, { snowCm: r1(snows[k]), precipMm: r1(waters[k]) }])),
    };
  });

  const fzl = (hourly.freezing_level_height || []).filter(v => v != null && Number.isFinite(v));
  const snowLevelM = fzl.length ? mean(fzl) : null;
  const snowLevelFt = mToFt(snowLevelM);
  const baseFt = mToFt(baseM);
  const summitFt = mToFt(summitM);

  const next3 = days.slice(0, 3);
  const spreadSnow = days.flatMap(d => [d.snowCmMin, d.snowCmMax]).filter(v => v != null);
  const next7WaterIn = r1(days.reduce((a, d) => a + (d.waterIn || 0), 0));
  const next7SnowCm = r1(days.reduce((a, d) => a + (d.snowCm || 0), 0));
  const next7Slr = slr(next7SnowCm, days.reduce((a, d) => a + (d.precipMm || 0), 0));

  return {
    estimated: true,
    source: 'web-lookup / Open-Meteo models (gfs_seamless, ecmwf_ifs025). Forecast est. — not a station observation and not recorded snowfall.',
    models: modelIds,
    days,
    next3,
    next7SnowCm,
    next7WaterIn,
    next7Slr,
    feel: feelFromSlr(next7Slr),
    wind: {
      speedMph: next3[0]?.windMph ?? null,
      gustMph: Math.max(...next3.map(d => d.gustMph || 0), 0) || null,
      direction: next3[0]?.windDir ?? null,
      unit: 'mph',
      estimated: true,
    },
    snowLevel: {
      meanFt: snowLevelFt,
      meanM: snowLevelM == null ? null : Math.round(snowLevelM),
      vsBase: snowLevelFt != null && baseFt != null ? snowLevelFt - baseFt : null,
      rainAtBase: snowLevelFt != null && baseFt != null && snowLevelFt > baseFt + 500,
      baseFt,
      summitFt,
      estimated: true,
      label: 'Freezing level (Open-Meteo hourly mean, next 48h). Proxy for snow level. est.',
    },
    spread: {
      snowCmMin: spreadSnow.length ? r1(Math.min(...spreadSnow)) : null,
      snowCmMax: spreadSnow.length ? r1(Math.max(...spreadSnow)) : null,
      models: modelIds,
      label: 'Model spread across GFS and ECMWF IFS 0.25° daily snowfall_sum. est.',
    },
  };
}

export async function fetchMeteoExtras(resort, fetchImpl = fetch) {
  const lat = resort.center?.[1];
  const lon = resort.center?.[0];
  if (lat == null || lon == null) return null;
  const key = `${r1(lat)},${r1(lon)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.data;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'snowfall_sum,rain_sum,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
    hourly: 'freezing_level_height',
    forecast_days: '7',
    forecast_hours: '48',
    timezone: 'auto',
    models: MODELS.join(','),
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res || typeof res.json !== 'function') return null;
  if (res.ok === false) return null;
  const j = await res.json();
  const data = parseMeteoExtras(j, { baseM: resort.base, summitM: resort.summit });
  cache.set(key, { t: Date.now(), data });
  return data;
}

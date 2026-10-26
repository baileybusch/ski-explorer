/**
 * On-demand Open-Meteo weather. Reuses the same key-less API as the snow
 * snapshot. Cache aggressively (40 min). Never hourly-firehose the catalog:
 *   - list: current + 7-day daily, small batches of uncached visible rows
 *   - opened resort: same + hourly for 48h
 */
const TTL_MS = 40 * 60 * 1000;
const mem = new Map();

function elevOf(r) {
  if (r.summit && r.base) return Math.round(r.base + 0.6 * (r.summit - r.base));
  return null;
}

function cacheGet(id) {
  const hit = mem.get(id);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.data;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = JSON.parse(localStorage.getItem('ss_wx_' + id) || 'null');
      if (raw && Date.now() - raw.t < TTL_MS) {
        mem.set(id, raw);
        return raw.data;
      }
    } catch { /* */ }
  }
  return null;
}

function cacheSet(id, data) {
  const rec = { t: Date.now(), data };
  mem.set(id, rec);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem('ss_wx_' + id, JSON.stringify(rec)); } catch { /* quota */ }
  }
}

function parseOne(d, hourlyWanted) {
  if (!d || d.error) return null;
  const daily = d.daily || {};
  const current = d.current || {};
  const hourly = d.hourly || {};
  return {
    fetched: Date.now(),
    source: 'Open-Meteo forecast',
    elev: d.elevation,
    current: {
      tempC: current.temperature_2m,
      wcode: current.weather_code,
      windKmh: current.wind_speed_10m,
      windDir: current.wind_direction_10m,
      gustKmh: current.wind_gusts_10m,
    },
    daily: (daily.time || []).map((date, i) => ({
      date,
      wcode: daily.weather_code?.[i],
      tmax: daily.temperature_2m_max?.[i],
      tmin: daily.temperature_2m_min?.[i],
      snowCm: daily.snowfall_sum?.[i] || 0,
      precipMm: daily.precipitation_sum?.[i] || 0,
      windKmh: daily.wind_speed_10m_max?.[i],
      gustKmh: daily.wind_gusts_10m_max?.[i],
    })),
    hourly: hourlyWanted ? (hourly.time || []).slice(0, 48).map((time, i) => ({
      time,
      tempC: hourly.temperature_2m?.[i],
      snowCm: hourly.snowfall?.[i] || 0,
      wcode: hourly.weather_code?.[i],
      windKmh: hourly.wind_speed_10m?.[i],
      fzlM: hourly.freezing_level_height?.[i],
    })) : null,
  };
}

async function request(resorts, { hourly = false } = {}) {
  if (!resorts.length) return [];
  const params = new URLSearchParams({
    latitude: resorts.map(r => r.center[1]).join(','),
    longitude: resorts.map(r => r.center[0]).join(','),
    current: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max',
    forecast_days: '7',
    timezone: 'auto',
  });
  const elevs = resorts.map(elevOf);
  if (elevs.some(Boolean)) params.set('elevation', elevs.map(e => e ?? 'nan').join(','));
  if (hourly) {
    params.set('hourly', 'temperature_2m,snowfall,weather_code,wind_speed_10m,freezing_level_height');
    params.set('forecast_hours', '48');
  }
  const url = 'https://api.open-meteo.com/v1/forecast?' + params.toString();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Open-Meteo ' + res.status);
  let json = await res.json();
  if (!Array.isArray(json)) json = [json];
  return json.map((d, i) => ({ id: resorts[i].id, wx: parseOne(d, hourly) }));
}

/** Full weather for one opened resort (includes 48h hourly). */
export async function fetchResortWeather(r) {
  const cached = cacheGet(r.id);
  if (cached?.hourly) return cached;
  const [row] = await request([r], { hourly: true });
  if (row?.wx) cacheSet(r.id, row.wx);
  return row?.wx || cached || null;
}

/**
 * Current + 7-day for a small visible set. Skips cached ids.
 * Call with the first ~12 rows of the open list, not the whole catalog.
 */
export async function fetchListWeather(resorts, { limit = 12, batch = 8 } = {}) {
  const need = resorts.filter(r => !cacheGet(r.id)).slice(0, limit);
  const out = {};
  for (const r of resorts) {
    const hit = cacheGet(r.id);
    if (hit) out[r.id] = hit;
  }
  for (let i = 0; i < need.length; i += batch) {
    const chunk = need.slice(i, i + batch);
    try {
      const rows = await request(chunk, { hourly: false });
      for (const row of rows) {
        if (row.wx) { cacheSet(row.id, row.wx); out[row.id] = row.wx; }
      }
    } catch { /* keep cached / snapshot */ }
  }
  return out;
}

export function cachedWeather(id) {
  return cacheGet(id);
}

/** Snapshot fallback: temp + glyph from snow.json (no extra call). */
export function snapshotWeather(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const i = snow?.today ?? 0;
  return {
    source: 'snapshot',
    current: {
      tempC: rec.tmax?.[i] ?? rec.tmax?.[i],
      wcode: rec.wcode?.[i],
      windKmh: null,
    },
    daily: (snow?.dates || []).map((date, di) => ({
      date,
      wcode: rec.wcode?.[di],
      tmax: rec.tmax?.[di],
      tmin: rec.tmin?.[di],
      snowCm: rec.sf?.[di] || 0,
    })),
  };
}

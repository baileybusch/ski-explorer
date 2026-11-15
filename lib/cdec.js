/**
 * California Data Exchange Center (CDEC, California DWR) snow pillows.
 *
 * Most California snow sensors report to CDEC, not NRCS SNOTEL, so resorts
 * like Mammoth had no observed source and fell back to the model estimate.
 * Public state data, no key. Hourly sensors used here:
 *   18 = snow depth (inches), 3 = snow water content (inches).
 * CDEC reports in Pacific Standard Time all year (no daylight time).
 *
 * The reduction is the same as SNOTEL (newSnowInches in lib/snotel.js):
 * SNWD peak-rise, not recorded snowfall.
 */
const BASE = 'https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet';
const UA = { 'User-Agent': 'SkiScope/1.0 (github.com/baileybusch/ski-explorer)' };

export const SENSOR_SNWD = 18;
export const SENSOR_WTEQ = 3;
const MISSING = -9000;

/** "2026-11-13 4:00" (PST) → ms since epoch. */
export function parseCdecTime(s) {
  const m = String(s || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00-08:00`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function isoLocal(t) {
  // Keep the snapshot's observedAt style (local wall time, no offset), as SNOTEL does.
  const d = new Date(t - 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19);
}

/**
 * Split CDEC JSON rows into { [station]: { SNWD: [{t,v,date}], WTEQ: [...] } }.
 * Field names vary in case between CDEC responses, so read both spellings.
 */
export function cdecSeries(rows) {
  const out = {};
  for (const row of rows || []) {
    const station = String(row.stationId ?? row.STATION_ID ?? '').toUpperCase();
    const sensor = Number(row.SENSOR_NUM ?? row.sensorNum);
    const value = Number(row.value ?? row.VALUE);
    if (!station || !Number.isFinite(value) || value <= MISSING) continue;
    const t = parseCdecTime(row.obsDate || row.date || row.DATE_TIME);
    if (t == null) continue;
    const key = sensor === SENSOR_SNWD ? 'SNWD' : sensor === SENSOR_WTEQ ? 'WTEQ' : null;
    if (!key) continue;
    out[station] ||= { SNWD: [], WTEQ: [] };
    out[station][key].push({ t, v: value, date: isoLocal(t) });
  }
  for (const s of Object.values(out)) {
    s.SNWD.sort((a, b) => a.t - b.t);
    s.WTEQ.sort((a, b) => a.t - b.t);
  }
  return out;
}

export async function fetchCdecHourly(stations, { now = new Date() } = {}) {
  const ids = [...new Set((stations || []).filter(Boolean).map(s => String(s).toUpperCase()))];
  if (!ids.length) return {};
  const day = ms => new Date(ms).toISOString().slice(0, 10);
  const q = new URLSearchParams({
    Stations: ids.join(','),
    SensorNums: `${SENSOR_SNWD},${SENSOR_WTEQ}`,
    dur_code: 'H',
    Start: day(now.getTime() - 4 * 86400000),
    End: day(now.getTime() + 86400000),
  });
  const res = await fetch(`${BASE}?${q}`, { headers: UA });
  if (!res.ok) throw new Error(`CDEC ${res.status}`);
  return cdecSeries(await res.json());
}

/**
 * MET Norway Locationforecast 2.0 — free, global, commercial-ok with UA + attribution.
 * Snowfall is ESTIMATED from precip + temperature (not a reported snow depth).
 *
 * Snow-liquid ratio: 10:1 when Tmax ≤ 0°C (1 mm liquid ≈ 1 cm snow),
 * 8:1 when 0 < Tmax ≤ 2, none when Tmax > 2 (treat as rain).
 */
import { USER_AGENT } from '../config.js';

const SLR_COLD = 10;
const SLR_MIX = 8;

export function estimateSnowCm(precipMm, tmaxC) {
  const p = Number(precipMm) || 0;
  const t = tmaxC == null ? 0 : Number(tmaxC);
  if (t > 2) return 0;
  const slr = t <= 0 ? SLR_COLD : SLR_MIX;
  return (p * slr) / 10; // mm liquid * (cm snow / 10 mm liquid per SLR 10)
}

export async function fetchForecast({ lat, lon }) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`met.no ${res.status}`);
  const j = await res.json();
  const byDate = new Map();
  for (const ts of j.properties?.timeseries || []) {
    const date = String(ts.time || '').slice(0, 10);
    const d = ts.data?.instant?.details || {};
    const next = ts.data?.next_6_hours || ts.data?.next_1_hours || {};
    const precip = next.details?.precipitation_amount;
    const rec = byDate.get(date) || { date, precip: 0, tmax: -99, tmin: 99 };
    if (precip != null) rec.precip += precip;
    if (d.air_temperature != null) {
      rec.tmax = Math.max(rec.tmax, d.air_temperature);
      rec.tmin = Math.min(rec.tmin, d.air_temperature);
    }
    byDate.set(date, rec);
  }
  const days = [...byDate.values()].slice(0, 7).map(d => ({
    date: d.date,
    snowCm: estimateSnowCm(d.precip, d.tmax === -99 ? 0 : d.tmax),
    tmax: d.tmax === -99 ? null : d.tmax,
    tmin: d.tmin === 99 ? null : d.tmin,
    estimated: true,
  }));
  return {
    source: 'MET Norway Locationforecast 2.0 (estimated snow)',
    days,
    estimated: true,
    method: 'precip × SLR 10:1 (T≤0°C) or 8:1 (0–2°C); rain above 2°C',
  };
}

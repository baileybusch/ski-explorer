// Serverless snow refresh: fetches Open-Meteo for the resort grid and is cached at Vercel's CDN.
// Client loads the static public/data/snow.json first, then swaps in this fresher payload.
import idx from '../public/data/resorts-index.json' with { type: 'json' };
export const config = { maxDuration: 120 };
const N = 4, B = 100;
function points() {
  const pts = [];
  for (const r of idx) {
    const [x0, y0, x1, y1] = r.bbox, [cx, cy] = r.center;
    const px = Math.max(0.03, (x1 - x0) * 0.6), py = Math.max(0.025, (y1 - y0) * 0.6);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) pts.push({ id: r.id, k: 'g', x: +(cx - px + 2 * px * i / (N - 1)).toFixed(4), y: +(cy - py + 2 * py * j / (N - 1)).toFixed(4), e: 'nan' });
    pts.push({ id: r.id, k: 'c', x: cx, y: cy, e: r.summit && r.base ? Math.round(r.base + 0.6 * (r.summit - r.base)) : 'nan' });
  }
  return pts;
}
async function get(url) {
  for (let a = 0; a < 4; a++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'ski-explorer (github.com/baileybusch/ski-explorer)' } });
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 3000 * (a + 1)));
  }
  throw new Error('open-meteo failed');
}
export default async function handler(req, res) {
  try {
    const pts = points(), out = [];
    for (let k = 0; k < pts.length; k += B) {
      const c = pts.slice(k, k + B);
      const q = new URLSearchParams({ latitude: c.map(p => p.y).join(','), longitude: c.map(p => p.x).join(','), elevation: c.map(p => p.e).join(','), daily: 'snowfall_sum', hourly: 'snow_depth', past_days: '30', forecast_days: '7', timezone: 'America/Denver' });
      const d = await get('https://api.open-meteo.com/v1/forecast?' + q);
      out.push(...(Array.isArray(d) ? d : [d]));
    }
    const dates = out[0].daily.time;
    const today = new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 10);
    const ti = dates.indexOf(today) >= 0 ? dates.indexOf(today) : 30;
    const body = { generated: new Date().toISOString(), source: 'Open-Meteo forecast API (live, CDN-cached)', dates, today: ti, resorts: {}, grid: [] };
    pts.forEach((p, i) => {
      const d = out[i], sf = d.daily.snowfall_sum.map(v => Math.round((v || 0) * 10) / 10);
      if (p.k === 'g') body.grid.push([p.x, p.y, sf]);
      else body.resorts[p.id] = { sf, depth: dates.map((_, di) => { const v = d.hourly.snow_depth[di * 24 + 12]; return v == null ? null : Math.round(v * 100); }), elev: d.elevation };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=172800');
    res.status(200).json(body);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e.message || e) });
  }
}

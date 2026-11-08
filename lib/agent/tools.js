/**
 * Tools the LLM may call. Snow facts come from lib/skiscope-tools.
 * Trip-planning extras (live weather, flights, watchlist) stay here.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { windowMetrics } from '../snowWindow.js';
import { flightLinks, lodgingLinks } from '../links.js';
import { buildPlan } from '../trip.js';
import { fmtIn, C2F } from '../util.js';
import { findStorms } from '../storms.js';
import { fetchResortWeather, snapshotWeather } from '../weather.js';
import { makeAiTools } from '../skiscope-tools/index.js';

export function makeTools({ resorts, regions, snow, typical, history }) {
  const byId = Object.fromEntries((resorts || []).map(r => [r.id, r]));
  const shared = makeAiTools({ resorts, regions, snow, typical, history });

  return {
    ...shared,

    get_weather: tool({
      description: 'Current + 7-day forecast weather for one resort (temp, wind, snow, weather code). Open-Meteo only — do not invent numbers.',
      inputSchema: z.object({
        resortId: z.string(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      execute: async ({ resortId, from, to }) => {
        const r = byId[resortId];
        if (!r) return { error: 'unknown resort' };
        let wx = null;
        try { wx = await fetchResortWeather(r); } catch { wx = snapshotWeather(r, snow); }
        const cur = wx?.current || {};
        const daily = (wx?.daily || []).filter(d => (!from || d.date >= from) && (!to || d.date <= to)).slice(0, 7);
        return {
          id: r.id,
          name: r.name,
          source: wx?.source || 'snapshot',
          range: { from: from || null, to: to || null },
          tempF: cur.tempC == null ? null : Math.round(C2F(cur.tempC)),
          windKmh: cur.windKmh ?? null,
          wcode: cur.wcode ?? null,
          daily: daily.map(d => ({
            date: d.date, snowIn: fmtIn(d.snowCm || 0), tmaxF: d.tmax == null ? null : Math.round(C2F(d.tmax)), windKmh: d.windKmh ?? null,
          })),
        };
      },
    }),

    find_storms: tool({
      description: 'Resorts with a 72h forecast snowfall at or above minSnow inches. Forecast from the Open-Meteo snapshot, not typical and not observed.',
      inputSchema: z.object({
        region: z.string().optional().describe('gazetteer id such as utah, japan, colorado'),
        windowDays: z.number().int().min(3).max(10).optional(),
        minSnow: z.number().int().min(6).max(18).optional().describe('6, 12, or 18 inches'),
      }),
      execute: async ({ region, windowDays, minSnow }) => {
        const hits = findStorms({
          resorts, snow, region, regions, passOK: () => true, minIn: minSnow || 6, days: windowDays || 7,
        });
        return {
          source: 'Open-Meteo forecast snapshot',
          usAlerts: 'NWS winter alerts are a separate US-only map layer, not in this list.',
          storms: hits.slice(0, 12).map(({ r, storm }) => ({
            id: r.id, name: r.name, region: r.region, tierIn: storm.tier,
            max72In: fmtIn(storm.max72Cm), total7In: fmtIn(storm.totalCm),
            start: storm.start, peak: storm.peak,
          })),
        };
      },
    }),

    get_snow: tool({
      description: 'Modeled recent + forecast + typical snow for one resort and date window. Do not invent numbers.',
      inputSchema: z.object({
        resortId: z.string(),
        from: z.string().describe('YYYY-MM-DD'),
        to: z.string().describe('YYYY-MM-DD'),
      }),
      execute: async ({ resortId, from, to }) => {
        const r = byId[resortId];
        if (!r) return { error: 'unknown resort' };
        const win = { start: from, end: to, mode: 'custom' };
        const m = windowMetrics(r, snow, win, typical);
        return {
          id: r.id,
          name: r.name,
          recentIn: fmtIn(m.recent),
          outlookIn: fmtIn(m.outlookCm),
          typicalIn: fmtIn(m.typicalCm),
          usedTypical: m.usedTypical,
          usedForecast: m.usedForecast,
        };
      },
    }),

    build_trip_links: tool({
      description: 'Google Flights (primary) + lodging deep links. No prices.',
      inputSchema: z.object({
        resortId: z.string(),
        from: z.string(),
        to: z.string(),
        adults: z.number().int().min(1).max(12),
        kids: z.number().int().min(0).max(12),
        homeAirport: z.string().length(3),
      }),
      execute: async ({ resortId, from, to, adults, kids, homeAirport }) => {
        const r = byId[resortId];
        if (!r) return { error: 'unknown resort' };
        return {
          flights: flightLinks({ home: homeAirport, iata: r.iata, start: from, end: to, adults, kids }),
          lodging: lodgingLinks({ name: r.name, lat: r.center[1], lon: r.center[0], start: from, end: to, adults, kids }),
        };
      },
    }),

    make_plan_prompt: tool({
      description: 'Build the Plan-trip brief for ChatGPT/Grok from real snow + links.',
      inputSchema: z.object({
        resortIds: z.array(z.string()),
        from: z.string(),
        to: z.string(),
        adults: z.number(),
        kids: z.number(),
        homeAirport: z.string(),
      }),
      execute: async ({ resortIds, from, to, adults, kids, homeAirport }) => {
        const picked = resortIds.map(id => byId[id]).filter(Boolean);
        const win = { start: from, end: to };
        const trip = { home: homeAirport, adults, kids, start: from, end: to };
        const snowLabel = {};
        for (const r of picked) {
          const m = windowMetrics(r, snow, win, typical);
          snowLabel[r.id] = m.usedTypical && !m.usedForecast
            ? `typical ${fmtIn(m.typicalCm)}″ (not a forecast)`
            : `outlook ${fmtIn(m.outlookCm)}″, recent ${fmtIn(m.recent)}″`;
        }
        return { prompt: buildPlan({ resorts: picked, win, trip, snowLabel }) };
      },
    }),

    // Watchlist lives in the browser (localStorage). The model cannot read it;
    // it returns a UI action the front end applies.
    get_watchlist: tool({
      description: 'Watchlist is client-side. Do not invent items. Tell the UI to emit setWatchlist if the user wants changes.',
      inputSchema: z.object({}),
      execute: async () => ({
        note: 'Watchlist is in the browser. Return {type:"setWatchlist",add:[id],remove:[id]} as a UI action.',
      }),
    }),
    update_watchlist: tool({
      description: 'Ask the UI to add or remove resort ids from the local watchlist.',
      inputSchema: z.object({
        add: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional(),
      }),
      execute: async ({ add, remove }) => ({
        action: { type: 'setWatchlist', add: add || [], remove: remove || [] },
      }),
    }),
  };
}

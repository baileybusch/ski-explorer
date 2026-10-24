/**
 * Tools the LLM may call. Each one wraps logic we already use in the UI
 * so the model cannot invent snow depths or booking URLs.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { searchAll, resortsForRegion } from '../search.js';
import { windowMetrics } from '../snowWindow.js';
import { flightLinks, lodgingLinks } from '../links.js';
import { buildPlan } from '../trip.js';
import { fmtIn } from '../util.js';

export function makeTools({ resorts, regions, snow, typical }) {
  const byId = Object.fromEntries(resorts.map(r => [r.id, r]));

  return {
    search_resorts: tool({
      description: 'Find Ikon/Epic resorts by region name, resort name, or pass.',
      inputSchema: z.object({
        query: z.string().describe('Japan, Dolomites, Mammoth, Utah…'),
        pass: z.enum(['ikon', 'epic', 'all']).optional(),
      }),
      execute: async ({ query, pass }) => {
        const passOK = r => !pass || pass === 'all' || (r.passes || []).includes(pass);
        const { regions: regs, resorts: hits } = searchAll(query, { regions, resorts, passOK });
        const region = regs[0];
        const fromRegion = region ? resortsForRegion(region, resorts, passOK) : [];
        const list = (fromRegion.length ? fromRegion : hits).slice(0, 12);
        return {
          region: region ? { id: region.id, name: region.name } : null,
          resorts: list.map(r => ({ id: r.id, name: r.name, pass: r.passes, region: r.region, iata: r.iata })),
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

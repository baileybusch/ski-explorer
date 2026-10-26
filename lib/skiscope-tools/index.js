/**
 * One tool layer. MCP, search, alerts, and the readout writer call executeTool.
 */
import { tool } from 'ai';
import { impl } from './impl.js';
import { schemas, TOOL_NAMES } from './schemas.js';
import { catalogOf } from './catalog.js';

export { TOOL_NAMES, schemas } from './schemas.js';
export { loadCatalog, setCatalog, catalogOf, attribution } from './catalog.js';
export * from './impl.js';

const DESCRIPTIONS = {
  search_resorts: 'Find resorts by name, region, country, state, or pass. Read-only snow snapshot.',
  list_regions: 'List gazetteer regions SkiScope knows (Japan, California, Alps, Rockies…).',
  get_leaderboard: 'Rank resorts in a region/country/state/pass by last 72h, next 7d, dump score, season-to-date, or vs average.',
  get_resort_snow: 'Fallen last-72h and forecast next-7d for one resort. Headline is actual, never a combined dump.',
  get_resort_forecast: 'Daily forecast snowfall for one resort from the committed snapshot.',
  get_storm_status: 'Quiet / Building / Active / Peaking / Winding down plus the status sentence.',
  get_snow_history: '24h / 72h / storm / season-to-date and vs last-five same-date average.',
  compare_resorts: 'Side-by-side last 72h + next 7d for up to 8 resort ids.',
  plan_trip_snapshot: 'Snow so far, forecast, storm status, and season vs average for a resort and optional dates.',
};

function compact(args = {}) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) {
    if (v != null && v !== '') out[k] = v;
  }
  return out;
}

export function executeTool(name, args = {}, catalog) {
  const schema = schemas[name];
  if (!schema || !impl[name]) return { ok: false, error: `unknown tool ${name}`, data: null, text: `unknown tool ${name}` };
  const parsed = schema.safeParse(compact(args));
  if (!parsed.success) return { ok: false, error: parsed.error.message, data: null, text: 'bad arguments' };
  return impl[name](parsed.data, catalogOf(catalog));
}

export function listTools() {
  return TOOL_NAMES.map(name => ({
    name,
    description: DESCRIPTIONS[name],
    inputSchema: schemas[name],
  }));
}

/** AI SDK tool() map. Same execute as MCP. */
export function makeAiTools(catalog) {
  const out = {};
  for (const name of TOOL_NAMES) {
    out[name] = tool({
      description: DESCRIPTIONS[name],
      inputSchema: schemas[name],
      execute: async (args) => executeTool(name, args, catalog),
    });
  }
  return out;
}

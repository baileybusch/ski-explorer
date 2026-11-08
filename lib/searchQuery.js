/**
 * AI search: deterministic parse first, optional LLM refine, then the shared tool layer.
 * Never reads snow.json itself — executeTool owns the snapshot.
 */
import { generateText } from 'ai';
import { parseTripSentence } from './agent/parseTrip.js';
import { llmAvailable, defaultModel } from './agent/runAgent.js';
import { executeTool, makeAiTools, catalogOf } from './skiscope-tools/index.js';
import { ctaKind, ctaLabel, intentChip } from './intent.js';

export function intentToTool(parsed, units = 'in', pass) {
  if (parsed?.type === 'trip' && parsed.resort) {
    return { name: 'plan_trip_snapshot', args: { resort: parsed.resort.id, start: parsed.from || undefined, end: parsed.to || undefined, units } };
  }
  if (parsed?.type === 'resort' && parsed.resort) {
    return { name: 'get_resort_snow', args: { resort: parsed.resort.id, units } };
  }
  if (parsed?.type === 'compare' && parsed.ids?.length) {
    return { name: 'compare_resorts', args: { ids: parsed.ids, units } };
  }
  return {
    name: 'get_leaderboard',
    args: {
      region: parsed?.region?.id,
      country: parsed?.type === 'country' ? parsed.region?.id : undefined,
      state: parsed?.type === 'state' ? parsed.region?.id : undefined,
      pass: parsed?.pass || pass || undefined,
      metric: parsed?.metric || 'dump',
      units,
      limit: 16,
    },
  };
}

export function runSearch(text, ctx = {}) {
  const catalog = catalogOf(ctx.catalog || ctx);
  const parsed = parseTripSentence(text, { ...ctx, resorts: catalog.resorts, regions: catalog.regions });
  const call = intentToTool(parsed, ctx.units || 'in', ctx.pass);
  const result = executeTool(call.name, call.args, catalog);
  return {
    parsed,
    chip: intentChip(parsed),
    cta: { kind: ctaKind(parsed), label: ctaLabel(parsed) },
    tool: call,
    result,
    mode: 'deterministic',
  };
}

export async function runSearchMaybeLlm(text, ctx = {}) {
  const first = runSearch(text, ctx);
  if (!llmAvailable()) {
    console.info('[skiscope-search] gateway unavailable, deterministic parse');
    return first;
  }
  try {
    const catalog = catalogOf(ctx.catalog || ctx);
    const { text: out } = await generateText({
      model: defaultModel(),
      tools: makeAiTools(catalog),
      prompt: `Refine this ski-search intent. Reply with ONE JSON object:
{"type":"region|country|state|resort|trip|ranking|compare","region":{"id":"...","name":"..."}|null,"resort":{"id":"...","name":"..."}|null,"pass":"ikon"|"epic"|"all"|null,"metric":"past72"|"next7"|"dump"|"std"|"vsavg","from":null,"to":null}
Use tools only to confirm a resort or region. Do not invent snow numbers.
Query: ${text}
Deterministic guess: ${JSON.stringify(first.parsed)}`,
      maxOutputTokens: 250,
    });
    const json = (out || '').match(/\{[\s\S]*\}/);
    if (!json) return first;
    const extra = JSON.parse(json[0]);
    const parsed = { ...first.parsed, ...extra, q: first.parsed.q };
    const call = intentToTool(parsed, ctx.units || 'in', ctx.pass);
    const result = executeTool(call.name, call.args, catalog);
    return {
      parsed,
      chip: intentChip(parsed),
      cta: { kind: ctaKind(parsed), label: ctaLabel(parsed) },
      tool: call,
      result,
      mode: 'llm',
    };
  } catch (err) {
    console.warn('[skiscope-search] gateway failed, using parser', err?.message || err);
    return first;
  }
}

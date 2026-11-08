/**
 * Friend-style alert readouts. One model call per EVENT (not per subscriber).
 * Grounded in tool-layer facts. Deterministic fallback when Gateway is down.
 */
import { ToolLoopAgent, isStepCount, generateText } from 'ai';
import { createHash } from 'node:crypto';
import { executeTool, makeAiTools } from './skiscope-tools/index.js';
import { catalogOf } from './skiscope-tools/catalog.js';

export function llmAvailable() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export function defaultModel() {
  return process.env.AI_GATEWAY_MODEL || process.env.AI_READOUT_MODEL || 'openai/gpt-5.4-mini';
}

export function eventKey({ type, id, pulse, snapshot }) {
  const hash = createHash('sha256').update(JSON.stringify(snapshot || {})).digest('hex').slice(0, 12);
  return `${type || 'resort'}|${id || 'x'}|${pulse || 'now'}|${hash}`;
}

const NUMBER = /-?\d+(?:\.\d+)?/g;

export function extractNumbers(text) {
  return (String(text || '').match(NUMBER) || []).map(Number);
}

export function factsBlob(facts) {
  return JSON.stringify(facts ?? {});
}

/** Every number in `text` must appear in the facts JSON (as a number or in a string). */
export function validateReadout(text, facts) {
  const blob = factsBlob(facts);
  const nums = extractNumbers(text);
  const allowed = new Set(extractNumbers(blob));
  const invented = nums.filter(n => !allowed.has(n) && n !== 0);
  return { ok: invented.length === 0, invented };
}

export function deterministicReadout(event, facts = {}) {
  const kind = event?.type || 'resort';
  if (kind === 'region') {
    const rows = facts.rows || facts.leaderboard?.rows || [];
    const lead = rows[0];
    const where = facts.where || event.where || 'the region';
    if (!lead) return `Quiet in ${where}. Nothing over a couple of inches on the board.`;
    return `Situation in ${where}: ${lead.name} just put up ${lead.past72Label || lead.past72 + '"'} in the last 72h, with ${lead.next7Label || lead.next7 + '"'} still coming. That's the one I'd watch.`;
  }
  if (kind === 'trip') {
    const r = facts.resort || facts;
    const stage = event.stage;
    const when = stage === 0 ? 'this morning' : stage === 1 ? 'tomorrow' : `in ${stage} days`;
    return `${r.name || 'Your mountain'} ${when}: ${r.past72Label || '0″'} has fallen in the last 72h, ${r.next7Label || '0″'} is lined up. ${facts.storm?.kind || 'Quiet'} on the storm scale. ${facts.history?.verdict || ''}`.trim();
  }
  const r = facts.resort || facts;
  const name = r.name || event.resortName || 'The mountain';
  const past = r.past72Label || (r.past72 != null ? `${r.past72}″` : '0″');
  const next = r.next7Label || (r.next7 != null ? `${r.next7}″` : '0″');
  if (event.event === 'fresh_snow') {
    return `${name} just got ${past} in the last 72h. Another ${next} is on the board for the next week.`;
  }
  return `${name} has ${past} down in the last 72h, and ${next} still coming. I'd keep an eye on it.`;
}

export async function gatherFacts(event, catalog) {
  const cat = catalogOf(catalog);
  if (event.type === 'region') {
    return executeTool('get_leaderboard', {
      region: event.region, country: event.country, pass: event.pass, metric: 'past72', limit: 5, units: 'in',
    }, cat);
  }
  if (event.type === 'trip') {
    return executeTool('plan_trip_snapshot', {
      resort: event.resortId || event.resort, start: event.tripStart, end: event.tripEnd, units: 'in',
    }, cat);
  }
  const id = event.resortId || event.resort;
  const snow = executeTool('get_resort_snow', { resort: id, units: 'in' }, cat);
  const storm = executeTool('get_storm_status', { resort: id, units: 'in' }, cat);
  const hist = executeTool('get_snow_history', { resort: id, units: 'in' }, cat);
  const forecast = executeTool('get_resort_forecast', { resort: id, units: 'in' }, cat);
  const facts = { resort: snow.data, storm: storm.data, history: hist.data, forecast: forecast.data };
  return { ok: true, data: facts, text: snow.text, meta: snow.meta };
}

export async function writeReadout(event, { catalog, cache } = {}) {
  const gathered = await gatherFacts(event, catalog);
  const facts = gathered.data || {};
  const key = eventKey({
    type: event.type, id: event.resortId || event.region || event.resort,
    pulse: event.pulse || event.stage, snapshot: facts,
  });
  if (cache?.get) {
    const hit = await cache.get(key);
    if (hit) return { ...hit, cached: true, key };
  }
  const fallback = deterministicReadout(event, facts);
  let text = fallback;
  let mode = 'deterministic';
  if (llmAvailable()) {
    try {
      const tools = makeAiTools(catalog);
      const agent = new ToolLoopAgent({
        model: defaultModel(),
        instructions: `You write a short SkiScope alert like a friend texting. 1-3 sentences. No emoji spam. No hype.
Use only numbers from tool results. Do not invent closures, lifts, or snow totals.
Facts JSON: ${JSON.stringify(facts).slice(0, 1800)}`,
        tools,
        stopWhen: isStepCount(3),
      });
      const result = await agent.generate({ prompt: `Write the readout for this event: ${JSON.stringify({ type: event.type, event: event.event, stage: event.stage })}` });
      const candidate = (result.text || '').trim();
      const check = validateReadout(candidate, facts);
      if (candidate && check.ok) {
        text = candidate;
        mode = 'llm';
      } else {
        console.warn('[skiscope-readout] rejected invented numbers', check.invented);
      }
    } catch (err) {
      console.warn('[skiscope-readout] gateway failed, using template', err?.message || err);
    }
  } else {
    console.info('[skiscope-readout] gateway unavailable, deterministic template');
  }
  const out = { key, text, mode, facts, subject: event.subject || subjectFor(event, facts) };
  if (cache?.set) await cache.set(key, out);
  return out;
}

export function subjectFor(event, facts = {}) {
  if (event.type === 'region') {
    const where = facts.where || event.region || 'the region';
    return `Situation detected in ${where}`;
  }
  if (event.type === 'trip') {
    const name = facts.resort?.name || event.resortName || 'your trip';
    const stage = event.stage;
    const when = stage === 0 ? 'morning of' : stage === 1 ? 'tomorrow' : `T-${stage}`;
    return `Situation detected: ${name} ${when}`;
  }
  const name = facts.resort?.name || event.resortName || 'a resort';
  const n = facts.resort?.past72Label || '';
  return n ? `Situation detected: ${name} just got ${n}` : `Situation detected: ${name}`;
}

void generateText;

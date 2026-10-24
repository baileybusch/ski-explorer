/**
 * The harness: parse first, optionally ask an LLM with tools, always
 * return the same { mode, parsed, actions } shape the UI applies.
 *
 * LLM auth (no key in the repo):
 *   - On Vercel: VERCEL_OIDC_TOKEN is injected when OIDC is enabled
 *     (Project Settings → Security → OIDC). AI SDK uses it automatically.
 *   - Locally: set AI_GATEWAY_API_KEY, or `vercel link && vercel env pull`.
 * If neither is present we stay on the deterministic parser.
 */
import { ToolLoopAgent, isStepCount } from 'ai';
import { parseTripSentence, parsedToActions } from './parseTrip.js';
import { makeTools } from './tools.js';

export function llmAvailable() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export function defaultModel() {
  return process.env.AI_GATEWAY_MODEL || 'openai/gpt-5.4-mini';
}

export function runDeterministic(text, ctx) {
  const parsed = parseTripSentence(text, ctx);
  const actions = parsedToActions(parsed, ctx);
  return { mode: 'deterministic', parsed, actions };
}

export async function runLlm(text, ctx, parsed) {
  const tools = makeTools(ctx);
  const agent = new ToolLoopAgent({
    model: defaultModel(),
    instructions: `You parse ski-trip requests for SkiScope.
You already have a deterministic guess (JSON below). Use tools only to confirm resorts or snow.
Then reply with ONE JSON object: {"actions":[...]} using only these action types:
  {"type":"setTrip","trip":{start,end,adults,kids,home,pass}}
  {"type":"flyTo","kind":"region"|"resort","id":"..."}
  {"type":"showResorts","ids":["..."],"title":"..."}
  {"type":"openResort","id":"...","mode":"explore"|"plan"}
  {"type":"setWatchlist","add":["id"],"remove":["id"]}
  {"type":"setWatchOnly","on":true}
  {"type":"setSort","sort":"snow"|"name"}
Do not invent snow numbers or URLs. Prefer Ikon if the user did not name a pass.
Deterministic guess: ${JSON.stringify(parsed)}`,
    tools,
    stopWhen: isStepCount(4),
  });

  const result = await agent.generate({ prompt: text });
  let actions = parsedToActions(parsed, ctx);
  const json = (result.text || '').match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const extra = JSON.parse(json[0]);
      if (Array.isArray(extra.actions) && extra.actions.length) actions = extra.actions;
    } catch { /* keep deterministic actions */ }
  }
  return { mode: 'llm', parsed, actions, model: defaultModel(), text: result.text };
}

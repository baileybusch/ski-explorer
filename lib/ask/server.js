/**
 * Ask SkiScope on the server: AI SDK streamText + tools through the Vercel AI Gateway,
 * rendered client-side as typed tool parts (useChat). If the Gateway is unconfigured,
 * errors, or stalls before producing anything, the same message is answered by the
 * deterministic planner instead — no error chunk ever reaches the user.
 *
 * Cost guard (Gateway budget is ~$5/mo): small fast model, ≤4 steps, ≤600 output tokens,
 * last 6 messages only, per-IP rate limit in the handler, ASK_LLM=off kill switch.
 */
import { convertToModelMessages, createUIMessageStream, isStepCount, streamText, tool, toUIMessageStream } from 'ai';
import { z } from 'zod';
import { answerChunks, lastUserText, runAskTool } from './answer.js';

// Must be a model the team's Gateway tier can call: free-tier credits reject premium models
// ("Free tier users do not have access to this model").
export const ASK_MODEL_DEFAULT = 'openai/gpt-5.4-mini';

export function askModel() {
  return process.env.ASK_MODEL || process.env.AI_GATEWAY_MODEL || ASK_MODEL_DEFAULT;
}

/** Usage + Gateway-reported cost for one answer, summed over steps. Never includes credentials. */
export function answerUsage(steps = []) {
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let costKnown = false;
  for (const s of steps) {
    inputTokens += s?.usage?.inputTokens?.total ?? s?.usage?.inputTokens ?? 0;
    outputTokens += s?.usage?.outputTokens?.total ?? s?.usage?.outputTokens ?? 0;
    const c = Number(s?.providerMetadata?.gateway?.cost);
    if (Number.isFinite(c)) { cost += c; costKnown = true; }
  }
  return { steps: steps.length, inputTokens, outputTokens, costUsd: costKnown ? cost : null };
}

export function askLlmEnabled() {
  if (String(process.env.ASK_LLM || '').toLowerCase() === 'off') return false;
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

const Pass = z.enum(['ikon', 'epic', 'all']).optional().describe('Omit to use the board\'s pass. Set only when the user names a pass, or "all" for every resort.');
const Scope = {
  region: z.string().optional().describe('Gazetteer region id, e.g. japan, utah, california, alps, tahoe. Omit to use the board\'s region; "worldwide" to drop it.'),
  country: z.string().optional().describe('Two-letter country code as stored, e.g. US, CA, JP, CH'),
  state: z.string().optional().describe('US state or province name, e.g. Utah, Colorado'),
  pass: Pass,
};

export function askTools(cat) {
  return {
    rankResorts: tool({
      description: 'Rank resorts by actual snow that already fell (actual72h default, or actual24h) or by forecast snow for the next 7 days (forecast7d). Optional region/country/state/pass filter.',
      inputSchema: z.object({
        sort: z.enum(['actual72h', 'actual24h', 'forecast7d']).optional(),
        ...Scope,
        observedOnly: z.boolean().optional().describe('Only SNOTEL-observed US resorts. Omit to follow the board.'),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async input => runAskTool('rankResorts', input, cat),
    }),
    getResort: tool({
      description: 'One resort: actual last 72h/24h, forecast next 7 days, storm status, mountain facts, daily forecast, monthly historical averages.',
      inputSchema: z.object({ resort: z.string().describe('Resort id or name') }),
      execute: async input => runAskTool('getResort', input, cat),
    }),
    compareResorts: tool({
      description: 'Side-by-side actual and forecast snow plus facts for 2–4 resorts.',
      inputSchema: z.object({ ids: z.array(z.string()).min(2).max(4).describe('Resort ids or names') }),
      execute: async input => runAskTool('compareResorts', input, cat),
    }),
    monthClimatology: tool({
      description: 'Historical average snowfall for a calendar month (ERA5 archive, ~10 past seasons), ranked by resort. Omit month for a region month-by-month profile. A historical average — never a forecast.',
      inputSchema: z.object({
        month: z.number().int().min(1).max(12).optional(),
        ...Scope,
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async input => runAskTool('monthClimatology', input, cat),
    }),
  };
}

export function askInstructions(cat, { units = 'in' } = {}) {
  const snow = cat.snow || {};
  const today = snow.dates?.[snow.today] || 'today';
  const end = snow.dates?.[snow.dates.length - 1] || 'about a week out';
  const regions = (cat.regions || []).map(g => g.id).join(', ');
  const b = cat.board || {};
  const boardScope = [
    b.pass === 'ikon' ? 'Ikon resorts' : b.pass === 'epic' ? 'Epic resorts' : 'all resorts',
    b.regionId ? `in ${b.regionId}` : null,
    b.observedOnly ? 'observed only' : null,
  ].filter(Boolean).join(' ');
  return `You are Ask SkiScope, a ski-snow assistant for friends comparing who is getting the most snow.
Today is ${today}. The forecast runs through ${end} (about a week). Answer in ${units === 'cm' ? 'centimeters' : 'inches'}.
The user's board is showing ${boardScope}. Tools default to that scope, so your ranking matches the board; name the scope when it isn't all resorts. Override it only when the user names another pass or place, or asks about all resorts / the world.
Always call a tool before answering; never invent numbers, resorts, or dates. The app renders tool results as cards, so keep your reply to 1–3 short sentences that answer the question directly and name the leader. Do not list every row.
- "Actual" is snow that already fell: SNOTEL-observed in the US where mapped, otherwise modeled (say "est." when estimated is true). "Forecast" is the next 7 days. Give both equal weight.
- For questions about a month, season, or dates beyond ${end}, use monthClimatology and say plainly it is a historical average, not a forecast. Say the forecast cannot see that far.
- For a trip to a region without dates, call rankResorts for the region and monthClimatology without a month.
- Region ids: ${regions}.
Plain sentences, sentence case, no markdown headings or tables.`;
}

/**
 * Cheap tool-calling models to try, in order, when the team's Gateway plan restricts the
 * configured one (free credits answer "plan_restricted"). Paid credits lift the restriction
 * and the configured model is used again on the next cold start.
 */
export const ASK_MODEL_SUBSTITUTES = [
  'google/gemini-3.1-flash-lite',
  'deepseek/deepseek-v4-flash',
  'openai/gpt-oss-120b',
  'google/gemini-2.5-flash-lite',
  'mistral/mistral-small',
  'meta/llama-3.3-70b',
];

let substitute = null;
let eligibilityCheck = null;

/** Configured model unless this instance learned the plan restricts it. */
function activeModel() {
  return substitute || askModel();
}

/** True for the Gateway's plan/tier rejection (not for outages, timeouts or bad requests). */
export function isTierRejection(message = '') {
  return /free tier|paid credits|plan_restricted/i.test(message);
}

/** Pick the first substitute the Gateway reports eligible for this team. Logs ids and statuses only. */
export function pickSubstitute(rows = [], rejected = '') {
  const ok = new Set(rows.filter(m => m.model_eligibility?.status === 'eligible').map(m => m.id));
  return ASK_MODEL_SUBSTITUTES.find(id => id !== rejected && ok.has(id)) || null;
}

function resolveSubstitute(rejected) {
  eligibilityCheck ||= (async () => {
    const auth = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!auth) return null;
    try {
      const res = await fetch('https://ai-gateway.vercel.sh/v1/models?include_availability', { headers: { Authorization: `Bearer ${auth}` } });
      const body = await res.json();
      const rows = body.data || [];
      const mine = rows.find(m => m.id === rejected)?.model_eligibility;
      substitute = pickSubstitute(rows, rejected);
      console.warn(`[ask] gateway eligibility http=${res.status} account=${JSON.stringify(body.request_context_availability || null)} model=${rejected} status=${mine?.status || 'n/a'} reason=${mine?.reason || 'n/a'} substitute=${substitute || 'none'} substitutes=${ASK_MODEL_SUBSTITUTES.map(id => `${id}:${rows.find(m => m.id === id)?.model_eligibility?.status || 'n/a'}`).join(',')}`);
    } catch (err) {
      console.warn('[ask] gateway eligibility check failed', err?.message || err);
    }
    return substitute;
  })();
  return eligibilityCheck;
}

const MEANINGFUL = new Set(['text-delta', 'tool-output-available']);

/**
 * Pipe the model's UI stream into `writer`. `live` is false (nothing written) if it failed
 * before producing output; `tier` is true when the Gateway refused the model for the plan.
 */
async function pumpModel(writer, { messages, cat, units, signal, model }) {
  const id = typeof model === 'string' ? model : 'test-model';
  let tier = false;
  const tools = askTools(cat);
  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages.slice(-6), { tools, ignoreIncompleteToolCalls: true });
  } catch (err) {
    console.warn('[ask] could not convert history, answering deterministically', err?.message || err);
    return { live: false, tier };
  }
  const result = streamText({
    model,
    instructions: askInstructions(cat, { units }),
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(4),
    maxOutputTokens: 600,
    maxRetries: 1,
    timeout: { firstChunkMs: 8000, totalMs: 25000 },
    abortSignal: signal,
    onError: ({ error }) => {
      const msg = String(error?.message || error).replace(/\s+/g, ' ');
      tier ||= isTierRejection(msg);
      console.warn(`[ask] gateway error model=${id}:`, error?.name || 'Error', msg.slice(0, 160));
    },
    onFinish: ({ steps }) => {
      const u = answerUsage(steps);
      console.info(`[ask] llm model=${id} steps=${u.steps} in=${u.inputTokens} out=${u.outputTokens} cost=${u.costUsd == null ? 'n/a' : `$${u.costUsd.toFixed(6)}`}`);
    },
  });
  const ui = toUIMessageStream({ stream: result.stream, tools, sendStart: false, sendFinish: false, onError: () => '' });
  const reader = ui.getReader();
  const held = [];
  let live = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === 'error' || value.type === 'abort') {
        if (!live) return { live: false, tier };
        continue;
      }
      if (live) { writer.write(value); continue; }
      held.push(value);
      if (MEANINGFUL.has(value.type)) {
        live = true;
        for (const c of held) writer.write(c);
        held.length = 0;
      }
    }
  } catch (err) {
    if (!live) {
      console.warn('[ask] gateway failed before output, answering deterministically', err?.message || err);
      return { live: false, tier };
    }
  }
  return { live, tier };
}

/**
 * @param {{ messages: any[], cat: any, units?: string, useModel?: boolean, signal?: AbortSignal, model?: any }} opts  `model` overrides the Gateway model id (tests)
 * @returns {ReadableStream} UI message chunks
 */
export function askStream({ messages, cat, units = 'in', useModel = askLlmEnabled(), signal, model }) {
  const text = lastUserText(messages);
  return createUIMessageStream({
    onError: () => '',
    async execute({ writer }) {
      writer.write({ type: 'start' });
      let mode = 'fallback';
      let used = model || activeModel();
      if (useModel && text) {
        try {
          let run = await pumpModel(writer, { messages, cat, units, signal, model: used });
          if (!run.live && run.tier && !model) {
            const next = await resolveSubstitute(used);
            if (next && next !== used) {
              used = next;
              run = await pumpModel(writer, { messages, cat, units, signal, model: used });
            }
          }
          if (run.live) mode = 'llm';
        } catch (err) {
          console.warn('[ask] model path threw, answering deterministically', err?.message || err);
        }
      }
      writer.write({ type: 'message-metadata', messageMetadata: { mode, model: mode === 'llm' ? (typeof used === 'string' ? used : 'test-model') : null } });
      if (mode === 'fallback') {
        const { chunks } = answerChunks(text || 'most snow right now', cat, { units });
        for (const c of chunks) writer.write(c);
      }
      writer.write({ type: 'finish' });
    },
  });
}

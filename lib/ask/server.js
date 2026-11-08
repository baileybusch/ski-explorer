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

export const ASK_MODEL_DEFAULT = 'openai/gpt-6-luna';

export function askModel() {
  return process.env.ASK_MODEL || ASK_MODEL_DEFAULT;
}

export function askLlmEnabled() {
  if (String(process.env.ASK_LLM || '').toLowerCase() === 'off') return false;
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

const Pass = z.enum(['ikon', 'epic']).optional().describe('Only when the user names a pass');
const Scope = {
  region: z.string().optional().describe('Gazetteer region id, e.g. japan, utah, california, alps, tahoe'),
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
        observedOnly: z.boolean().optional().describe('Only SNOTEL-observed US resorts'),
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
  return `You are Ask SkiScope, a ski-snow assistant for friends comparing who is getting the most snow.
Today is ${today}. The forecast runs through ${end} (about a week). Answer in ${units === 'cm' ? 'centimeters' : 'inches'}.
Always call a tool before answering; never invent numbers, resorts, or dates. The app renders tool results as cards, so keep your reply to 1–3 short sentences that answer the question directly and name the leader. Do not list every row.
- "Actual" is snow that already fell: SNOTEL-observed in the US where mapped, otherwise modeled (say "est." when estimated is true). "Forecast" is the next 7 days. Give both equal weight.
- For questions about a month, season, or dates beyond ${end}, use monthClimatology and say plainly it is a historical average, not a forecast. Say the forecast cannot see that far.
- For a trip to a region without dates, call rankResorts for the region and monthClimatology without a month.
- Region ids: ${regions}.
Plain sentences, sentence case, no markdown headings or tables.`;
}

const MEANINGFUL = new Set(['text-delta', 'tool-output-available']);

/** Pipe the model's UI stream into `writer`; returns false (having written nothing) if it failed before producing output. */
async function pumpModel(writer, { messages, cat, units, signal, model }) {
  const tools = askTools(cat);
  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages.slice(-6), { tools, ignoreIncompleteToolCalls: true });
  } catch (err) {
    console.warn('[ask] could not convert history, answering deterministically', err?.message || err);
    return false;
  }
  const result = streamText({
    model: model || askModel(),
    instructions: askInstructions(cat, { units }),
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(4),
    maxOutputTokens: 600,
    maxRetries: 1,
    timeout: { firstChunkMs: 8000, totalMs: 25000 },
    abortSignal: signal,
    onError: ({ error }) => console.warn('[ask] gateway error:', error?.name || 'Error', String(error?.message || error).replace(/\s+/g, ' ').slice(0, 160)),
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
        if (!live) return false;
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
      return false;
    }
  }
  return live;
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
      if (useModel && text) {
        try {
          if (await pumpModel(writer, { messages, cat, units, signal, model })) mode = 'llm';
        } catch (err) {
          console.warn('[ask] model path threw, answering deterministically', err?.message || err);
        }
      }
      writer.write({ type: 'message-metadata', messageMetadata: { mode, model: mode === 'llm' ? (typeof model === 'string' ? model : model ? 'test-model' : askModel()) : null } });
      if (mode === 'fallback') {
        const { chunks } = answerChunks(text || 'most snow right now', cat, { units });
        for (const c of chunks) writer.write(c);
      }
      writer.write({ type: 'finish' });
    },
  });
}

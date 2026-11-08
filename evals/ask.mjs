/**
 * Ask SkiScope: deterministic planner, tool outputs, climatology labeling, and the
 * server stream — model success, model failure → silent fallback, and the HTTP handler.
 * No network: the model path uses MockLanguageModelV4.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readUIMessageStream, simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { loadCatalog, executeTool, TOOL_NAMES } from '../lib/skiscope-tools/index.js';
import { answerChunks, deterministicStream, planAnswer, mentionedResorts } from '../lib/ask/answer.js';
import { askStream } from '../lib/ask/server.js';
import { rankResorts, monthClimatology, getResort, compareResortsDetail } from '../lib/skiscope-tools/askTools.js';
import { compareBoard } from '../lib/dumpScore.js';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };

async function collect(stream) {
  let last = null;
  for await (const m of readUIMessageStream({ stream })) last = m;
  return last;
}

function userMsg(text) {
  return [{ id: 'u1', role: 'user', parts: [{ type: 'text', text }] }];
}

function toolModel() {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      call++;
      const chunks = call === 1
        ? [
          { type: 'tool-call', toolCallId: 'c1', toolName: 'rankResorts', input: JSON.stringify({ sort: 'actual72h', region: 'utah', limit: 3 }) },
          { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, logprobs: undefined, usage },
        ]
        : [
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Utah leader from the tool.' },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, logprobs: undefined, usage },
        ];
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
}

function brokenModel() {
  return new MockLanguageModelV4({
    doStream: async () => { throw Object.assign(new Error('Gateway: customer verification required'), { statusCode: 403 }); },
  });
}

function streamErrorModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks: [{ type: 'error', error: new Error('402 payment required') }] }) }),
  });
}

async function viaHttp(cat) {
  const { default: handler } = await import('../api/_ask.js');
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    req.body = JSON.parse(raw || '{}');
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
    await handler(req, res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: userMsg('best in March'), units: 'in' }),
    });
    const body = await resp.text();
    return { status: resp.status, type: resp.headers.get('content-type') || '', body };
  } finally {
    server.close();
  }
}

export async function runAskEvals() {
  const cat = loadCatalog();
  const lines = [];
  let fail = 0;
  let total = 0;
  const check = (name, ok, detail = '') => {
    total++;
    if (ok) lines.push(`ok    ${name}`);
    else { fail++; lines.push(`FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };

  const intents = [
    ['which resort is getting the most snow?', 'rank', { tool: 'rankResorts', sort: 'actual72h' }],
    ['good resort for a Japan ski trip', 'trip', { tool: 'rankResorts', region: 'japan' }],
    ['California resorts with the most projected snow', 'rank', { tool: 'rankResorts', sort: 'forecast7d', region: 'california' }],
    ['best resorts to go to in January', 'month', { tool: 'monthClimatology', month: 1 }],
    ['best resorts to go to in March', 'month', { tool: 'monthClimatology', month: 3 }],
    ['Alta vs Snowbird', 'compare', { tool: 'compareResorts' }],
    ['How is Jackson Hole looking?', 'resort', { tool: 'getResort' }],
    ['Utah snow in the last 24 hours', 'rank', { tool: 'rankResorts', sort: 'actual24h', region: 'utah' }],
    ['where should I ski in May', 'month', { tool: 'monthClimatology', month: 5, region: undefined }],
  ];
  for (const [text, intent, want] of intents) {
    const plan = planAnswer(text, cat);
    const s = plan.steps[0];
    const ok = plan.intent === intent && s.tool === want.tool
      && (want.sort === undefined || s.input.sort === want.sort)
      && (!('region' in want) || s.input.region === want.region)
      && (want.month === undefined || s.input.month === want.month);
    check(`plan "${text}"`, ok, `got ${plan.intent} ${JSON.stringify(plan.steps)}`);
  }
  check('mentioned resorts ignore "snow"/"best"', mentionedResorts('best snow right now', cat).length === 0);

  for (const sort of ['actual72h', 'actual24h', 'forecast7d']) {
    const out = rankResorts({ sort, limit: 12 }, cat);
    const board = { actual72h: 'actual72', actual24h: 'actual24', forecast7d: 'forecast7d' }[sort];
    const byId = new Map(cat.resorts.map(r => [r.id, r]));
    let mono = true;
    for (let i = 1; i < out.rows.length; i++) if (compareBoard(byId.get(out.rows[i - 1].id), byId.get(out.rows[i].id), cat.snow, board) > 0) mono = false;
    check(`rankResorts ${sort} matches board order`, mono && out.rows.length === 12);
  }
  const ut = rankResorts({ region: 'utah' }, cat);
  check('rankResorts region filter', ut.rows.length > 0 && ut.rows.every(r => /Utah/.test(r.where || '')));
  const fl = rankResorts({}, cat).forecastLeader;
  const maxNext = Math.max(...cat.resorts.map(r => rankResorts({ limit: 1 }, { ...cat, resorts: [r] }).rows[0].next7Cm));
  check('forecast leader is the max next-7d', !fl ? maxNext === 0 : Math.abs(fl.cm - maxNext) < 0.11);
  check('rankResorts carries attribution + horizon', !!ut.attribution && ut.horizonDays >= 5 && !!ut.forecastEnd);

  const clim = JSON.parse(readFileSync(new URL('../public/data/climatology.json', import.meta.url), 'utf8'));
  check('climatology.json is a labeled historical average', clim.kind === 'historical-average' && /not a forecast/i.test(clim.note) && Object.keys(clim.resorts).length >= 140);
  const mar = monthClimatology({ month: 3, limit: 8 }, cat);
  let desc = true;
  for (let i = 1; i < mar.rows.length; i++) if (mar.rows[i - 1].avgCm < mar.rows[i].avgCm) desc = false;
  check('monthClimatology March ranked desc', mar.kind === 'month' && mar.rows.length === 8 && desc);
  check('monthClimatology labeled not-a-forecast', mar.label === 'Historical average' && /not a forecast/i.test(mar.note));
  check('monthClimatology May (north) is out of archive', monthClimatology({ month: 5, region: 'utah' }, cat).outOfArchive === true);
  const prof = monthClimatology({ region: 'japan' }, cat);
  check('monthClimatology profile has a best month', prof.kind === 'profile' && prof.months.length >= 5 && !!prof.best);
  check('getResort facts + climate', (() => { const g = getResort({ resort: 'alta' }, cat); return g.found && g.resort.verticalM > 0 && g.climate?.avgCm?.[0] > 0; })());
  check('compareResorts dedupes and caps at 4', compareResortsDetail({ ids: ['alta', 'alta', 'snowbird', 'vail', 'park-city', 'jackson-hole'] }, cat).rows.length === 4);

  const m = answerChunks('best in March', cat).reply;
  check('month reply says historical, not forecast', /historical average/i.test(m) && /not a forecast/i.test(m) && /forecast, which only runs about/.test(m));
  const tripReply = answerChunks('good resort for a Japan ski trip', cat).reply;
  check('trip reply names the region and the snowiest month', /Japan/.test(tripReply) && /snowiest month/.test(tripReply));

  const fb = await collect(deterministicStream('most snow right now', cat, {}, { delayMs: 0 }));
  const fbTool = fb.parts.find(p => p.type === 'tool-rankResorts');
  check('client fallback stream → typed tool part + text', fb.metadata?.mode === 'fallback' && fbTool?.state === 'output-available' && fb.parts.some(p => p.type === 'text' && p.text.length > 20));

  const off = await collect(askStream({ messages: userMsg('Japan trip'), cat, useModel: false }));
  check('server, gateway off → fallback parts', off.metadata?.mode === 'fallback' && off.parts.some(p => p.type === 'tool-monthClimatology'));

  const ok = await collect(askStream({ messages: userMsg('most snow in Utah'), cat, useModel: true, model: toolModel() }));
  const okTool = ok.parts.find(p => p.type === 'tool-rankResorts');
  check('server, model ok → mode llm + tool part from real tool', ok.metadata?.mode === 'llm' && okTool?.state === 'output-available' && okTool.output.where === 'Utah' && ok.parts.some(p => p.type === 'text' && /Utah leader/.test(p.text)));

  const warn = console.warn;
  console.warn = () => {};
  try {
    const broken = await collect(askStream({ messages: userMsg('best in March'), cat, useModel: true, model: brokenModel() }));
    check('server, model throws → silent fallback', broken.metadata?.mode === 'fallback' && broken.parts.some(p => p.type === 'tool-monthClimatology') && !broken.parts.some(p => p.type === 'error'));
    const err = await collect(askStream({ messages: userMsg('most snow right now'), cat, useModel: true, model: streamErrorModel() }));
    check('server, model stream error → silent fallback', err.metadata?.mode === 'fallback' && err.parts.some(p => p.type === 'tool-rankResorts'));

    const http = await viaHttp(cat);
    check('POST /api/ask streams SSE with tool output', http.status === 200 && /text\/event-stream/.test(http.type) && http.body.includes('"tool-output-available"') && http.body.includes('[DONE]') && !http.body.includes('"type":"error"'), `${http.status} ${http.type}`);
  } finally {
    console.warn = warn;
  }

  check('MCP exposes the Ask tools', ['rank_resorts', 'get_resort', 'month_climatology'].every(n => TOOL_NAMES.includes(n)) && executeTool('rank_resorts', { sort: 'forecast7d', region: 'japan' }, cat).ok);

  return { fail, total, lines };
}

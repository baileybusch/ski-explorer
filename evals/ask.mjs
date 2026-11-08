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
import { answerChunks, deterministicStream, planAnswer, mentionedResorts, runAskTool } from '../lib/ask/answer.js';
import { askStream, answerUsage, isTierRejection, pickSubstitute, ASK_MODEL_SUBSTITUTES } from '../lib/ask/server.js';
import { rankResorts, monthClimatology, getResort, compareResortsDetail } from '../lib/skiscope-tools/askTools.js';
import { compareBoard, dumpParts } from '../lib/dumpScore.js';
import { rankBoard, regionResortIds, observedSnapshot, withObservedSnapshot } from '../lib/boardRank.js';
import { regionMatchesResort } from '../lib/search.js';

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

async function viaHttp(cat, extra = {}, text = 'best in March') {
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
      body: JSON.stringify({ messages: userMsg(text), units: 'in', ...extra }),
    });
    const body = await resp.text();
    return { status: resp.status, type: resp.headers.get('content-type') || '', body };
  } finally {
    server.close();
  }
}

/** The home board as App renders it, written out longhand so rankBoard is checked too. */
function boardOrderReference(cat, { pass = 'all', regionId = null, observedOnly = false, sort = 'actual72' } = {}) {
  const g = regionId ? cat.regions.find(x => x.id === regionId) : null;
  return cat.resorts
    .filter(r => pass === 'all' || (r.passes || []).includes(pass))
    .filter(r => !g || regionMatchesResort(g, r))
    .filter(r => !observedOnly || !dumpParts(r, cat.snow).estimated)
    .sort((a, b) => compareBoard(a, b, cat.snow, sort))
    .map(r => r.id);
}

const sameIds = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

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
    ['which resort is getting the most snow?', 'rank', { tool: 'rankResorts', sort: undefined }],
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
  // Chat ↔ board parity: for every board scope, the Ask answer's ranked rows are the board's top N.
  const ASK_SORT_TEXT = { actual72: 'most snow right now', actual24: 'most snow in the last 24 hours', forecast7d: 'most projected snow' };
  let parity = 0;
  const parityFails = [];
  for (const pass of ['all', 'ikon', 'epic']) {
    for (const regionId of [null, 'utah', 'alps']) {
      for (const observedOnly of [false, true]) {
        for (const sort of ['actual72', 'actual24', 'forecast7d']) {
          const board = { pass, regionId, observedOnly };
          const ref = boardOrderReference(cat, { ...board, sort });
          const shared = rankBoard(cat.resorts, cat.snow, { pass, ids: regionResortIds(cat.resorts, regionId && cat.regions.find(g => g.id === regionId), pass), observedOnly, sort }).map(r => r.id);
          const { outputs } = answerChunks(ASK_SORT_TEXT[sort], { ...cat, board });
          const out = outputs.find(o => o.tool === 'rankResorts')?.output;
          const ask = (out?.rows || []).map(r => r.id);
          const estOk = (out?.rows || []).every(r => r.estimated === dumpParts(cat.resorts.find(x => x.id === r.id), cat.snow).estimated);
          const ok = sameIds(shared, ref) && sameIds(ask, ref.slice(0, ask.length)) && out.total === ref.length && estOk;
          parity++;
          if (!ok) parityFails.push(`${pass}/${regionId || 'world'}/${observedOnly ? 'obs' : 'all'}/${sort}: ask ${ask.slice(0, 3)} board ${ref.slice(0, 3)}`);
        }
      }
    }
  }
  check(`rankResorts top-N == board order across ${parity} board scopes`, parityFails.length === 0, parityFails.slice(0, 3).join(' | '));

  const ikonBoard = boardOrderReference(cat, { pass: 'ikon' });
  const ikonAsk = answerChunks('which resort is getting the most snow right now?', { ...cat, board: { pass: 'ikon', regionId: null, observedOnly: false } });
  const ikonRows = ikonAsk.outputs[0].output.rows;
  check('default Ikon board: chat #1 is board #1 (no Epic-only leader)', ikonRows[0].id === ikonBoard[0] && ikonRows.every(r => cat.resorts.find(x => x.id === r.id).passes.includes('ikon')) && /among Ikon resorts/.test(ikonAsk.reply), ikonRows[0]?.id);
  const world = answerChunks('most snow anywhere in the world', { ...cat, board: { pass: 'all', regionId: 'utah', observedOnly: false } }).outputs[0].output;
  check('"anywhere in the world" drops the board region', world.regionId === null && world.rows[0].id === boardOrderReference(cat)[0]);
  const both = answerChunks('most snow on either pass, both passes', { ...cat, board: { pass: 'ikon', regionId: null, observedOnly: false } }).outputs[0].output;
  check('"both passes" overrides the board pass', both.pass === 'all');

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

    const http = await viaHttp(cat, { snapshot: observedSnapshot(cat.snow) });
    check('POST /api/ask streams SSE with tool output', http.status === 200 && /text\/event-stream/.test(http.type) && http.body.includes('"tool-output-available"') && http.body.includes('[DONE]') && !http.body.includes('"type":"error"'), `${http.status} ${http.type}`);

    // A client snapshot that differs from this instance's file: the server must rank the client's.
    const snap = observedSnapshot(cat.snow);
    const tail = boardOrderReference(cat, { pass: 'ikon' }).slice(-1)[0];
    snap.observed[tail] = { snow72hCm: 999, snow24hCm: 10, source: 'snotel:test' };
    snap.observed['not-a-resort'] = { snow72hCm: 1500, source: 'snotel:x' };
    const clientCat = withObservedSnapshot(cat, { ...snap, observed: Object.fromEntries(Object.entries(snap.observed).filter(([k]) => k !== 'not-a-resort')) });
    const want = boardOrderReference(clientCat, { pass: 'ikon' }).slice(0, 6);
    const viaSnap = await viaHttp(cat, { board: { pass: 'ikon' }, snapshot: snap }, 'most snow right now');
    const outLine = viaSnap.body.split('\n').find(l => l.includes('"tool-output-available"'));
    const got = outLine ? JSON.parse(outLine.replace(/^data: /, '')).output.rows.map(r => r.id) : [];
    check('POST /api/ask ranks the client board snapshot (same observed + est.)', want[0] === tail && sameIds(got, want), `got ${got.slice(0, 3)} want ${want.slice(0, 3)}`);
  } finally {
    console.warn = warn;
  }

  const onBoard = sort => runAskTool('rankResorts', {}, { ...cat, board: { pass: 'ikon', regionId: null, observedOnly: false, sort } });
  const forecastBoard = onBoard('forecast7d');
  check('rankResorts follows the board sort when the question names no window',
    onBoard('actual72').sort === 'actual72h' && onBoard('actual24').sort === 'actual24h' && forecastBoard.sort === 'forecast7d' && onBoard('name').sort === 'actual72h'
      && sameIds(forecastBoard.rows.map(r => r.id), rankBoard(cat.resorts, cat.snow, { pass: 'ikon', sort: 'forecast7d' }).slice(0, forecastBoard.rows.length).map(r => r.id)));
  check('a named window overrides the board sort', runAskTool('rankResorts', { sort: 'actual24h' }, { ...cat, board: { pass: 'ikon', sort: 'forecast7d' } }).sort === 'actual24h');

  const usage = answerUsage([
    { usage: { inputTokens: { total: 900 }, outputTokens: { total: 40 } }, providerMetadata: { gateway: { cost: '0.00012' } } },
    { usage: { inputTokens: { total: 1100 }, outputTokens: { total: 60 } }, providerMetadata: { gateway: { cost: 0.00018 } } },
  ]);
  check('answerUsage sums tokens and Gateway cost across steps', usage.inputTokens === 2000 && usage.outputTokens === 100 && Math.abs(usage.costUsd - 0.0003) < 1e-12, JSON.stringify(usage));
  check('answerUsage reports unknown cost as null', answerUsage([{ usage: { inputTokens: 5, outputTokens: 1 } }]).costUsd === null);
  check('tier rejection is recognized; outages are not', isTierRejection('Free tier users do not have access to this model. Upgrade to paid credits') && !isTierRejection('Gateway timeout'));
  const rows = [
    { id: 'openai/gpt-5.4-mini', model_eligibility: { status: 'ineligible', reason: 'plan_restricted' } },
    { id: ASK_MODEL_SUBSTITUTES[0], model_eligibility: { status: 'ineligible', reason: 'plan_restricted' } },
    { id: ASK_MODEL_SUBSTITUTES[2], model_eligibility: { status: 'eligible' } },
    { id: ASK_MODEL_SUBSTITUTES[3], model_eligibility: { status: 'eligible' } },
  ];
  check('substitute is the first eligible model in preference order', pickSubstitute(rows, 'openai/gpt-5.4-mini') === ASK_MODEL_SUBSTITUTES[2] && pickSubstitute([], 'x') === null);

  check('MCP exposes the Ask tools', ['rank_resorts', 'get_resort', 'month_climatology'].every(n => TOOL_NAMES.includes(n)) && executeTool('rank_resorts', { sort: 'forecast7d', region: 'japan' }, cat).ok);

  return { fail, total, lines };
}

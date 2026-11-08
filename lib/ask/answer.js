/**
 * Ask SkiScope deterministic answers. Pure — no fs, no network — so the Node handler
 * uses it when the AI Gateway is unavailable and the browser uses it when /api/ask is
 * unreachable. Emits the same tool parts the model would, so the UI is identical.
 */
import { parseTripSentence } from '../agent/parseTrip.js';
import { fmtIn } from '../util.js';
import {
  rankResorts, getResort, compareResortsDetail, monthClimatology, monthNumber, MONTH_NAMES,
} from '../skiscope-tools/askTools.js';

export const ASK_TOOLS = {
  rankResorts: (input, cat) => rankResorts(input, cat),
  getResort: (input, cat) => getResort(input, cat),
  compareResorts: (input, cat) => compareResortsDetail(input, cat),
  monthClimatology: (input, cat) => monthClimatology(input, cat),
};

export const ASK_TOOL_NAMES = Object.keys(ASK_TOOLS);

const BOARD_SCOPED = new Set(['rankResorts', 'monthClimatology']);

const BOARD_TO_ASK_SORT = { actual72: 'actual72h', actual24: 'actual24h', forecast7d: 'forecast7d' };

/** Fill pass / region / observed-only / sort from the board the user is looking at, unless the input names its own. */
export function withBoardDefaults(name, input, board) {
  if (!board || !BOARD_SCOPED.has(name)) return input;
  const out = { ...input };
  if (name === 'rankResorts' && out.sort == null && BOARD_TO_ASK_SORT[board.sort]) out.sort = BOARD_TO_ASK_SORT[board.sort];
  if (out.pass == null) out.pass = board.pass;
  if (out.region == null && out.country == null && out.state == null && board.regionId) out.region = board.regionId;
  if (name === 'rankResorts' && out.observedOnly == null) out.observedOnly = board.observedOnly;
  return out;
}

export function runAskTool(name, input, cat) {
  const fn = ASK_TOOLS[name];
  if (!fn) throw new Error(`unknown tool ${name}`);
  return fn(withBoardDefaults(name, input || {}, cat.board), cat);
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const COMMON = new Set(['snow', 'best', 'trip', 'most', 'resort', 'resorts', 'mountain', 'right', 'week', 'today', 'ski', 'skiing', 'the', 'big', 'good']);

export function mentionedResorts(text, cat) {
  const blob = ` ${norm(text)} `;
  const regionWords = new Set((cat.regions || []).flatMap(g => [g.id, g.name, ...(g.aliases || [])]).map(norm));
  const hits = [];
  for (const r of cat.resorts || []) {
    const needles = [r.name, r.id.replace(/-/g, ' '), ...(r.aliases || [])]
      .map(norm)
      .filter(n => n.length >= 4 && !regionWords.has(n) && !COMMON.has(n));
    let at = -1;
    for (const n of needles) {
      const i = blob.indexOf(` ${n} `);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at >= 0) hits.push({ id: r.id, name: r.name, at, len: Math.max(...needles.map(n => (blob.includes(` ${n} `) ? n.length : 0))) });
  }
  // "Snowbird" also matches inside nothing else; but "Niseko Grand Hirafu" vs "Niseko" — keep the longest match per position.
  hits.sort((a, b) => a.at - b.at || b.len - a.len);
  const out = [];
  for (const h of hits) {
    if (out.some(o => o.at === h.at)) continue;
    out.push(h);
  }
  return out.map(({ id, name }) => ({ id, name }));
}

const MONTH_RE = /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/;

export function monthFromText(text, today) {
  const low = norm(text);
  const m = low.match(MONTH_RE);
  if (m) return monthNumber(m[1]);
  if (/\b(in|during|for|early|mid|late|of)\s+may\b/.test(low)) return 5;
  const cur = Number(String(today || '').slice(5, 7)) || (new Date().getMonth() + 1);
  if (/\bthis month\b/.test(low)) return cur;
  if (/\bnext month\b/.test(low)) return (cur % 12) + 1;
  if (/\b(christmas|xmas|new year|holidays)\b/.test(low)) return 12;
  if (/\bpresidents?\s*day\b/.test(low)) return 2;
  return null;
}

const FORECAST_RE = /\b(forecast|projected|projection|coming|incoming|upcoming|next (?:few days|7|seven|week)|this weekend|next weekend|expected|will get|going to get|on the way|tomorrow)\b/;
const DAY_RE = /\b(24 ?h|24 hours|today|overnight|last night|since yesterday)\b/;
const WORLD_RE = /\b(world|worldwide|anywhere|everywhere|globally|on earth)\b/;
const TRIP_RE = /\b(trip|vacation|holiday|visit|go(?:ing)? to|good resorts?|where should|recommend|plan(?:ning)?|book)\b/;

/** The trip parser fuzzy-matches regions ("ski" → "superski"); Ask only scopes to a region the user named. */
function regionNamed(text, cat, id) {
  const g = (cat.regions || []).find(x => x.id === id);
  if (!g) return false;
  const blob = ` ${norm(text)} `;
  const tokens = blob.trim().split(' ');
  const needles = [g.id.replace(/-/g, ' '), g.name, ...(g.aliases || [])].map(norm).filter(n => n.length >= 3);
  return needles.some(n => blob.includes(` ${n} `) || (n.length >= 4 && tokens.some(t => t.length > n.length && t.startsWith(n))));
}

export function planAnswer(text, cat, ctx = {}) {
  const snow = cat.snow || {};
  const today = ctx.today || snow.dates?.[snow.today] || null;
  const forecastEnd = snow.dates?.[snow.dates.length - 1] || null;
  const parsed = parseTripSentence(text, { regions: cat.regions, resorts: cat.resorts, today: today || undefined });
  if (parsed.region && !regionNamed(text, cat, parsed.region.id)) parsed.region = null;
  const low = norm(text);
  const scope = {};
  if (parsed.region) scope.region = parsed.region.id;
  else if (WORLD_RE.test(low)) scope.region = 'worldwide';
  if (parsed.pass) scope.pass = parsed.pass;

  const mentioned = mentionedResorts(text, cat);
  const beyond = !!(parsed.from && forecastEnd && parsed.from > forecastEnd);
  let month = monthFromText(text, today);
  if (beyond && parsed.from) month = Number(parsed.from.slice(5, 7));
  const soon = !!(parsed.from && forecastEnd && today && parsed.from > today && parsed.from <= forecastEnd);
  const base = { parsed, scope, month, beyond, today, forecastEnd };

  if (mentioned.length >= 2) {
    return { ...base, intent: 'compare', steps: [{ tool: 'compareResorts', input: { ids: mentioned.slice(0, 4).map(r => r.id) } }] };
  }
  if (mentioned.length === 1) {
    return { ...base, intent: 'resort', steps: [{ tool: 'getResort', input: { resort: mentioned[0].id } }] };
  }
  if (month && !soon) {
    return { ...base, intent: 'month', steps: [{ tool: 'monthClimatology', input: { month, ...scope, limit: 6 } }] };
  }
  if (TRIP_RE.test(low) && parsed.region && !soon) {
    return {
      ...base,
      intent: 'trip',
      steps: [
        { tool: 'rankResorts', input: { ...scope, sort: 'actual72h', limit: 5 } },
        { tool: 'monthClimatology', input: { ...scope } },
      ],
    };
  }
  const sort = soon || FORECAST_RE.test(low) ? 'forecast7d' : DAY_RE.test(low) ? 'actual24h' : undefined;
  return { ...base, intent: 'rank', steps: [{ tool: 'rankResorts', input: { ...scope, ...(sort ? { sort } : {}), limit: 6 } }] };
}

export function fmtSnow(cm, units = 'in') {
  if (!Number.isFinite(cm)) cm = 0;
  return units === 'cm' ? `${Math.round(cm)} cm` : `${fmtIn(cm)}″`;
}

function inWhere(where) {
  return !where || where === 'Worldwide' ? '' : ` in ${where}`;
}

const PASS_NAME = { ikon: 'Ikon', epic: 'Epic' };

function scopeIn(out) {
  const p = PASS_NAME[out.pass];
  return `${p ? ` among ${p} resorts` : ''}${inWhere(out.where)}`;
}

function rankText(out, units) {
  const where = scopeIn(out);
  const top = out.rows[0];
  if (!top) return `I couldn't find any ${PASS_NAME[out.pass] ? `${PASS_NAME[out.pass]} ` : ''}resorts${inWhere(out.where)} for that.`;
  const fl = out.forecastLeader;
  const al = out.actualLeader;
  if (out.sort === 'forecast7d') {
    if (!fl) return `The forecast is dry${where}: no resort expects measurable snow in the next 7 days.`;
    let s = `${top.name} has the most projected snow${where}: ${fmtSnow(top.next7Cm, units)} over the next 7 days.`;
    if (al && al.id !== top.id) s += ` For snow that already fell, ${al.name} leads with ${fmtSnow(al.cm, units)} in the last 72 hours.`;
    return `${s} Forecasts beyond about a week aren't reliable, so check back as dates get closer.`;
  }
  if (out.sort === 'actual24h') {
    if (top.actual24Cm <= 0) return `Nothing measurable fell${where} in the last 24 hours.${fl ? ` ${fl.name} has the biggest forecast, ${fmtSnow(fl.cm, units)} over the next 7 days.` : ''}`;
    return `${top.name} got the most in the last 24 hours${where}: ${fmtSnow(top.actual24Cm, units)}${top.estimated ? ' (est.)' : ''}.${fl ? ` ${fl.id === top.id ? 'It also has' : `${fl.name} has`} the biggest forecast, ${fmtSnow(fl.cm, units)} over the next 7 days.` : ''}`;
  }
  if (!al) {
    return `It's quiet${where}: no resort has measurable snow in the last 72 hours.${fl ? ` ${fl.name} has the biggest forecast, ${fmtSnow(fl.cm, units)} over the next 7 days.` : ' The 7-day forecast is dry too.'}`;
  }
  let s = `${top.name} is getting the most snow${where}: ${fmtSnow(top.actual72Cm, units)} in the last 72 hours${top.estimated ? ' (est.)' : ''}.`;
  if (fl) s += fl.id === top.id ? ` It also leads the forecast with ${fmtSnow(fl.cm, units)} over the next 7 days.` : ` ${fl.name} has the biggest forecast, ${fmtSnow(fl.cm, units)} over the next 7 days.`;
  return s;
}

function monthText(out, plan, units) {
  const curMonth = Number(String(plan.today || '').slice(5, 7));
  const lead = out.month !== curMonth
    ? `${plan.beyond && /\d|spring|week/.test(plan.parsed?.dateLabel || '') ? 'Those dates are' : `${out.monthName} is`} past the forecast, which only runs about ${out.horizonDays || 7} days out, so this is the historical average. `
    : '';
  if (out.outOfArchive) {
    return `${lead}SkiScope's snowfall archive covers November to April in the Northern Hemisphere and June to September in the Southern, so I don't have ${out.monthName} averages${inWhere(out.where)}.`;
  }
  const top = out.rows[0];
  const second = out.rows[1];
  let s = `${lead}Historically, ${top.name} averages the most snow in ${out.monthName}${scopeIn(out)}: about ${fmtSnow(top.avgCm, units)} over ${top.seasons} seasons.`;
  if (second) s += ` ${second.name} is next at ${fmtSnow(second.avgCm, units)}.`;
  return `${s} That's a past-season average, not a forecast.`;
}

function profileText(out, units) {
  if (!out.best) return '';
  return `Historically, ${out.where === 'Worldwide' ? 'the snowiest month' : `${out.where}'s snowiest month`} is ${out.best.monthName}, averaging about ${fmtSnow(out.best.avgCm, units)} per resort.`;
}

function resortText(out, units) {
  if (!out.found) return `I couldn't find a resort called "${out.query}".`;
  const r = out.resort;
  const status = out.storm?.kind ? ` Storm status: ${String(out.storm.kind).toLowerCase()}.` : '';
  return `${r.name} has ${fmtSnow(r.actual72Cm, units)} in the last 72 hours${r.estimated ? ' (est.)' : ''} and ${fmtSnow(r.next7Cm, units)} forecast over the next 7 days.${status}`;
}

function compareText(out, units) {
  const rows = out.rows;
  if (rows.length < 2) return rows[0] ? `I only recognized ${rows[0].name}.` : `I couldn't find those resorts.`;
  const byActual = rows.slice().sort((a, b) => b.actual72Cm - a.actual72Cm)[0];
  const byForecast = rows.slice().sort((a, b) => b.next7Cm - a.next7Cm)[0];
  const parts = [];
  parts.push(byActual.actual72Cm > 0
    ? `${byActual.name} leads on recent snow with ${fmtSnow(byActual.actual72Cm, units)} in the last 72 hours${byActual.estimated ? ' (est.)' : ''}.`
    : 'None of them has measurable snow in the last 72 hours.');
  if (byForecast.next7Cm > 0) {
    parts.push(byForecast.id === byActual.id
      ? `It also has the bigger forecast, ${fmtSnow(byForecast.next7Cm, units)} over 7 days.`
      : `${byForecast.name} has the bigger forecast, ${fmtSnow(byForecast.next7Cm, units)} over 7 days.`);
  }
  return parts.join(' ');
}

export function composeReply(plan, outputs, ctx = {}) {
  const units = ctx.units === 'cm' ? 'cm' : 'in';
  const parts = [];
  for (const { tool, output } of outputs) {
    if (tool === 'rankResorts') {
      const t = rankText(output, units);
      parts.push(plan.intent === 'trip' ? t.replace(/^(\S.*?) is getting the most snow/, 'Right now $1 is getting the most snow') : t);
    }
    if (tool === 'monthClimatology') parts.push(output.kind === 'month' ? monthText(output, plan, units) : profileText(output, units));
    if (tool === 'getResort') parts.push(resortText(output, units));
    if (tool === 'compareResorts') parts.push(compareText(output, units));
  }
  if (plan.intent === 'trip') parts.push('Tell me your month and I can rank resorts by their historical average for it.');
  return parts.filter(Boolean).join(' ');
}

let seq = 0;
function callId(i) {
  seq = (seq + 1) % 1e6;
  return `fb-${Date.now().toString(36)}-${seq}-${i}`;
}

function textChunks(id, text) {
  const words = text.split(/(\s+)/);
  const out = [{ type: 'text-start', id }];
  for (let i = 0; i < words.length; i += 8) out.push({ type: 'text-delta', id, delta: words.slice(i, i + 8).join('') });
  out.push({ type: 'text-end', id });
  return out;
}

/** UI message chunks for one deterministic answer (no start/finish — the caller owns those). */
export function answerChunks(text, cat, ctx = {}) {
  const plan = planAnswer(text, cat, ctx);
  const outputs = plan.steps.map(s => ({ ...s, output: runAskTool(s.tool, s.input, cat) }));
  const reply = composeReply(plan, outputs, ctx);
  const chunks = [{ type: 'start-step' }];
  outputs.forEach((o, i) => {
    const id = callId(i);
    chunks.push({ type: 'tool-input-available', toolCallId: id, toolName: o.tool, input: o.input });
    chunks.push({ type: 'tool-output-available', toolCallId: id, output: o.output });
  });
  chunks.push({ type: 'finish-step' }, { type: 'start-step' });
  chunks.push(...textChunks(`fb-text-${Date.now().toString(36)}`, reply));
  chunks.push({ type: 'finish-step' });
  return { plan, outputs, reply, chunks };
}

export function lastUserText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const t = (m.parts || []).filter(p => p?.type === 'text').map(p => p.text).join(' ').trim();
    if (t) return t.slice(0, 400);
  }
  return '';
}

/** Full deterministic message as a stream of chunks, with a light typing cadence on text. */
export function deterministicStream(text, cat, ctx = {}, { delayMs = 12 } = {}) {
  const { chunks } = answerChunks(text, cat, ctx);
  const all = [{ type: 'start', messageMetadata: { mode: 'fallback' } }, ...chunks, { type: 'finish' }];
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= all.length) { controller.close(); return; }
      const c = all[i++];
      if (delayMs && c.type === 'text-delta') await new Promise(r => setTimeout(r, delayMs));
      controller.enqueue(c);
    },
  });
}

export { MONTH_NAMES };

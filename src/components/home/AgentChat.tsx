import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ArrowUpIcon, SquareIcon } from 'lucide-react';
import { useEveAgent } from 'eve/react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { GhostPrompt } from '@/components/GhostPrompt';
import { HOME_GHOSTS } from '@/lib/ghosts';
import { BRAND } from '@/lib/brand';
import type { SnowUnits } from '@/lib/format';
import type { RankOutput } from '@/lib/askTypes';
import {
  CompareAnswer, PartPending, RankedAnswer, ResortAnswer, SourcesNote,
} from '@/components/ask/AskParts';
import { ExpertSnowMeta } from '@/components/ask/ExpertSnowMeta';
import { WebLookupCard } from '@/components/home/WebLookupCard';
import { snowAmount } from '@/lib/format';
import { AskPanel } from '@/components/ask/AskPanel';
import { ChatMarkdown } from '@/components/home/ChatMarkdown';
import { prefersReducedMotion } from '@/lib/motion';

function unwrap(out: any) {
  if (!out) return out;
  return out.data && (out.data.kind || out.data.rows || out.data.found != null) ? out.data : out;
}

function ForecastCard({ out, units }: { out: any; units: SnowUnits }) {
  const days = out.extras?.days || out.days || [];
  return (
    <section className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10" data-testid="ask-forecast">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Forecast · Open-Meteo · est.</p>
      <h3 className="mt-1 text-lg font-semibold leading-tight">{out.name}</h3>
      {out.total ? <p className="mt-1 text-[15px]">Next {days.length || 7} days {typeof out.total === 'string' ? out.total : snowAmount(out.extras?.next7SnowCm ?? 0, units)} <span className="text-[10px] opacity-60">est.</span></p> : null}
      {days.length ? (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 text-left font-normal">Morning report</th>
              <th className="py-1 text-right font-normal">Snow</th>
              <th className="py-1 text-right font-normal">Water</th>
              <th className="py-1 text-right font-normal">Feel</th>
            </tr>
          </thead>
          <tbody>
            {days.slice(0, 5).map((d: any) => (
              <tr key={d.date} className="border-t border-foreground/8">
                <td className="py-1.5">{d.date}</td>
                <td className="py-1.5 text-right tabular">{d.snowCmMin != null ? `${snowAmount(d.snowCmMin, units)}–${snowAmount(d.snowCmMax, units)}` : snowAmount(d.snowCm, units)}</td>
                <td className="py-1.5 text-right tabular">{d.waterIn != null ? `${d.waterIn}″` : '—'}</td>
                <td className="py-1.5 text-right">{d.feel || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <ExpertSnowMeta out={out} units={units} />
    </section>
  );
}

function ToolCards({
  parts, units, onOpen, onShowBoard,
}: {
  parts: readonly any[];
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
}) {
  const outputs: any[] = [];
  const nodes = parts.map((part, i) => {
    if (part.type !== 'tool') return null;
    if (part.state === 'streaming' || (part.state !== 'completed' && !part.output)) {
      return <PartPending key={part.callId || i} label={part.label || 'Checking the snow'} />;
    }
    const data = unwrap(part.output);
    if (!data) return null;
    if (data.kind === 'web-lookup') return <WebLookupCard key={i} out={data} units={units} />;
    if (data.kind === 'rank') {
      outputs.push(data);
      return <RankedAnswer key={i} out={data} units={units} onOpen={onOpen} onShowBoard={onShowBoard} />;
    }
    if (data.kind === 'resort') {
      outputs.push(data);
      return <ResortAnswer key={i} out={data} units={units} onOpen={onOpen} />;
    }
    if (data.kind === 'compare') {
      outputs.push(data);
      return <CompareAnswer key={i} out={data} units={units} onOpen={onOpen} />;
    }
    if (data.kind === 'forecast') {
      outputs.push(data);
      return <ForecastCard key={i} out={data} units={units} />;
    }
    if (part.name === 'startReportSubscription') {
      return (
        <p key={i} className="rounded-xl bg-card px-3.5 py-3 text-sm ring-1 ring-foreground/10" data-testid="home-sub-note">
          {data.message || 'Check your email to confirm.'}
        </p>
      );
    }
    return null;
  });
  return (
    <>
      {nodes}
      <SourcesNote outputs={outputs} mode="eve" />
    </>
  );
}

function Composer({
  input, setInput, onSubmit, busy, onStop, showGhost, inputRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  onStop?: () => void;
  showGhost: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const typing = input.length > 0;
  return (
    <form className="border-t border-foreground/8 px-3 pt-2.5 pb-3" onSubmit={onSubmit} data-testid="home-chat-composer">
      <InputGroup className="h-12 rounded-full">
        <div className="relative min-w-0 flex-1">
          {showGhost && !typing ? (
            <GhostPrompt
              lines={HOME_GHOSTS}
              paused={typing}
              testid="home-chat-ghost"
              className="ghost-prompt pointer-events-none absolute inset-y-0 left-4 right-12 flex min-w-0 items-center truncate text-[15px] text-muted-foreground"
            />
          ) : null}
          <InputGroupInput
            ref={inputRef as any}
            value={input}
            onChange={e => setInput(e.target.value)}
            aria-label={`Ask ${BRAND.name}`}
            className="h-12 pl-4 text-base"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={400}
            placeholder={showGhost && !typing ? '' : 'Ask a follow-up…'}
          />
        </div>
        <InputGroupAddon align="inline-end">
          {busy && onStop ? (
            <InputGroupButton type="button" size="icon-sm" variant="outline" className="rounded-full" aria-label="Stop" onClick={onStop}>
              <SquareIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton type="submit" size="icon-sm" variant="outline" className="rounded-full" aria-label="Send" data-testid="home-chat-send" disabled={!input.trim()}>
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

/** No tokens or tool output for this long while busy = treat the turn as failed. */
const CHAT_STALL_MS = 40_000;

export const STARTER_PROMPTS = [
  "Where's it dumping right now?",
  "How's Mammoth looking?",
  'Compare Alta and Snowbird',
  'Is it a powder day at Palisades?',
];

const TOOL_LABEL: Record<string, string> = {
  getResortConditions: 'Checking the snow',
  getSnowForecast: 'Reading the forecast',
  compareResorts: 'Comparing mountains',
  getTrending: "Finding who's getting dumped on",
  searchResorts: 'Looking that up',
  lookupUnknownResort: 'Running a quick web lookup',
  startReportSubscription: 'Setting up your report',
};

function Chip({ children, onClick, testid, active }: { children: ReactNode; onClick: () => void; testid: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`min-h-9 rounded-full px-3.5 py-1.5 text-[13px] leading-tight ring-1 transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${active ? 'bg-foreground/[0.08] ring-foreground/25' : 'ring-foreground/15 hover:bg-foreground/[0.05]'}`}
    >
      {children}
    </button>
  );
}

function TypingBubble({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="home-chat-typing" aria-live="polite" aria-label={label || 'Thinking'}>
      <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-foreground/[0.06] px-3 py-2.5">
        <span className="chat-dot" />
        <span className="chat-dot [animation-delay:150ms]" />
        <span className="chat-dot [animation-delay:300ms]" />
      </span>
      {label ? <span className="text-xs text-muted-foreground">{label}…</span> : null}
    </div>
  );
}

type Followup = { label: string; send?: string; toggleData?: boolean };

const CARD_KINDS = ['resort', 'compare', 'rank', 'forecast', 'web-lookup'];

function cardsOf(m: any) {
  return (m?.parts || []).filter((p: any) => p.type === 'tool' && p.output).map((p: any) => unwrap(p.output))
    .filter((d: any) => d && CARD_KINDS.includes(d.kind));
}

function userTextBefore(messages: any[], idx: number) {
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return (messages[i].parts || []).map((p: any) => (p.type === 'text' ? p.text : '')).join('');
  }
  return '';
}

/**
 * 2–3 follow-up chips. Context comes from this answer's tool output, or from
 * the latest earlier answer that had one (e.g. after a "Why?" deep dive).
 */
function followupsFor(messages: any[], idx: number): Followup[] {
  const own = cardsOf(messages[idx]);
  let main = own[0];
  for (let i = idx - 1; !main && i >= 0; i--) main = cardsOf(messages[i])[0];
  const asked = userTextBefore(messages, idx).toLowerCase();
  const askedWhy = /\bwhy\b|walk me through/.test(asked);
  const askedData = /numbers|data/.test(asked);
  const data: Followup | null = own.length
    ? { label: 'Show the data', toggleData: true }
    : askedData ? null : { label: 'Show the numbers', send: 'Show me the key numbers.' };
  const why: Followup | null = askedWhy ? null : { label: 'Why?', send: 'Why? Walk me through it.' };
  const out: (Followup | null)[] = [];
  if (!main) {
    out.push({ label: "Where's it dumping?", send: "Where's it dumping right now?" }, { label: "How's Mammoth?", send: "How's Mammoth looking?" });
  } else if (main.kind === 'compare') {
    out.push(why, data, { label: 'Which has better snow?', send: 'Which one has the better snow quality?' });
  } else if (main.kind === 'rank') {
    const top = main.rows?.[0]?.name;
    out.push(askedWhy ? null : { label: 'Why there?', send: 'Why there? Walk me through it.' }, data, top ? { label: `How's ${top}?`, send: `How's ${top} looking?` } : null);
  } else {
    const name = main.resort?.name || main.name || 'there';
    out.push(why, data, { label: 'Where else is good?', send: `Where else should I go instead of ${name}?` });
  }
  return out.filter(Boolean).slice(0, 3) as Followup[];
}

function EveChat({
  units, onOpen, onShowBoard, input, setInput, askRequest, topNames,
}: {
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  input: string;
  setInput: (v: string) => void;
  askRequest: { text: string; n: number } | null;
  topNames: string[];
}) {
  const agent = useEveAgent({ prewarm: true });
  const rawBusy = agent.status === 'busy' || agent.status === 'resuming';
  const messages = agent.messages || [];
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const [shownData, setShownData] = useState<Set<string>>(() => new Set());
  const lastQ = useRef('');
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handledAsk = useRef<number | null>(null);
  const busy = rawBusy && !failed;
  // Progress signature: changes whenever tokens or tool parts arrive.
  const progress = messages.reduce((n: number, m: any) => n + JSON.stringify(m.parts || []).length, messages.length);
  const last: any = messages[messages.length - 1];

  useEffect(() => {
    if (agent.error && sent) setFailed(true);
  }, [agent.error, sent]);

  useEffect(() => {
    if (!rawBusy || failed) return;
    const t = window.setTimeout(() => {
      setFailed(true);
      agent.cancel().catch(() => {});
    }, CHAT_STALL_MS);
    return () => window.clearTimeout(t);
  }, [rawBusy, failed, progress]);

  useEffect(() => {
    if (sent && !rawBusy && last?.role === 'user') setFailed(true);
  }, [sent, rawBusy, last?.role, last?.id]);

  // Auto-scroll the thread as tokens stream in.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [progress, busy, failed]);

  async function ask(q: string) {
    lastQ.current = q;
    setFailed(false);
    setSent(false);
    try {
      await agent.send(q);
      setSent(true);
    } catch {
      setFailed(true);
    }
  }

  // Questions from outside the chat (thought-starter cards).
  useEffect(() => {
    if (!askRequest || handledAsk.current === askRequest.n) return;
    if (rawBusy && !failed) return;
    handledAsk.current = askRequest.n;
    void ask(askRequest.text);
  }, [askRequest, rawBusy, failed]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const q = input.trim().slice(0, 400);
    if (!q || busy) return;
    setInput('');
    await ask(q);
  }

  function toggleData(id: string) {
    setShownData(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // What the typing indicator says: the running tool, else nothing.
  const lastAssistant = last?.role === 'assistant' ? last : null;
  const lastText = lastAssistant ? (lastAssistant.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('').trim() : '';
  const runningTool = lastAssistant ? [...(lastAssistant.parts || [])].reverse().find((p: any) => p.type === 'tool' && p.state !== 'completed' && !p.output) : null;
  const showTyping = busy && (!lastAssistant || !lastText || !!runningTool);
  const typingLabel = runningTool ? (TOOL_LABEL[runningTool.name] || 'Checking the snow') : undefined;

  return (
    <>
      <div ref={scroller} className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-3.5 pt-4 pb-4 min-[720px]:px-5" data-testid="home-chat-scroll">
        {messages.length ? (
          <ol className="flex flex-col gap-3" data-testid="home-ask-thread">
            {messages.map((m: any) => {
              if (m.role === 'user') {
                const text = (m.parts || []).map((p: any) => (p.type === 'text' ? p.text : '')).join('');
                return (
                  <li key={m.id} className="flex justify-end" data-testid="home-ask-user">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[15px] leading-snug text-primary-foreground">{text}</p>
                  </li>
                );
              }
              const text = (m.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n\n').trim();
              const tools = (m.parts || []).filter((p: any) => p.type === 'tool' && p.output);
              const isLast = m.id === last?.id;
              const chips = isLast && !busy && !failed && text ? followupsFor(messages, messages.indexOf(m)) : [];
              const dataOpen = shownData.has(m.id);
              if (!text && !dataOpen) return null;
              return (
                <li key={m.id} className="flex flex-col items-start gap-2" data-testid="home-ask-answer">
                  {text ? (
                    <div className="max-w-[min(92%,62ch)] rounded-2xl rounded-bl-md bg-foreground/[0.06] px-3.5 py-2.5 text-[15px] leading-relaxed" data-testid="home-chat-bubble">
                      <ChatMarkdown text={text} />
                    </div>
                  ) : null}
                  {dataOpen && tools.length ? (
                    <div className="flex w-full max-w-[62ch] flex-col gap-3" data-testid="home-chat-data">
                      <ToolCards parts={tools} units={units} onOpen={onOpen} onShowBoard={onShowBoard} />
                    </div>
                  ) : null}
                  {chips.length ? (
                    <div className="flex flex-wrap gap-2 pt-0.5" data-testid="home-chat-followups">
                      {chips.map(c => (
                        <Chip
                          key={c.label}
                          testid="home-chat-followup"
                          active={c.toggleData && dataOpen}
                          onClick={() => (c.toggleData ? toggleData(m.id) : c.send ? void ask(c.send) : undefined)}
                        >
                          {c.toggleData && dataOpen ? 'Hide the data' : c.label}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
            {showTyping ? <li><TypingBubble label={typingLabel} /></li> : null}
            {failed ? (
              <li className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3.5 py-3 text-sm ring-1 ring-foreground/10" data-testid="home-chat-error" role="alert">
                <span>Sorry, the snow desk didn&rsquo;t answer. Try again in a moment.</span>
                <button type="button" className="rounded-full px-3 py-1 text-sm font-medium ring-1 ring-foreground/20 hover:bg-foreground/5" data-testid="home-chat-retry" onClick={() => { if (lastQ.current) void ask(lastQ.current); }}>
                  Retry
                </button>
              </li>
            ) : null}
          </ol>
        ) : (
          <EmptyState onPick={q => void ask(q)} />
        )}
      </div>
      <Composer input={input} setInput={setInput} onSubmit={send} busy={busy} onStop={() => agent.cancel()} showGhost={!messages.length} inputRef={inputRef} />
    </>
  );
}

export const GREETING = "Hey! Ask me where to ski, or how a mountain's looking.";

/** Greeting timeline (ms from first mount): typing dots, then type-in, then chips stagger in. */
export const GREETING_TIMING = { dots: 450, type: 1150, chipStagger: 90, chipFade: 260 };

// Module-level so the boot -> eve remount continues the animation instead of restarting it.
let greetingT0: number | null = null;

function useGreetingClock() {
  const reduce = typeof window === 'undefined' || prefersReducedMotion();
  const total = GREETING_TIMING.dots + GREETING_TIMING.type + GREETING_TIMING.chipStagger * STARTER_PROMPTS.length + GREETING_TIMING.chipFade;
  const [elapsed, setElapsed] = useState(() => {
    if (reduce) return Infinity;
    if (greetingT0 == null) greetingT0 = performance.now();
    return performance.now() - greetingT0;
  });
  useEffect(() => {
    if (reduce || elapsed >= total) return;
    let raf = 0;
    const tick = () => {
      const e = performance.now() - (greetingT0 ?? performance.now());
      setElapsed(e);
      if (e < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return elapsed;
}

/**
 * Empty chat: the greeting "streams in" like a live agent message (client-side,
 * no model call). Typing dots, then the text types in over ~1.15s, then the
 * starter chips stagger in. Reduced motion shows everything at once. The input
 * below is usable the whole time.
 */
function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const t = useGreetingClock();
  const { dots, type, chipStagger } = GREETING_TIMING;
  const typing = t >= dots;
  const typed = t === Infinity ? GREETING.length : Math.max(0, Math.min(GREETING.length, Math.round(((t - dots) / type) * GREETING.length)));
  const done = typed >= GREETING.length;
  const phase = !typing ? 'dots' : done ? 'done' : 'typing';
  return (
    <div className="flex flex-col gap-3" data-testid="home-chat-empty-state" data-greeting={phase}>
      {phase === 'dots' ? (
        <TypingBubble />
      ) : (
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-foreground/[0.06] px-3.5 py-2.5 text-[15px] leading-relaxed" data-testid="home-chat-empty" aria-label={GREETING}>
          {/* Invisible full text reserves the bubble's final size, so nothing jumps while typing. */}
          <span className="grid">
            <span className="invisible col-start-1 row-start-1" aria-hidden>{GREETING}</span>
            <span className="col-start-1 row-start-1" aria-hidden>
              {GREETING.slice(0, typed)}
              {!done ? <span className="chat-caret" /> : null}
            </span>
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2" data-testid="home-chat-starters">
        {STARTER_PROMPTS.map((q, i) => {
          const shown = t === Infinity || t >= dots + type + chipStagger * i;
          return (
            <span
              key={q}
              className="transition-[opacity,transform] duration-[260ms] ease-out motion-reduce:transition-none"
              style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(4px)' }}
              data-shown={shown ? '1' : '0'}
            >
              <Chip testid="home-chat-starter" onClick={() => onPick(q)}>{q}</Chip>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AgentChat({
  units, catalog, onOpen, onShowBoard, board, externalAsk = null, topNames = [],
}: {
  units: SnowUnits;
  catalog: any;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  board: { pass: 'ikon' | 'epic' | 'all'; regionId: string | null; observedOnly: boolean };
  /** A question sent from outside the chat (e.g. a thought-starter card). */
  externalAsk?: { text: string; n: number } | null;
  /** Trending resort names, for follow-up chips like "vs Alta". */
  topNames?: string[];
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'boot' | 'eve' | 'fallback'>('boot');
  const [askOpen, setAskOpen] = useState(false);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);
  const handledExternal = useRef<number | null>(null);

  useEffect(() => {
    let gone = false;
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 2500);
    fetch('/eve/v1/health', { signal: ac.signal, headers: { Accept: 'application/json' } })
      .then(async r => {
        if (!r.ok) throw new Error('unhealthy');
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) throw new Error('not-json');
        const body = await r.json();
        if (!body?.ok) throw new Error('not-ready');
        if (!gone) setMode('eve');
      })
      .catch(() => { if (!gone) setMode('fallback'); });
    return () => {
      gone = true;
      window.clearTimeout(t);
      ac.abort();
    };
  }, []);

  useEffect(() => {
    if (!askOpen || !pendingQ) return;
    setAskRequest({ text: pendingQ, n: Date.now() });
    setPendingQ(null);
  }, [askOpen, pendingQ]);

  // Fallback mode: route outside questions into the deterministic Ask panel.
  useEffect(() => {
    if (mode !== 'fallback' || !externalAsk || handledExternal.current === externalAsk.n) return;
    handledExternal.current = externalAsk.n;
    setAskOpen(true);
    setPendingQ(externalAsk.text);
  }, [mode, externalAsk]);

  function askFallback(q: string) {
    setMode(m => (m === 'eve' ? m : 'fallback'));
    setAskOpen(true);
    setPendingQ(q);
  }

  function submitFallback(e: FormEvent) {
    e.preventDefault();
    const q = input.trim().slice(0, 400);
    if (!q) return;
    setInput('');
    askFallback(q);
  }

  return (
    <div
      // Content-sized: compact while empty, grows with the thread up to a cap,
      // then the thread scrolls inside. The fallback Ask panel needs a fixed height.
      className={`flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/12 ${
        mode === 'fallback' && askOpen
          ? 'h-[min(34rem,68dvh)] min-[720px]:h-[min(38rem,62vh)]'
          : 'max-h-[min(34rem,72dvh)] min-[720px]:max-h-[min(40rem,68vh)]'
      }`}
      data-testid="home-chat"
      data-mode={mode}
    >
      {mode === 'eve' ? (
        <EveChat
          units={units}
          onOpen={onOpen}
          onShowBoard={onShowBoard}
          input={input}
          setInput={setInput}
          askRequest={externalAsk}
          topNames={topNames}
        />
      ) : mode === 'fallback' && askOpen ? (
        <AskPanel
          open
          docked
          embedded
          onClose={() => {}}
          units={units}
          catalog={catalog}
          request={askRequest}
          onAsked={() => {}}
          onOpenResort={onOpen}
          onShowBoard={onShowBoard}
          board={{ ...board, focusResortId: null, focusResortName: null }}
        />
      ) : (
        <>
          <div className="min-h-0 flex-auto overflow-y-auto px-3.5 pt-4 pb-4 min-[720px]:px-5">
            <EmptyState onPick={askFallback} />
          </div>
          <Composer input={input} setInput={setInput} onSubmit={submitFallback} busy={false} showGhost />
        </>
      )}
    </div>
  );
}

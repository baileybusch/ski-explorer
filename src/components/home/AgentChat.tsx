import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { buildFollowups } from '@/lib/chatFollowups.js';
import { regionScopeContext, regionStarters } from '../../../lib/homeRegions.js';
import { ArrowUpIcon, SnowflakeIcon, SquareIcon } from 'lucide-react';
import { useEveAgent } from 'eve/react';
import { GhostPrompt } from '@/components/GhostPrompt';
import { HOME_GHOSTS } from '@/lib/ghosts';
import { BRAND } from '@/lib/brand';
import type { SnowUnits } from '@/lib/format';
import type { BoardScope, OfferTarget, RankOutput } from '@/lib/askTypes';
import {
  CompareAnswer, PartPending, RankedAnswer, ResortAnswer, SourcesNote,
} from '@/components/ask/AskParts';
import { ExpertSnowMeta } from '@/components/ask/ExpertSnowMeta';
import { WebLookupCard } from '@/components/home/WebLookupCard';
import { snowAmount } from '@/lib/format';
import { AskPanel } from '@/components/ask/AskPanel';
import { ChatMarkdown } from '@/components/home/ChatMarkdown';
import { prefersReducedMotion } from '@/lib/motion';
import { ChatStatusCtx } from '@/components/ChatDock';

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
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const typing = input.length > 0;
  const scope = useContext(ScopeCtx);
  const panel = useContext(PanelCtx);
  const ghosts = scope ? [`Ask about ${scope.name}, e.g. "${regionStarters(scope.name, scope.topName)[0]}"`] : HOME_GHOSTS;
  return (
    // Claude-style input card: text at top-left, controls along the bottom.
    <form
      className={panel
        // iOS / Muse message bar: one rounded pill, send button inside on the right.
        ? 'flex min-h-12 items-end gap-2 rounded-[24px] bg-[var(--chat-input)] py-1.5 pr-1.5 pl-4 ring-1 ring-[var(--chat-panel-line)] transition-shadow focus-within:ring-[var(--ice)]'
        : 'flex min-h-[8.25rem] flex-col rounded-[28px] bg-[var(--chat-input)] px-5 pt-4 pb-3 ring-1 ring-[var(--chat-panel-line)] transition-shadow focus-within:ring-[var(--ice)]'}
      onSubmit={onSubmit}
      data-testid="home-chat-composer"
    >
      <div className={`relative min-w-0 flex-1 ${panel ? 'self-center py-1.5' : ''}`}>
        {showGhost && !typing ? (
          <GhostPrompt
            lines={ghosts}
            paused={typing}
            testid="home-chat-ghost"
            className={`ghost-prompt pointer-events-none absolute inset-x-0 top-0 min-w-0 text-base leading-6 text-muted-foreground ${panel ? '' : 'ghost-prompt-wrap'} ${panel ? 'top-1.5' : ''}`}
          />
        ) : null}
        <textarea
          ref={inputRef as any}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label={`Ask ${BRAND.name}`}
          rows={panel ? 1 : 2}
          className={`block w-full resize-none bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground ${panel ? 'max-h-32 min-h-6' : 'h-full min-h-12'}`}
          autoComplete="off"
          enterKeyHint="send"
          maxLength={400}
          placeholder={showGhost && !typing ? '' : panel ? 'Message' : 'Ask a follow-up…'}
        />
      </div>
      <div className={panel ? 'flex shrink-0 items-center' : 'mt-1 flex items-center justify-between gap-3'}>
        {panel ? null : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="home-chat-hint">
            <SnowflakeIcon className="size-3.5" aria-hidden />
            Live snow data · Ikon &amp; Epic
          </span>
        )}
        {busy && onStop ? (
          <button type="button" className="grid size-9 place-items-center rounded-full bg-[var(--surface-raised)] hover:bg-foreground/10" aria-label="Stop" onClick={onStop}>
            <SquareIcon className="size-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:bg-[var(--surface-raised)] disabled:text-muted-foreground"
            aria-label="Send"
            data-testid="home-chat-send"
            disabled={!input.trim()}
          >
            <ArrowUpIcon className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}

/** No tokens or tool output for this long while busy = treat the turn as failed. */
const CHAT_STALL_MS = 40_000;

/** Region-scoped chat (region view): greeting, starters and model context follow the region. */
export type ChatScope = { id: string; name: string; topName?: string | null };
const ScopeCtx = createContext<ChatScope | null>(null);
/** Docked side panel / sheet: thread fills the height, composer pinned to the bottom. */
const PanelCtx = createContext(false);

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
      className={`min-h-9 rounded-full px-3.5 py-1.5 text-[14px] leading-tight ring-1 transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${active ? 'bg-[var(--surface-raised)] text-[var(--link)] ring-[var(--ice)]/60' : 'bg-[var(--surface)] ring-[var(--surface-line)] hover:bg-[var(--surface-raised)]'}`}
    >
      {children}
    </button>
  );
}

function TypingBubble({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="home-chat-typing" aria-live="polite" aria-label={label || 'Thinking'}>
      <span className="inline-flex items-center gap-[5px] rounded-full bg-[var(--bubble-agent)] px-4 py-3">
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
  return buildFollowups({ asked: userTextBefore(messages, idx), main: main || null, hasOwnData: own.length > 0 });
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
  const scope = useContext(ScopeCtx);
  const panel = useContext(PanelCtx);
  const rawBusy = agent.status === 'busy' || agent.status === 'resuming';
  const messages = agent.messages || [];
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const [shownData, setShownData] = useState<Set<string>>(() => new Set());
  const lastQ = useRef('');
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
      await agent.send(q, scope ? { clientContext: regionScopeContext(scope.name) } : undefined);
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

  // Live status line in the dock header (Muse-style): what the agent is doing right now.
  const reportStatus = useContext(ChatStatusCtx);
  const statusLine = !busy ? null : typingLabel || (lastText ? 'Typing' : 'Checking the snow');
  useEffect(() => { reportStatus?.(statusLine); }, [reportStatus, statusLine]);
  useEffect(() => () => reportStatus?.(null), [reportStatus]);

  return (
    <>
      {messages.length ? (
      <div
        ref={scroller}
        className={panel
          ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1 pb-2'
          : 'chat-surface max-h-[min(36rem,60dvh)] min-h-0 overflow-y-auto overscroll-contain rounded-[24px] p-3 min-[720px]:p-4'}
        data-testid="home-chat-scroll"
      >
        {(
          <ol className="flex flex-col gap-3" data-testid="home-ask-thread">
            {messages.map((m: any) => {
              if (m.role === 'user') {
                const text = (m.parts || []).map((p: any) => (p.type === 'text' ? p.text : '')).join('');
                return (
                  <li key={m.id} className="flex justify-end" data-testid="home-ask-user">
                    <p className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-[var(--bubble-user)] px-4 py-2 text-[16px] leading-snug text-[var(--bubble-user-fg)]">{text}</p>
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
                    <div className="max-w-[min(88%,62ch)] rounded-[20px] rounded-bl-[6px] bg-[var(--bubble-agent)] px-4 py-2.5 text-[16px] leading-relaxed text-[var(--bubble-agent-fg)]" data-testid="home-chat-bubble">
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
              <li className="flex flex-wrap items-center gap-3 rounded-[20px] bg-[var(--bubble-agent)] px-4 py-3 text-sm" data-testid="home-chat-error" role="alert">
                <span>Sorry, the snow desk didn&rsquo;t answer. Try again in a moment.</span>
                <button type="button" className="rounded-full bg-primary px-3.5 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/85" data-testid="home-chat-retry" onClick={() => { if (lastQ.current) void ask(lastQ.current); }}>
                  Retry
                </button>
              </li>
            ) : null}
          </ol>
        )}
      </div>
      ) : null}
      {panel && !messages.length ? <div className="min-h-0 flex-1 overflow-y-auto px-1"><EmptyState onPick={q => void ask(q)} /></div> : null}
      <Composer input={input} setInput={setInput} onSubmit={send} busy={busy} onStop={() => agent.cancel()} showGhost={!messages.length} inputRef={inputRef} />
      {!panel && !messages.length ? <EmptyState onPick={q => void ask(q)} /> : null}
    </>
  );
}

const HOME_STARTERS = STARTER_PROMPTS;
export const GREETING = "Hey! Ask me where to ski, or how a mountain's looking.";

const HOME_GREETING = GREETING;

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
  const scope = useContext(ScopeCtx);
  const GREETING = scope ? `Ask me where's best in ${scope.name}, or how any mountain there is looking.` : HOME_GREETING;
  const STARTER_PROMPTS = scope ? regionStarters(scope.name, scope.topName) : HOME_STARTERS;
  const t = useGreetingClock();
  const { dots, type, chipStagger } = GREETING_TIMING;
  const typing = t >= dots;
  const typed = t === Infinity ? GREETING.length : Math.max(0, Math.min(GREETING.length, Math.round(((t - dots) / type) * GREETING.length)));
  const done = typed >= GREETING.length;
  const phase = !typing ? 'dots' : done ? 'done' : 'typing';
  return (
    <div className="flex flex-col gap-2.5 pt-1" data-testid="home-chat-empty-state" data-greeting={phase}>
      {phase === 'dots' ? (
        <TypingBubble />
      ) : (
        <div className="px-1 text-[15px] leading-relaxed text-foreground/80" data-testid="home-chat-empty" aria-label={GREETING}>
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
  units, catalog, onOpen, onShowBoard, board, externalAsk = null, topNames = [], scope = null,
  layout = 'inline', fallbackBoard, onAlertSignup, onAsked,
}: {
  /** 'panel' = docked side panel or mobile sheet (fills its container). */
  layout?: 'inline' | 'panel';
  /** Full board scope for the deterministic fallback panel (resorts page). */
  fallbackBoard?: BoardScope;
  onAlertSignup?: (target: OfferTarget | null) => void;
  onAsked?: (text: string) => void;
  /** Scope the chat to one region (region view). */
  scope?: ChatScope | null;
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

  const panel = layout === 'panel';
  // Resorts page (fallbackBoard given): the board-scoped Ask panel shows right away.
  const fallbackOpen = mode === 'fallback' && (askOpen || (panel && !!fallbackBoard));
  return (
    <ScopeCtx.Provider value={scope}>
    <PanelCtx.Provider value={panel}>
    <div
      // Inline (home): Claude-style input card, thread in a tinted chat surface above it.
      // Panel (resorts page / sheets): fills its container, composer pinned at the bottom.
      className={`flex flex-col gap-3 ${
        panel
          ? 'h-full min-h-0 flex-1'
          : fallbackOpen
            ? 'chat-surface h-[min(34rem,68dvh)] overflow-hidden rounded-[24px] min-[720px]:h-[min(38rem,62vh)]'
            : ''
      }`}
      data-testid="home-chat"
      data-mode={mode}
      data-layout={layout}
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
      ) : fallbackOpen ? (
        <AskPanel
          open
          docked
          embedded
          onClose={() => {}}
          units={units}
          catalog={catalog}
          request={askRequest}
          onAsked={onAsked || (() => {})}
          onOpenResort={onOpen}
          onShowBoard={onShowBoard}
          onAlertSignup={onAlertSignup}
          hideTitle={panel}
          board={fallbackBoard || { ...board, focusResortId: null, focusResortName: null }}
        />
      ) : (
        <>
          {panel ? <div className="min-h-0 flex-1 overflow-y-auto px-1"><EmptyState onPick={askFallback} /></div> : null}
          <Composer input={input} setInput={setInput} onSubmit={submitFallback} busy={false} showGhost />
          {panel ? null : <EmptyState onPick={askFallback} />}
        </>
      )}
    </div>
    </PanelCtx.Provider>
    </ScopeCtx.Provider>
  );
}

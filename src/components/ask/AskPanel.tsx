import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { ArrowUpIcon, ChevronLeftIcon, SquareIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { AskTransport } from '@/lib/askTransport';
import type { AskUIMessage, BoardScope, RankOutput } from '@/lib/askTypes';
import type { SnowUnits } from '@/lib/format';
import { REGION_CHIPS } from '@/lib/design';
import {
  ClimateAnswer, CompareAnswer, PartPending, RankedAnswer, ResortAnswer, SourcesNote,
} from '@/components/ask/AskParts';

export const ASK_SUGGESTIONS = [
  "Who's getting the most snow right now?",
  'Good resort for a Japan ski trip',
  'California resorts with the most projected snow',
  'Best resorts to go to in January',
  'Best resorts to go to in March',
  'Alta vs Snowbird',
];

const PENDING: Record<string, string> = {
  rankResorts: 'Ranking resorts',
  getResort: 'Reading the resort',
  compareResorts: 'Lining them up',
  monthClimatology: 'Averaging past seasons',
};

function Thread({
  messages, units, onOpen, onShowBoard, waiting,
}: {
  messages: AskUIMessage[];
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  waiting: boolean;
}) {
  return (
    <ol className="flex flex-col gap-6" data-testid="ask-thread">
      {messages.map(m => {
        if (m.role === 'user') {
          const text = m.parts.map(p => (p.type === 'text' ? p.text : '')).join('');
          return (
            <li key={m.id} className="flex justify-end scroll-mt-4" data-testid="ask-user" data-msg={m.id}>
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-card px-3.5 py-2 text-[15px] leading-snug ring-1 ring-foreground/12">{text}</p>
            </li>
          );
        }
        const text = m.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n\n').trim();
        const outputs: any[] = [];
        const tools = m.parts.map((part, i) => {
          switch (part.type) {
            case 'tool-rankResorts':
              if (part.state !== 'output-available') return part.state === 'output-error' ? null : <PartPending key={i} label={PENDING.rankResorts} />;
              outputs.push(part.output);
              return <RankedAnswer key={i} out={part.output} units={units} onOpen={onOpen} onShowBoard={onShowBoard} />;
            case 'tool-getResort':
              if (part.state !== 'output-available') return part.state === 'output-error' ? null : <PartPending key={i} label={PENDING.getResort} />;
              outputs.push(part.output);
              return <ResortAnswer key={i} out={part.output} units={units} onOpen={onOpen} />;
            case 'tool-compareResorts':
              if (part.state !== 'output-available') return part.state === 'output-error' ? null : <PartPending key={i} label={PENDING.compareResorts} />;
              outputs.push(part.output);
              return <CompareAnswer key={i} out={part.output} units={units} onOpen={onOpen} />;
            case 'tool-monthClimatology':
              if (part.state !== 'output-available') return part.state === 'output-error' ? null : <PartPending key={i} label={PENDING.monthClimatology} />;
              outputs.push(part.output);
              return <ClimateAnswer key={i} out={part.output} units={units} onOpen={onOpen} />;
            default:
              return null;
          }
        }).filter(Boolean);
        return (
          <li key={m.id} className="flex flex-col gap-3" data-testid="ask-answer" data-mode={m.metadata?.mode || ''}>
            {text ? (
              <p className="max-w-[62ch] text-[15px] leading-relaxed whitespace-pre-line" data-testid="ask-answer-text">{text}</p>
            ) : null}
            {tools}
            <SourcesNote outputs={outputs} mode={m.metadata?.mode} />
          </li>
        );
      })}
      {waiting ? (
        <li data-testid="ask-waiting">
          <PartPending label="Checking the snow" />
        </li>
      ) : null}
    </ol>
  );
}

export function AskPanel({
  open, onClose, units, catalog, request, onAsked, onOpenResort, onShowBoard,
  regions, onRegion, onWorldwide, pass, setPass, stormsOn, setStormsOn, board, docked = false, focusTick = 0,
}: {
  open: boolean;
  /** Desktop: a persistent side panel beside the board (no close, no Escape, no autofocus on load). */
  docked?: boolean;
  /** Bump to move focus into the composer (header search box while docked). */
  focusTick?: number;
  onClose: () => void;
  units: SnowUnits;
  catalog: any;
  /** The board's current scope; answers rank within it unless the question names another. */
  board: BoardScope;
  /** A question to send as soon as the panel is open (deep link or prompt from elsewhere). */
  request?: { text: string; n: number } | null;
  onAsked?: (text: string) => void;
  onOpenResort: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  regions: { id: string; name: string }[];
  onRegion: (id: string) => void;
  onWorldwide: () => void;
  pass: string;
  setPass: (p: string) => void;
  stormsOn: boolean;
  setStormsOn: (on: boolean) => void;
}) {
  const ctxRef = useRef({ units, catalog, board });
  ctxRef.current = { units, catalog, board };
  const transport = useMemo(() => new AskTransport(() => ctxRef.current), []);
  const { messages, sendMessage, status, stop, setMessages } = useChat<AskUIMessage>({ id: 'ask-skiscope', transport });
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lastRequest = useRef(0);
  const busy = status === 'submitted' || status === 'streaming';

  function ask(text: string) {
    const t = text.trim();
    if (!t || !catalog) return;
    if (busy) stop();
    setInput('');
    onAsked?.(t);
    sendMessage({ text: t });
  }

  useEffect(() => {
    if (!open || !request || request.n === lastRequest.current || !catalog) return;
    lastRequest.current = request.n;
    ask(request.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request, catalog]);

  useEffect(() => {
    if (!open || docked) return;
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (focusTick) inputRef.current?.focus();
  }, [focusTick]);

  useEffect(() => {
    if (!open || docked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, docked, onClose]);

  const lastUserId = [...messages].reverse().find(m => m.role === 'user')?.id;
  useEffect(() => {
    if (!lastUserId) return;
    const el = scroller.current?.querySelector(`[data-msg="${lastUserId}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [lastUserId]);

  const waiting = status === 'submitted' || (busy && messages[messages.length - 1]?.role === 'user');
  const chips = REGION_CHIPS.map(id => regions.find(r => r.id === id)).filter(Boolean) as { id: string; name: string }[];

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div
      className={`${open ? 'flex' : 'hidden'} fixed inset-0 z-40 flex-col bg-background min-[840px]:inset-y-0 min-[840px]:right-0 min-[840px]:left-auto min-[840px]:w-[30rem] min-[840px]:border-l min-[840px]:border-foreground/10 ${docked ? '' : 'min-[840px]:shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.6)]'}`}
      data-testid="search"
      data-docked={docked ? '1' : '0'}
      role={docked ? 'complementary' : 'dialog'}
      aria-modal={docked ? undefined : false}
      aria-label="Ask SkiScope"
    >
      <header className="relative flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 min-[840px]:px-3 min-[840px]:pt-3">
        <Button type="button" variant="ghost" className="min-h-11 gap-1 px-2 text-[15px] min-[840px]:hidden" data-testid="search-cancel" onClick={onClose}>
          <ChevronLeftIcon className="size-5" /> Board
        </Button>
        <h2 className="flex-1 text-[15px] font-semibold max-[839px]:text-center max-[839px]:pr-[4.5rem] min-[840px]:pl-1">Ask SkiScope</h2>
        {messages.length ? (
          <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm max-[839px]:absolute max-[839px]:right-2" data-testid="ask-new" onClick={() => { stop(); setMessages([]); }}>
            New
          </Button>
        ) : null}
        {docked ? null : (
          <Button type="button" variant="ghost" size="icon" className="hidden min-h-11 min-w-11 min-[840px]:inline-flex" aria-label="Close" data-testid="ask-close" onClick={onClose}>
            <XIcon />
          </Button>
        )}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6" data-testid="ask-scroll">
        {messages.length ? (
          <Thread messages={messages} units={units} onOpen={onOpenResort} onShowBoard={onShowBoard} waiting={waiting} />
        ) : (
          <div className="flex flex-col gap-7 pt-2" data-testid="ask-empty">
            <div>
              <p className="max-w-[40ch] text-[15px] leading-relaxed text-muted-foreground">
                Ask who&apos;s getting the most snow, where to go in a given month, or how two resorts compare. Answers come from observed snow, the 7-day forecast, and past seasons.
              </p>
              <ul className="mt-4 flex flex-col" data-testid="ask-suggestions">
                {ASK_SUGGESTIONS.map(s => (
                  <li key={s}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center border-b border-foreground/8 py-3 text-left text-[15px] outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                      data-testid="ask-suggestion"
                      onClick={() => ask(s)}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div data-testid="search-chips">
              <h3 className="mb-2 text-[13px] text-muted-foreground">Filter the board</h3>
              <div className="flex flex-wrap gap-2">
                {(['ikon', 'epic', 'all'] as const).map(p => (
                  <Button
                    key={p}
                    type="button"
                    variant="outline"
                    aria-pressed={pass === p}
                    className={`min-h-10 rounded-full px-3 text-sm ${pass === p ? 'bg-foreground/10 ring-1 ring-foreground/40' : ''}`}
                    data-testid={`pass-${p}`}
                    onClick={() => setPass(p)}
                  >
                    {p === 'all' ? 'All passes' : p[0].toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-10 rounded-full px-3 text-sm" data-testid="chip-worldwide" onClick={onWorldwide}>
                  Worldwide
                </Button>
                {chips.map(g => (
                  <Button key={g.id} type="button" variant="outline" className="min-h-10 rounded-full px-3 text-sm" data-testid={`region-${g.id}`} onClick={() => onRegion(g.id)}>
                    {g.name}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={stormsOn}
                  className={`min-h-10 rounded-full px-3 text-sm ${stormsOn ? 'bg-foreground/10 ring-1 ring-foreground/40' : ''}`}
                  data-testid="storms-chip"
                  onClick={() => setStormsOn(!stormsOn)}
                >
                  Storms
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        className="border-t border-foreground/8 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={submit}
        data-testid="ask-composer"
      >
        <InputGroup className="h-12 rounded-full">
          <InputGroupInput
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about snow, a resort, or a month"
            aria-label="Ask SkiScope"
            className="h-12 pl-4 text-base"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={400}
          />
          <InputGroupAddon align="inline-end">
            {busy ? (
              <InputGroupButton type="button" size="icon-sm" variant="outline" className="rounded-full" aria-label="Stop" data-testid="ask-stop" onClick={() => stop()}>
                <SquareIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton type="submit" size="icon-sm" variant="outline" className="rounded-full" aria-label="Send" data-testid="ask-send" disabled={!input.trim()}>
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

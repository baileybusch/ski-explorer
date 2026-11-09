import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { ArrowUpIcon, ChevronLeftIcon, SquareIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { AskTransport } from '@/lib/askTransport';
import { BRAND } from '@/lib/brand';
import type { AskUIMessage, BoardScope, OfferTarget, RankOutput } from '@/lib/askTypes';
import { AlertOffer } from '@/components/ask/AskOffer';
import type { SnowUnits } from '@/lib/format';
import {
  ClimateAnswer, CompareAnswer, PartPending, RankedAnswer, ResortAnswer, SourcesNote,
} from '@/components/ask/AskParts';

export const ASK_SUGGESTIONS = [
  "Who's getting the most snow right now?",
  'Good resort for a Japan ski trip',
  'Alta vs Snowbird',
];

function resortPrompts(name: string) {
  return [
    `How's the snow at ${name} this week?`,
    `What's the 7-day forecast for ${name}?`,
    `${name} vs a nearby mountain`,
  ];
}

const PENDING: Record<string, string> = {
  rankResorts: 'Ranking resorts',
  getResort: 'Reading the resort',
  compareResorts: 'Lining them up',
  monthClimatology: 'Averaging past seasons',
};

function Thread({
  messages, units, onOpen, onShowBoard, onAlertSignup, waiting,
}: {
  messages: AskUIMessage[];
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  onAlertSignup?: (target: OfferTarget | null) => void;
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
        const offers = m.parts.map((part, i) => (
          part.type === 'tool-offerAlertSignup' && part.state === 'output-available'
            ? <AlertOffer key={i} out={part.output} onPick={onAlertSignup} />
            : null
        )).filter(Boolean);
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
            {offers}
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
  open, onClose, units, catalog, request, onAsked, onOpenResort, onShowBoard, onAlertSignup,
  board, docked = false, focusTick = 0,
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
  /** Ask's signup card without a specific target opens the full alert flow. */
  onAlertSignup?: (target: OfferTarget | null) => void;
}) {
  const ctxRef = useRef({ units, catalog, board });
  ctxRef.current = { units, catalog, board };
  const transport = useMemo(() => new AskTransport(() => ctxRef.current), []);
  const { messages, sendMessage, status, stop, setMessages } = useChat<AskUIMessage>({
    id: board.focusResortId ? `ask-${board.focusResortId}` : 'ask-skiscope',
    transport,
  });
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
      aria-label={`Ask ${BRAND.name}`}
    >
      <header className="relative flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 min-[840px]:px-3 min-[840px]:pt-3">
        <Button type="button" variant="ghost" className="min-h-11 gap-1 px-2 text-[15px] min-[840px]:hidden" data-testid="search-cancel" onClick={onClose}>
          <ChevronLeftIcon className="size-5" /> Board
        </Button>
        <h2 className="flex-1 text-[15px] font-semibold max-[839px]:text-center max-[839px]:pr-[4.5rem] min-[840px]:pl-1">Ask {BRAND.name}</h2>
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
          <Thread messages={messages} units={units} onOpen={onOpenResort} onShowBoard={onShowBoard} onAlertSignup={onAlertSignup} waiting={waiting} />
        ) : (
          <div className="flex flex-col gap-3 pt-4" data-testid="ask-empty" data-focus-resort={board.focusResortId || ''}>
            <p className="max-w-[36ch] text-[15px] leading-snug text-muted-foreground">
              {board.focusResortName
                ? `Ask about ${board.focusResortName}.`
                : 'Ask who\'s getting snow, a month, or two mountains.'}
            </p>
          </div>
        )}
      </div>

      <form
        className="border-t border-foreground/8 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={submit}
        data-testid="ask-composer"
      >
        {messages.length === 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5" data-testid="ask-suggestions">
            {(board.focusResortName ? resortPrompts(board.focusResortName) : ASK_SUGGESTIONS).map(s => (
              <button
                key={s}
                type="button"
                className="min-h-10 rounded-full border border-foreground/15 px-3 text-left text-[13px] text-muted-foreground outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                data-testid="ask-suggestion"
                onClick={() => ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <InputGroup className="h-12 rounded-full">
          <InputGroupInput
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={board.focusResortName ? `Ask about ${board.focusResortName}` : 'Ask about snow, a resort, or a month'}
            aria-label={`Ask ${BRAND.name}`}
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

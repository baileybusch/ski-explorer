import { useEffect, useState, type FormEvent } from 'react';
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
import { WebLookupCard } from '@/components/home/WebLookupCard';
import { AskPanel } from '@/components/ask/AskPanel';

function unwrap(out: any) {
  if (!out) return out;
  return out.data && (out.data.kind || out.data.rows || out.data.found != null) ? out.data : out;
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
  input, setInput, onSubmit, busy, onStop, showGhost,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  onStop?: () => void;
  showGhost: boolean;
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
            value={input}
            onChange={e => setInput(e.target.value)}
            aria-label={`Ask ${BRAND.name}`}
            className="h-12 pl-4 text-base"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={400}
            placeholder={showGhost && !typing ? '' : `Ask ${BRAND.name}`}
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

function EveChat({
  units, onOpen, onShowBoard, input, setInput,
}: {
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  input: string;
  setInput: (v: string) => void;
}) {
  const agent = useEveAgent({ prewarm: true });
  const busy = agent.status === 'busy' || agent.status === 'resuming';
  const messages = agent.messages || [];

  async function send(e: FormEvent) {
    e.preventDefault();
    const q = input.trim().slice(0, 400);
    if (!q || busy) return;
    setInput('');
    await agent.send(q);
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {messages.length ? (
          <ol className="flex flex-col gap-6" data-testid="home-ask-thread">
            {messages.map((m: any) => {
              if (m.role === 'user') {
                const text = (m.parts || []).map((p: any) => (p.type === 'text' ? p.text : '')).join('');
                return (
                  <li key={m.id} className="flex justify-end" data-testid="home-ask-user">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-card px-3.5 py-2 text-[15px] leading-snug ring-1 ring-foreground/12">{text}</p>
                  </li>
                );
              }
              const text = (m.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n\n').trim();
              const tools = (m.parts || []).filter((p: any) => p.type === 'tool');
              return (
                <li key={m.id} className="flex flex-col gap-3" data-testid="home-ask-answer">
                  {text ? <p className="max-w-[62ch] text-[15px] leading-relaxed whitespace-pre-line">{text}</p> : null}
                  {tools.length ? <ToolCards parts={tools} units={units} onOpen={onOpen} onShowBoard={onShowBoard} /> : null}
                </li>
              );
            })}
            {busy ? <li><PartPending label="Checking the snow" /></li> : null}
          </ol>
        ) : (
          <p className="max-w-[40ch] text-[15px] leading-snug text-muted-foreground" data-testid="home-chat-empty">
            Ask about any Ikon or Epic mountain, or a peak we do not list yet.
          </p>
        )}
      </div>
      <Composer input={input} setInput={setInput} onSubmit={send} busy={busy} onStop={() => agent.cancel()} showGhost={!messages.length} />
    </>
  );
}

export function AgentChat({
  units, catalog, onOpen, onShowBoard, board,
}: {
  units: SnowUnits;
  catalog: any;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  board: { pass: 'ikon' | 'epic' | 'all'; regionId: string | null; observedOnly: boolean };
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'boot' | 'eve' | 'fallback'>('boot');
  const [askOpen, setAskOpen] = useState(false);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);

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

  function submitFallback(e: FormEvent) {
    e.preventDefault();
    const q = input.trim().slice(0, 400);
    if (!q) return;
    setInput('');
    setMode(m => (m === 'eve' ? m : 'fallback'));
    setAskOpen(true);
    setPendingQ(q);
  }

  return (
    <div className="flex min-h-[11rem] flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/12 min-[720px]:min-h-[22rem]" data-testid="home-chat" data-mode={mode}>
      {mode === 'eve' ? (
        <EveChat units={units} onOpen={onOpen} onShowBoard={onShowBoard} input={input} setInput={setInput} />
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <p className="max-w-[40ch] text-[15px] leading-snug text-muted-foreground" data-testid="home-chat-empty">
              Ask about any Ikon or Epic mountain, or a peak we do not list yet.
            </p>
          </div>
          <Composer input={input} setInput={setInput} onSubmit={submitFallback} busy={false} showGhost />
        </>
      )}
    </div>
  );
}

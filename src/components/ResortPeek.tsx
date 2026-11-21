import { useState } from 'react';
import { ArrowUpIcon, ArrowUpRightIcon, SparklesIcon, XIcon } from 'lucide-react';
import { SnowSplit } from '@/components/SnowSplit';
import { snowAmount, tempLabel, type SnowUnits, type TempUnits } from '@/lib/format';
import { dumpParts } from '../../lib/dumpScore.js';
import { stormStatus } from '../../lib/stormStatus.js';
import { forecastDays, weatherGlyph } from '../../lib/snowWindow.js';

/** Prompts offered under a mountain's data. Nothing goes to the agent until one is tapped. */
export function peekPrompts(name: string) {
  return [
    { label: `How's ${name} looking?`, send: `How's ${name} looking?` },
    { label: 'This weekend?', send: `How's ${name} looking this weekend?` },
    { label: 'Anywhere better nearby?', send: `Is anywhere near ${name} better right now?` },
  ];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dow = (iso: string) => DOW[new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay()];

/**
 * A mountain's data, shown when a mountain is clicked in a list: recent snow, today's
 * conditions and the forecast, all from the loaded catalog (no LLM call). The agent is
 * only asked when the user taps a prompt or types.
 */
export function ResortPeek({
  resort, snow, units, tempUnits = 'F', onAsk, onOpen, onClose, className = '', showInput = false,
}: {
  resort: any;
  snow: any;
  units: SnowUnits;
  tempUnits?: TempUnits;
  onAsk: (text: string) => void;
  onOpen?: (id: string) => void;
  onClose: () => void;
  className?: string;
  /** Panels hide the chat while the summary shows, so the summary carries its own input. */
  showInput?: boolean;
}) {
  const [q, setQ] = useState('');
  const d = dumpParts(resort, snow);
  const status = stormStatus(resort, snow, { units: units === 'cm' ? 'cm' : 'in' });
  const rec = snow?.resorts?.[resort.id] || resort;
  const t = snow?.today ?? 0;
  const days = forecastDays(resort, snow, { days: 5 });
  const hi = rec?.tmax?.[t];
  const lo = rec?.tmin?.[t];
  const glyph = weatherGlyph({ wcode: rec?.wcode?.[t], outlookCm: rec?.sf?.[t] || 0, tmax: hi });
  const prompts = peekPrompts(resort.name);
  const where = resort.region || resort.state || resort.country || '';
  const actions = (
    <div className="flex shrink-0 flex-col gap-2 pt-0.5" data-testid="resort-peek-actions">
      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[15px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        data-testid="resort-peek-ask"
        onClick={() => onAsk(prompts[0].send)}
      >
        <SparklesIcon className="size-4" aria-hidden /> Ask about {resort.name}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {prompts.slice(1).map(p => (
          <button
            key={p.label}
            type="button"
            className="min-h-9 rounded-full border border-[var(--surface-line)] bg-[var(--surface-raised)] px-3 text-[14px] hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-ring"
            data-testid="resort-peek-prompt"
            onClick={() => onAsk(p.send)}
          >
            {p.label}
          </button>
        ))}
        {onOpen ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[14px] text-[var(--link)] hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            data-testid="resort-peek-open"
            onClick={() => onOpen(resort.id)}
          >
            Full page <ArrowUpRightIcon className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
  return (
    <section
      className={`flex flex-col gap-3 rounded-[20px] bg-[var(--surface)] p-3.5 ring-1 ring-[var(--surface-line)] ${className}`}
      data-testid="resort-peek"
      data-resort={resort.id}
      aria-label={`${resort.name} snow summary`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold leading-tight" data-testid="resort-peek-name">{resort.name}</h3>
          {where ? <p className="truncate text-xs text-muted-foreground">{where}</p> : null}
        </div>
        <button
          type="button"
          className="glass grid size-9 shrink-0 place-items-center rounded-full text-foreground/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Close summary"
          data-testid="resort-peek-close"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className={`flex flex-col gap-3 ${showInput ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : ''}`} data-testid="resort-peek-body">
      <div className="rounded-2xl bg-[var(--surface-raised)] px-3 pt-2.5 pb-3" data-testid="resort-peek-snow">
        <SnowSplit pastCm={d.past72Cm} nextCm={d.next7Cm} units={units} estimated={d.estimated} />
        <p className="mt-2 text-xs text-muted-foreground" data-testid="resort-peek-24h">
          Last 24h {snowAmount(d.past24Cm, units)}{d.estimated ? ' est.' : ''}
        </p>
      </div>

      <p className="text-[14px] leading-relaxed text-foreground/85" data-testid="resort-peek-status">{status.text}</p>

      <div className="flex items-center gap-2 text-[13px] text-muted-foreground" data-testid="resort-peek-now">
        <span aria-hidden className="text-base text-foreground">{glyph}</span>
        <span>Today: high {tempLabel(hi, tempUnits)}, low {tempLabel(lo, tempUnits)}</span>
      </div>

      {days.length ? (
        <ol className="grid grid-cols-5 gap-1.5" data-testid="resort-peek-forecast" aria-label="Forecast snow by day">
          {days.map(x => (
            <li key={x.date} className="flex flex-col items-center gap-0.5 rounded-xl bg-[var(--surface-raised)] px-1 py-1.5 text-center">
              <span className="text-[11px] text-muted-foreground">{dow(x.date)}</span>
              <span aria-hidden className="text-sm">{weatherGlyph({ wcode: x.wcode, outlookCm: x.snowCm, tmax: x.tmax })}</span>
              <span className="text-[13px] font-medium tabular">{snowAmount(x.snowCm, units)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {showInput ? null : actions}
      </div>
      {showInput ? actions : null}
      {showInput ? (
        <form
          className="-mx-1 flex shrink-0 items-center gap-2 rounded-full bg-[var(--chat-input)] py-1.5 pr-1.5 pl-4 ring-1 ring-[var(--surface-line)] focus-within:ring-2 focus-within:ring-ring"
          data-testid="resort-peek-form"
          onSubmit={e => {
            e.preventDefault();
            const t = q.trim();
            if (t) onAsk(t);
          }}
        >
          <input
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
            placeholder={`Ask about ${resort.name}…`}
            aria-label={`Ask about ${resort.name}`}
            value={q}
            onChange={e => setQ(e.target.value)}
            data-testid="resort-peek-input"
          />
          <button
            type="submit"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:bg-[var(--surface-raised)] disabled:text-muted-foreground"
            aria-label="Send"
            disabled={!q.trim()}
            data-testid="resort-peek-send"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        </form>
      ) : null}
    </section>
  );
}

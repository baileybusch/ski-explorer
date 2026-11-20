import { MessageCircleIcon } from 'lucide-react';
import { SnowSplit, statNum, Unit } from '@/components/SnowSplit';
import { SnowStake } from '@/components/SnowStake';
import { stakeMax } from '@/lib/boardLayout';
import { snowAmount, type SnowUnits } from '@/lib/format';
import { dumpParts } from '../../../lib/dumpScore.js';

type Row = { r: any; dump?: ReturnType<typeof dumpParts> };

const RANK_LABEL = ['Most new snow', 'Runner-up', 'Third'];

/** Thought-starter cards under the chat. Clicking one asks the chat about that resort. */
export function TrendingCards({
  rows, units, snow, onAsk,
}: {
  rows: Row[];
  units: SnowUnits;
  snow: any;
  onAsk: (resort: { id: string; name: string }) => void;
}) {
  const parts = rows.map(row => row.dump || dumpParts(row.r, snow));
  const max = stakeMax(parts.flatMap(d => [d.past72Cm, d.next7Cm]));
  return (
    <div className="grid gap-3 min-[720px]:grid-cols-3" data-testid="home-trending">
      {rows.map((row, i) => {
        const d = parts[i];
        const r = row.r;
        return (
          <button
            key={r.id}
            type="button"
            className="group rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 outline-offset-2 hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:outline-ring min-[720px]:p-3.5"
            data-testid="home-trending-card"
            data-resort={r.id}
            data-estimated={d.estimated ? '1' : '0'}
            aria-label={`Ask SkiScope how ${r.name} is looking`}
            onClick={() => onAsk({ id: r.id, name: r.name })}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">{RANK_LABEL[i] || `#${i + 1}`} · Last 72h</span>
              {r.passes?.length ? (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{r.passes.join(' · ')}</span>
              ) : null}
            </div>
            <div className="text-lg font-semibold leading-tight">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.region || r.state || r.country}</div>
            <div className="mt-3">
              <SnowSplit pastCm={d.past72Cm} nextCm={d.next7Cm} units={units} estimated={d.estimated} max={max} />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
              <MessageCircleIcon className="size-3.5" aria-hidden />
              How&rsquo;s {r.name} looking?
            </div>
          </button>
        );
      })}
    </div>
  );
}

const COLS = 'grid-cols-[1.4rem_minmax(0,1fr)_minmax(0,4.75rem)_minmax(0,4.75rem)] min-[480px]:grid-cols-[1.6rem_minmax(0,1fr)_minmax(0,6.25rem)_minmax(0,6.25rem)]';

/**
 * "See all": the full ranking inline, one column on every screen. Actual
 * (Last 72h) and Forecast (Next 7 days) get equal billing in aligned columns.
 */
export function FullList({
  rows, units, snow, onAsk, start = 0,
}: {
  rows: Row[];
  units: SnowUnits;
  snow: any;
  onAsk: (resort: { id: string; name: string }) => void;
  start?: number;
}) {
  const parts = rows.map(row => row.dump || dumpParts(row.r, snow));
  const max = stakeMax(parts.flatMap(d => [d.past72Cm, d.next7Cm]));
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" data-testid="home-full-list">
      <div className={`grid ${COLS} gap-x-3 px-3.5 pt-3 pb-1.5 text-[11px] text-muted-foreground`} aria-hidden>
        <span />
        <span />
        <span data-testid="home-list-actual-head">Last 72h</span>
        <span data-testid="home-list-forecast-head">Next 7 days</span>
      </div>
      <ol className="flex flex-col">
        {rows.map((row, i) => {
          const d = parts[i];
          const r = row.r;
          return (
            <li key={r.id} className="border-t border-foreground/[0.06]">
              <button
                type="button"
                className={`grid w-full ${COLS} items-center gap-x-3 px-3.5 py-2.5 text-left outline-offset-[-2px] hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring`}
                data-testid="home-list-row"
                data-resort={r.id}
                aria-label={`Ask about ${r.name}: ${snowAmount(d.past72Cm, units)}${d.estimated ? ' estimated' : ''} last 72 hours, ${snowAmount(d.next7Cm, units)} forecast next 7 days`}
                onClick={() => onAsk({ id: r.id, name: r.name })}
              >
                <span className="font-display tabular text-lg leading-none text-muted-foreground">{start + i + 1}</span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[15px] font-medium leading-tight">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.region || r.state || r.country}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-1.5" data-testid="home-list-actual">
                  <span className="font-display tabular text-[1.35rem] leading-none">
                    {statNum(d.past72Cm, units)}<Unit units={units} />
                    {d.estimated ? <span className="ml-1 align-middle font-sans text-[10px] opacity-60">est.</span> : null}
                  </span>
                  <SnowStake cm={d.past72Cm} max={max} kind="actual" estimated={d.estimated} size="row" />
                </span>
                <span className="flex min-w-0 flex-col gap-1.5" data-testid="home-list-forecast">
                  <span className="font-display tabular text-[1.35rem] leading-none">{statNum(d.next7Cm, units)}<Unit units={units} /></span>
                  <SnowStake cm={d.next7Cm} max={max} kind="forecast" size="row" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

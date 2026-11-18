import { SnowSplit } from '@/components/SnowSplit';
import { stakeMax } from '@/lib/boardLayout';
import type { SnowUnits } from '@/lib/format';
import { dumpParts } from '../../../lib/dumpScore.js';

type Row = { r: any; dump?: ReturnType<typeof dumpParts> };

export function TrendingCards({
  rows, units, snow, onOpen,
}: {
  rows: Row[];
  units: SnowUnits;
  snow: any;
  onOpen: (id: string) => void;
}) {
  const parts = rows.map(row => row.dump || dumpParts(row.r, snow));
  const max = stakeMax(parts.flatMap(d => [d.past72Cm, d.next7Cm]));
  return (
    <div className="grid gap-3 min-[720px]:grid-cols-2" data-testid="home-trending">
      {rows.map((row, i) => {
        const d = parts[i];
        const r = row.r;
        return (
          <button
            key={r.id}
            type="button"
            className="rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 outline-offset-2 hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:outline-ring min-[720px]:p-3.5"
            data-testid="home-trending-card"
            data-resort={r.id}
            data-estimated={d.estimated ? '1' : '0'}
            onClick={() => onOpen(r.id)}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">{i === 0 ? 'Most new snow' : 'Runner-up'} · Last 72h</span>
              {r.passes?.length ? (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{r.passes.join(' · ')}</span>
              ) : null}
            </div>
            <div className="text-lg font-semibold leading-tight">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.region || r.state || r.country}</div>
            <div className="mt-3">
              <SnowSplit pastCm={d.past72Cm} nextCm={d.next7Cm} units={units} estimated={d.estimated} max={max} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

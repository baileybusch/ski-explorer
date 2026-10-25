import { Badge } from '@/components/ui/badge';
import { passLabel } from '@/lib/format';
import { snowSpark } from '../../lib/snowWindow.js';
import { Sparkline, cardTone, snowScore } from '@/components/SnowCard';
import { fmtIn } from '../../lib/util.js';

export function BlockBoard({
  rows, units, snow, onOpen,
}: {
  rows: { r: any; m: any; storm?: any; wx?: any }[];
  units: 'in' | 'cm';
  snow: any;
  onOpen: (id: string) => void;
}) {
  const max = Math.max(0, ...rows.map(snowScore));
  const visible = rows.slice(0, 12);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-2" data-testid="board-b">
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
        {visible.map((row, i) => {
          const score = snowScore(row);
          const tone = cardTone(i + 1, score, max);
          const num = units === 'cm' ? Math.round(score) : fmtIn(score);
          const unit = units === 'cm' ? 'cm' : '″';
          const spark = snowSpark(row.r, snow);
          const fg = tone.ink ? '#08090b' : '#f2f3f5';
          const featured = i === 0;
          return (
            <button
              key={row.r.id}
              type="button"
              data-testid="block"
              data-resort={row.r.id}
              className={`flex min-h-40 flex-col justify-between rounded-[var(--radius-card)] p-4 text-left ${featured ? 'col-span-2 min-h-44' : ''}`}
              style={{ background: `oklch(${tone.l} ${tone.hero ? 0.018 : 0.012} 255)`, color: fg }}
              onClick={() => onOpen(row.r.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold opacity-70">#{i + 1}</span>
                {passLabel(row.r) ? <Badge variant="secondary" className="text-[11px]">{passLabel(row.r)}</Badge> : null}
              </div>
              <div className={`flex items-end justify-between gap-2 ${featured ? '' : 'flex-col items-start'}`}>
                <div>
                  <div className={`font-semibold leading-tight ${featured ? 'text-2xl' : 'text-base'}`}>{row.r.name}</div>
                  {featured ? (
                    <div className="mt-1 text-sm opacity-60">{row.r.region || row.r.state}</div>
                  ) : null}
                </div>
                <div className="flex items-end gap-2">
                  <Sparkline values={spark} className="mb-1 h-5 w-16 opacity-70" />
                  <div className="font-display leading-none" style={{ fontSize: featured ? '4.2rem' : '2.4rem' }}>
                    {num}<span className="text-[0.4em]">{unit}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {rows.length > 12 ? (
        <p className="mx-auto mt-3 max-w-xl px-1 text-sm text-muted-foreground">
          Showing the top 12 of {rows.length}. Search a region to narrow.
        </p>
      ) : null}
    </div>
  );
}

import { snowAmount, type SnowUnits } from '@/lib/format';
import { historyFor } from '../../lib/snowHistory.js';
import { parseISO } from '../../lib/util.js';

export function SnowHistory({
  resort, snow, history, units,
}: {
  resort: any;
  snow: any;
  history: any;
  units: SnowUnits;
}) {
  const h = historyFor(resort, snow, history);
  const maxSame = Math.max(0.1, h.stdCm, ...h.sameDate.map((s: any) => s.cm || 0));
  const maxFull = Math.max(0.1, ...h.fullSeasons.map((s: any) => s.cm || 0));
  const hasPast = h.sameDate.length > 0 || h.fullSeasons.length > 0;

  return (
    <div className={`grid gap-8 min-[840px]:gap-10 ${hasPast ? 'min-[840px]:grid-cols-3' : 'min-[840px]:grid-cols-2'}`} data-testid="snow-history">
      <section className="min-w-0">
        <h3 className="text-sm font-medium">This storm</h3>
        <dl className="mt-3 grid grid-cols-3 gap-4">
          <Stat label="Last 24h" value={snowAmount(h.current.last24Cm, units)} />
          <Stat label="Last 72h" value={snowAmount(h.current.last72Cm, units)} />
          <Stat label="Storm total" value={snowAmount(h.current.stormCm, units)} />
        </dl>
      </section>

      <section className="min-w-0">
        <h3 className="text-sm font-medium">This season</h3>
        <p className="mt-2 font-display tabular text-5xl leading-none" data-testid="history-std">
          {snowAmount(h.stdCm, units)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Modeled since {parseISO(h.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" data-testid="history-verdict">{h.verdict}</p>
      </section>

      {hasPast ? (
      <div className="flex min-w-0 flex-col gap-6">
        {h.sameDate.length ? (
          <section>
            <h3 className="text-sm font-medium">Past seasons by this date</h3>
            <div className="mt-3 flex items-end gap-1.5" data-testid="history-same-date">
              {h.sameDate.map((s: any) => (
                <Bar key={s.year} label={String(s.year).slice(2)} cm={s.cm} max={maxSame} units={units} />
              ))}
              <Bar label="Now" cm={h.stdCm} max={maxSame} units={units} hot />
            </div>
          </section>
        ) : null}

        {h.fullSeasons.length ? (
          <section>
            <h3 className="text-sm font-medium">Full seasons</h3>
            <div className="mt-3 flex items-end gap-1.5" data-testid="history-full">
              {h.fullSeasons.map((s: any) => (
                <Bar key={s.label} label={s.label.replace(/20/g, '').replace('-', '/')} cm={s.cm} max={maxFull} units={units} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display tabular text-2xl leading-none">{value}</dd>
    </div>
  );
}

function Bar({ label, cm, max, units, hot }: { label: string; cm: number; max: number; units: SnowUnits; hot?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div className="flex h-16 w-full items-end rounded-[2px]" style={{ background: 'color-mix(in oklch, currentColor 10%, transparent)' }}>
        <div className={`w-full rounded-[2px] ${hot ? 'bg-foreground' : 'bg-foreground/45'}`} style={{ height: `${Math.max(8, Math.round((cm / max) * 100))}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="tabular text-[11px] font-semibold">{snowAmount(cm, units)}</span>
    </div>
  );
}

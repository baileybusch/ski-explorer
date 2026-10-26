import { snowAmount, type SnowUnits } from '@/lib/format';
import { historyFor } from '../../lib/snowHistory.js';

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

  return (
    <div className="flex flex-col gap-5" data-testid="snow-history">
      <section>
        <h3 className="text-sm font-medium">Current snowfall</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="24h" value={snowAmount(h.current.last24Cm, units)} />
          <Stat label="72h" value={snowAmount(h.current.last72Cm, units)} />
          <Stat label="Storm" value={snowAmount(h.current.stormCm, units)} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">Current season</h3>
        <p className="mt-1 font-display text-4xl tracking-wide" data-testid="history-std">
          {snowAmount(h.stdCm, units)}
        </p>
        <p className="text-xs text-muted-foreground">Since {h.start} · modeled</p>
      </section>

      {h.sameDate.length ? (
        <section>
          <h3 className="text-sm font-medium">Past seasons to this date</h3>
          <div className="mt-3 flex h-28 items-end gap-1.5" data-testid="history-same-date">
            {h.sameDate.map((s: any) => (
              <Bar key={s.year} label={String(s.year).slice(2)} cm={s.cm} max={maxSame} units={units} />
            ))}
            <Bar label="now" cm={h.stdCm} max={maxSame} units={units} hot />
          </div>
        </section>
      ) : null}

      {h.fullSeasons.length ? (
        <section>
          <h3 className="text-sm font-medium">Full seasons</h3>
          <div className="mt-3 flex h-24 items-end gap-1.5" data-testid="history-full">
            {h.fullSeasons.map((s: any) => (
              <Bar key={s.label} label={s.label.replace(/20/g, '').replace('-', '/')} cm={s.cm} max={maxFull} units={units} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-sm leading-relaxed text-muted-foreground" data-testid="history-verdict">{h.verdict}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-2 py-3 ring-1 ring-foreground/12">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function Bar({ label, cm, max, units, hot }: { label: string; cm: number; max: number; units: SnowUnits; hot?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div className="flex h-16 w-full items-end rounded-md bg-muted">
        <div className={`w-full rounded-md ${hot ? 'bg-foreground' : 'bg-accent'}`} style={{ height: `${Math.max(8, Math.round((cm / max) * 100))}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-semibold">{snowAmount(cm, units)}</span>
    </div>
  );
}

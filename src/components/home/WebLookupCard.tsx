import { snowAmount, type SnowUnits } from '@/lib/format';
import { fmtShort } from '../../../lib/util.js';

export function WebLookupCard({ out, units }: { out: any; units: SnowUnits }) {
  if (!out?.found) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="web-lookup-miss">
        No mountain matched “{out?.query}” in SkiScope or the web lookup.
      </p>
    );
  }
  return (
    <section className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10" data-testid="web-lookup-card" data-source="web-lookup">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Web lookup · Open-Meteo · not in catalog</p>
      <h3 className="mt-1 text-lg font-semibold leading-tight">{out.name}</h3>
      {out.where ? <p className="text-xs text-muted-foreground">{out.where}</p> : null}
      <p className="mt-3 text-[15px] leading-snug">
        Next 7 days {snowAmount(out.next7Cm, units)} <span className="text-[10px] opacity-60">est.</span>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Model forecast only. Not a station observation and not recorded snowfall.
        {out.forecastDays?.[0]?.date ? ` Through ${fmtShort(out.forecastDays[out.forecastDays.length - 1].date)}.` : ''}
      </p>
    </section>
  );
}

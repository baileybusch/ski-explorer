import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SnowStake } from '@/components/SnowStake';
import { SnowSplit, Unit, statNum } from '@/components/SnowSplit';
import { fzlLabel, snowAmount, type SnowUnits } from '@/lib/format';
import { stakeMax } from '@/lib/boardLayout';
import { fmtShort } from '../../../lib/util.js';
import type { ClimateOutput, CompareOutput, RankOutput, ResortOutput, SnowRow } from '@/lib/askTypes';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Est() {
  return <span className="ml-1 text-[10px] opacity-60">est.</span>;
}

function Num({ cm, units, className = 'text-[1.35rem]' }: { cm: number; units: SnowUnits; className?: string }) {
  return (
    <span className={`font-display tabular whitespace-nowrap leading-none ${className}`}>
      {statNum(cm, units)}<Unit units={units} />
    </span>
  );
}

/** Shared frame for every inline answer: a raised panel with a plain sentence-case caption. */
function Frame({ caption, children, testid, footer }: { caption: ReactNode; children: ReactNode; testid: string; footer?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10" data-testid={testid}>
      <header className="px-3.5 pt-3 pb-2 text-[13px] text-muted-foreground">{caption}</header>
      {children}
      {footer ? <div className="border-t border-foreground/8 px-2 py-1.5">{footer}</div> : null}
    </section>
  );
}

export function PartPending({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10" data-testid="ask-part-pending" aria-live="polite">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-2 h-1.5 w-2/3 overflow-hidden rounded-[2px]" style={{ background: 'color-mix(in oklch, currentColor 10%, transparent)' }}>
        <div className="ask-pending stake-forecast h-full w-full rounded-[2px] opacity-60" />
      </div>
    </div>
  );
}

const COLS = 'grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,4.75rem)_minmax(0,4.75rem)] min-[480px]:grid-cols-[1.6rem_minmax(0,1fr)_minmax(0,6.25rem)_minmax(0,6.25rem)]';

export function RankedAnswer({
  out, units, onOpen, onShowBoard,
}: {
  out: RankOutput;
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
}) {
  const day = out.sort === 'actual24h';
  const actualOf = (r: SnowRow) => (day ? r.actual24Cm : r.actual72Cm);
  const max = stakeMax(out.rows.flatMap(r => [actualOf(r), r.next7Cm]));
  const where = out.where === 'Worldwide' ? 'All resorts' : out.where;
  return (
    <Frame
      testid="ask-ranked"
      caption={<>{where}, ranked by {out.sortLabel.toLowerCase()}</>}
      footer={(
        <Button type="button" variant="ghost" size="sm" className="min-h-10 w-full justify-start px-2 text-[13px]" data-testid="ask-show-board" onClick={() => onShowBoard(out)}>
          {out.total > out.rows.length ? `See all ${out.total} on the board` : 'Show these on the board'}
        </Button>
      )}
    >
      <div className={`grid ${COLS} gap-x-3 px-3.5 pb-1.5 text-[11px] text-muted-foreground`} aria-hidden>
        <span />
        <span />
        <span className={out.sort !== 'forecast7d' ? 'text-foreground/85' : ''}>{day ? 'Last 24h' : 'Last 72h'}</span>
        <span className={out.sort === 'forecast7d' ? 'text-foreground/85' : ''}>Next 7 days</span>
      </div>
      <ol className="flex flex-col" data-testid="ask-ranked-rows">
        {out.rows.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              className={`grid w-full ${COLS} items-center gap-x-3 px-3.5 py-2.5 text-left outline-offset-[-2px] hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring`}
              onClick={() => onOpen(r.id)}
              data-testid="ask-row"
              data-resort={r.id}
              data-actual={actualOf(r)}
              data-next7={r.next7Cm}
              aria-label={`${r.name}, ${snowAmount(actualOf(r), units)}${r.estimated ? ' estimated' : ''} ${day ? 'last 24 hours' : 'last 72 hours'}, ${snowAmount(r.next7Cm, units)} forecast next 7 days`}
            >
              <span className="font-display tabular text-lg leading-none text-muted-foreground">{i + 1}</span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[15px] font-medium leading-tight">{r.name}</span>
                {r.where ? <span className="block truncate text-xs text-muted-foreground">{r.where}</span> : null}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-baseline"><Num cm={actualOf(r)} units={units} />{r.estimated ? <Est /> : null}</span>
                <SnowStake cm={actualOf(r)} max={max} kind="actual" estimated={r.estimated} size="row" />
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <Num cm={r.next7Cm} units={units} />
                <SnowStake cm={r.next7Cm} max={max} kind="forecast" size="row" />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

function elev(m: number | null | undefined, units: SnowUnits) {
  return m == null ? '—' : fzlLabel(m, units);
}

function MonthStrip({ avgCm, hemisphere, units }: { avgCm: (number | null)[]; hemisphere: 'N' | 'S'; units: SnowUnits }) {
  const order = hemisphere === 'S' ? [6, 7, 8, 9] : [11, 12, 1, 2, 3, 4];
  const vals = order.map(m => ({ m, v: avgCm[m - 1] })).filter(x => x.v != null) as { m: number; v: number }[];
  if (!vals.length) return null;
  const max = Math.max(...vals.map(x => x.v));
  return (
    <div className="mt-3" data-testid="ask-month-strip">
      <div className="mb-1.5 text-[11px] text-muted-foreground">Average by month, past seasons</div>
      <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${vals.length}, minmax(0, 1fr))` }}>
        {vals.map(({ m, v }) => (
          <div key={m} className="flex flex-col items-center gap-1" aria-label={`${MONTH_SHORT[m - 1]} ${snowAmount(v, units)}`}>
            <div className="flex h-10 w-full items-end">
              <div className="stake-history w-full rounded-[2px]" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{MONTH_SHORT[m - 1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResortAnswer({ out, units, onOpen }: { out: ResortOutput; units: SnowUnits; onOpen: (id: string) => void }) {
  if (!out.found || !out.resort) {
    return <p className="text-sm text-muted-foreground">No resort matched “{out.query}”. Try the full resort name.</p>;
  }
  const r = out.resort;
  const max = stakeMax([r.actual72Cm, r.next7Cm]);
  return (
    <section className="rounded-xl bg-card p-3.5 ring-1 ring-foreground/10" data-testid="ask-resort" data-resort={r.id}>
      <button type="button" className="block w-full text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onOpen(r.id)}>
        <span className="block text-lg font-semibold leading-tight">{r.name}</span>
        <span className="block text-xs text-muted-foreground">{[r.where, r.passes.length ? r.passes.map(p => p[0].toUpperCase() + p.slice(1)).join(' + ') : null].filter(Boolean).join(', ')}</span>
      </button>
      <div className="mt-3">
        <SnowSplit pastCm={r.actual72Cm} nextCm={r.next7Cm} units={units} estimated={r.estimated} max={max} />
      </div>
      {out.storm?.text ? <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{out.storm.text}</p> : null}
      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-foreground/8 pt-3 text-xs">
        {[
          ['Vertical', elev(r.verticalM, units)],
          ['Runs', r.runs ?? '—'],
          ['Lifts', r.lifts ?? '—'],
          ['Airport', r.airport ?? '—'],
        ].map(([k, v]) => (
          <div key={String(k)} className="min-w-0">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {out.climate ? <MonthStrip avgCm={out.climate.avgCm} hemisphere={out.climate.hemisphere} units={units} /> : null}
      <Button type="button" variant="outline" className="mt-3 min-h-10 w-full text-sm" data-testid="ask-open-resort" onClick={() => onOpen(r.id)}>
        Open {r.name}
      </Button>
    </section>
  );
}

export function CompareAnswer({ out, units, onOpen }: { out: CompareOutput; units: SnowUnits; onOpen: (id: string) => void }) {
  const rows = out.rows;
  if (!rows.length) return null;
  const best = (f: (r: (typeof rows)[number]) => number | null) => {
    const vals = rows.map(f).filter((v): v is number => v != null);
    return vals.length ? Math.max(...vals) : null;
  };
  const lines: { label: string; get: (r: (typeof rows)[number]) => number | null; show: (r: (typeof rows)[number]) => ReactNode }[] = [
    { label: 'Last 72h', get: r => r.actual72Cm, show: r => <span className="inline-flex items-baseline"><Num cm={r.actual72Cm} units={units} className="text-xl" />{r.estimated ? <Est /> : null}</span> },
    { label: 'Next 7 days', get: r => r.next7Cm, show: r => <Num cm={r.next7Cm} units={units} className="text-xl" /> },
    { label: 'Vertical', get: r => r.verticalM, show: r => elev(r.verticalM, units) },
    { label: 'Runs', get: r => r.runs, show: r => r.runs ?? '—' },
    { label: 'Lifts', get: r => r.lifts, show: r => r.lifts ?? '—' },
  ];
  return (
    <Frame testid="ask-compare" caption="Side by side">
      <div className="overflow-x-auto px-1.5 pb-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[5.5rem]" />
              {rows.map(r => (
                <th key={r.id} scope="col" className="px-2 pb-2 text-left align-bottom font-medium">
                  <button type="button" className="text-left leading-tight underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onOpen(r.id)}>
                    {r.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(line => {
              const top = best(line.get);
              return (
                <tr key={line.label} className="border-t border-foreground/8">
                  <th scope="row" className="py-2 pr-2 pl-2 text-left text-xs font-normal text-muted-foreground">{line.label}</th>
                  {rows.map(r => {
                    const lead = top != null && top > 0 && line.get(r) === top && rows.length > 1;
                    return (
                      <td key={r.id} className={`px-2 py-2 tabular ${lead ? 'text-foreground' : 'text-foreground/60'}`} data-leader={lead ? '1' : undefined}>
                        {line.show(r)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

export function ClimateAnswer({ out, units, onOpen }: { out: ClimateOutput; units: SnowUnits; onOpen: (id: string) => void }) {
  const where = out.where === 'Worldwide' ? '' : `, ${out.where}`;
  if (out.kind === 'month') {
    if (out.outOfArchive || !out.rows.length) {
      return (
        <Frame testid="ask-climate" caption={<>Historical average, {out.monthName}{where}</>}>
          <p className="px-3.5 pb-3 text-sm text-muted-foreground">No archive data for {out.monthName}. The archive covers November to April north of the equator and June to September south of it.</p>
        </Frame>
      );
    }
    const max = Math.max(...out.rows.map(r => r.hiCm ?? r.avgCm), 1);
    return (
      <Frame
        testid="ask-climate"
        caption={<>Historical average, {out.monthName}{where}</>}
        footer={<p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground">Average of {out.seasons} seasons. Not a forecast. The line shows the lowest to highest season.</p>}
      >
        <ol className="flex flex-col pb-1.5" data-testid="ask-climate-bars" data-kind="month">
          {out.rows.map(r => (
            <li key={r.id}>
              <button
                type="button"
                className="grid w-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.25rem] items-center gap-x-3 px-3.5 py-2 text-left outline-offset-[-2px] hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring min-[480px]:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem]"
                onClick={() => onOpen(r.id)}
                data-testid="ask-climate-row"
                data-resort={r.id}
                data-avg={r.avgCm}
                aria-label={`${r.name}, ${snowAmount(r.avgCm, units)} average in ${out.monthName} over ${r.seasons} seasons`}
              >
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{r.name}</span>
                  {r.where ? <span className="block truncate text-[11px] text-muted-foreground">{r.where}</span> : null}
                </span>
                <span className="relative h-3.5">
                  {r.loCm != null && r.hiCm != null ? (
                    <span
                      className="absolute top-1/2 h-px -translate-y-1/2 bg-current opacity-35"
                      style={{ left: `${(r.loCm / max) * 100}%`, width: `${Math.max(0, ((r.hiCm - r.loCm) / max) * 100)}%` }}
                    />
                  ) : null}
                  <span className="stake-history absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `max(6px, ${(r.avgCm / max) * 100}%)` }} />
                </span>
                <span className="text-right"><Num cm={r.avgCm} units={units} className="text-lg" /></span>
              </button>
            </li>
          ))}
        </ol>
      </Frame>
    );
  }
  if (!out.months.length) return null;
  const max = Math.max(...out.months.map(m => m.avgCm), 1);
  return (
    <Frame
      testid="ask-climate"
      caption={<>Historical average by month{where}</>}
      footer={<p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground">Average per resort over {out.seasons} seasons. Not a forecast.</p>}
    >
      <div
        className="grid items-end gap-2 px-3.5 pb-3"
        style={{ gridTemplateColumns: `repeat(${out.months.length}, minmax(0, 1fr))` }}
        data-testid="ask-climate-bars"
        data-kind="profile"
      >
        {out.months.map(m => {
          const isBest = out.best?.month === m.month;
          return (
            <div key={m.month} className="flex min-w-0 flex-col items-center gap-1" aria-label={`${m.monthName}: ${snowAmount(m.avgCm, units)} average`}>
              <span className={`font-display tabular text-sm leading-none ${isBest ? '' : 'text-muted-foreground'}`}>{statNum(m.avgCm, units)}</span>
              <div className="flex h-20 w-full items-end">
                <div className={`stake-history w-full rounded-[2px] ${isBest ? '' : 'opacity-55'}`} style={{ height: `${Math.max(6, (m.avgCm / max) * 100)}%` }} />
              </div>
              <span className={`text-[11px] ${isBest ? 'font-medium' : 'text-muted-foreground'}`}>{MONTH_SHORT[m.month - 1]}</span>
            </div>
          );
        })}
      </div>
      {out.best ? (
        <p className="sr-only">Snowiest month on average: {out.best.monthName}.</p>
      ) : null}
    </Frame>
  );
}

type AnyOut = { asOf?: string | null; forecastEnd?: string | null; kind?: string; seasons?: string | null };

export function SourcesNote({ outputs, mode }: { outputs: AnyOut[]; mode?: string }) {
  if (!outputs.length) return null;
  const o = outputs.find(x => x.asOf) || outputs[0];
  const live = outputs.some(x => x.kind === 'rank' || x.kind === 'resort' || x.kind === 'compare');
  const clim = outputs.find(x => x.kind === 'month' || x.kind === 'profile');
  const lines: string[] = [];
  if (live) {
    lines.push('Actual snow is NRCS SNOTEL where a station is mapped, otherwise modeled (est.).');
    lines.push(`Forecast from Open-Meteo${o.forecastEnd ? ` through ${fmtShort(o.forecastEnd)}` : ''}.`);
  }
  if (clim) lines.push(`Historical averages from ERA5 reanalysis via the Open-Meteo archive${clim.seasons ? `, ${clim.seasons}` : ''}. Reanalysis runs low in big mountains, so compare resorts and months rather than reading it as reported totals.`);
  if (o.asOf) lines.push(`Data as of ${fmtShort(o.asOf)}.`);
  return (
    <p className="max-w-[62ch] text-[11px] leading-relaxed text-muted-foreground" data-testid="ask-sources" data-mode={mode || ''}>
      {lines.join(' ')}
    </p>
  );
}

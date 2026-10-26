import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { forecastDays } from '../../lib/snowWindow.js';
import { dumpParts, cardTone, gridCols, packCells, rowHeight, targetRows } from '@/lib/board';
import { snowAmount, tempLabel, type SnowUnits, type TempUnits } from '@/lib/format';
import { parseISO } from '../../lib/util.js';
import { RadarThumb } from '@/components/RadarThumb';
import { dumpAria, SnowSplit } from '@/components/SnowSplit';

export function BlockBoard({
  rows, units, tempUnits = 'F', snow, onOpen, scrollerRef, restoreTop, hasMore, onMore, after, tight,
}: {
  rows: { r: any; m: any; storm?: any; wx?: any; dump?: ReturnType<typeof dumpParts> }[];
  units: SnowUnits;
  tempUnits?: TempUnits;
  snow: any;
  onOpen: (id: string) => void;
  scrollerRef?: MutableRefObject<HTMLDivElement | null>;
  restoreTop?: number;
  hasMore?: boolean;
  onMore?: () => void;
  after?: ReactNode;
  tight?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 390, h: 560 });
  const max = Math.max(0, ...rows.map(row => (row.dump || dumpParts(row.r, snow)).dumpCm));

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    if (scrollerRef) scrollerRef.current = el;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 8 && height > 8) setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollerRef]);

  useEffect(() => {
    if (wrap.current && restoreTop != null) wrap.current.scrollTop = restoreTop;
  }, [restoreTop]);

  const gap = 8;
  const cols = gridCols(box.w);
  const minRow = box.w < 400 ? 90 : box.w < 720 ? 104 : 118;
  const packed = packCells(rows.length, cols);
  const first = targetRows(box.h, gap, minRow);
  const fillRows = packed.rows > 0 && packed.rows <= first ? packed.rows : first;
  const rowPx = rowHeight(fillRows, box.h, gap);

  return (
    <div
      ref={wrap}
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${tight ? 'pt-1' : 'pt-5'}`}
      data-testid="board-b"
      data-mode="dump"
    >
      {rows.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
          No resorts in this filter. Back to all resorts or open the menu to reset.
        </div>
      ) : (
        <>
          <p className="px-1 pb-2 text-[11px] text-muted-foreground" data-testid="board-rank-hint">
            Ranked by last 72h + next 7 days
          </p>
          <div
            className="grid w-full min-w-0"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridAutoRows: `${rowPx}px`,
              gap,
            }}
          >
            {packed.cells.map(cell => {
              const row = rows[cell.i];
              const dump = row.dump || dumpParts(row.r, snow);
              const tone = cardTone(cell.i + 1, dump.dumpCm, max);
              const fg = tone.ink ? '#08090b' : '#f2f3f5';
              const featured = cell.colSpan >= 2 && cell.rowSpan >= 2;
              const days = featured ? forecastDays(row.r, snow, { days: 5 }) : [];
              return (
                <button
                  key={row.r.id}
                  type="button"
                  data-testid="block"
                  data-resort={row.r.id}
                  aria-label={dumpAria(row.r.name, dump.past72Cm, dump.next7Cm, units)}
                  className="flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-3 text-left"
                  style={{
                    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                    background: `oklch(${tone.l} ${tone.hero ? 0.018 : 0.012} 255)`,
                    color: fg,
                  }}
                  onClick={() => onOpen(row.r.id)}
                >
                  <div className="min-w-0">
                    <div className={`truncate font-semibold leading-tight ${featured ? 'text-2xl' : 'text-sm'}`}>
                      {row.r.name}
                    </div>
                  </div>
                  <div className={`flex min-h-0 min-w-0 items-end justify-between gap-2 ${featured ? '' : 'flex-col items-stretch'}`}>
                    <SnowSplit pastCm={dump.past72Cm} nextCm={dump.next7Cm} units={units} size={featured ? 'featured' : 'card'} />
                    {featured ? (
                      <RadarThumb
                        lon={row.r.center[0]}
                        lat={row.r.center[1]}
                        enabled
                        className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black/15"
                      />
                    ) : null}
                  </div>
                  {featured ? <ForecastStrip days={days} units={units} tempUnits={tempUnits} /> : null}
                </button>
              );
            })}
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-3">
              <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" data-testid="show-more" onClick={onMore}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}
      {after}
    </div>
  );
}

function ForecastStrip({ days, units, tempUnits }: { days: any[]; units: SnowUnits; tempUnits: TempUnits }) {
  if (!days.length) return null;
  return (
    <div className="flex min-w-0 gap-1" data-testid="forecast-strip">
      {days.map(d => (
        <div key={d.date} className="min-w-0 flex-1 text-center">
          <div className="text-[10px] opacity-60">
            {parseISO(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
          </div>
          <div className="text-xs font-semibold leading-none">
            {snowAmount(d.snowCm, units)}
          </div>
          {d.tmax != null ? (
            <div className="text-[10px] opacity-55">{tempLabel(d.tmax, tempUnits)}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

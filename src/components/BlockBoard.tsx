import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { forecastDays } from '../../lib/snowWindow.js';
import { cardTone, gridCols, incomingScore, packCells, rowHeight, snowScore, targetRows } from '@/lib/board';
import { fmtIn, parseISO } from '../../lib/util.js';
import { snowAmount, stormBadge, tempLabel } from '@/lib/format';
import { RadarThumb } from '@/components/RadarThumb';

export function BlockBoard({
  rows, units, snow, onOpen, scrollerRef, restoreTop, mode, hasMore, onMore,
}: {
  rows: { r: any; m: any; storm?: any; wx?: any }[];
  units: 'in' | 'cm';
  snow: any;
  onOpen: (id: string) => void;
  scrollerRef?: MutableRefObject<HTMLDivElement | null>;
  restoreTop?: number;
  mode: 'recent' | 'incoming';
  hasMore?: boolean;
  onMore?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 390, h: 560 });
  const scoreOf = mode === 'incoming' ? incomingScore : snowScore;
  const max = Math.max(0, ...rows.map(scoreOf));

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
      className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(7.2rem,env(safe-area-inset-bottom))] pt-1"
      data-testid="board-b"
      data-mode={mode}
    >
      {rows.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
          No resorts in this filter. Open the menu to reset scope.
        </div>
      ) : (
        <>
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridAutoRows: `${rowPx}px`,
              gap,
            }}
          >
            {packed.cells.map(cell => {
              const row = rows[cell.i];
              const score = scoreOf(row);
              const tone = cardTone(cell.i + 1, score, max);
              const num = units === 'cm' ? Math.round(score) : fmtIn(score);
              const unit = units === 'cm' ? 'cm' : '″';
              const fg = tone.ink ? '#08090b' : '#f2f3f5';
              const featured = cell.colSpan >= 2 && cell.rowSpan >= 2;
              const days = forecastDays(row.r, snow, { days: featured ? 5 : 4 });
              return (
                <button
                  key={row.r.id}
                  type="button"
                  data-testid="block"
                  data-resort={row.r.id}
                  className="flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-3 text-left"
                  style={{
                    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                    background: `oklch(${tone.l} ${tone.hero ? 0.018 : 0.012} 255)`,
                    color: fg,
                  }}
                  onClick={() => onOpen(row.r.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`truncate font-semibold leading-tight ${featured ? 'text-2xl' : 'text-sm'}`}>
                        {row.r.name}
                      </div>
                    </div>
                    {mode === 'incoming' && row.storm?.tier ? (
                      <Badge variant="secondary" className="shrink-0 text-[11px]">Storm {stormBadge(row.storm.tier)}</Badge>
                    ) : null}
                  </div>
                  <div className={`flex min-h-0 items-end justify-between gap-2 ${featured ? '' : 'flex-col items-stretch'}`}>
                    <div className="font-display leading-none" style={{ fontSize: featured ? 'clamp(3rem, 11vw, 4.8rem)' : '1.85rem' }}>
                      {num}<span className="text-[0.38em]">{unit}</span>
                    </div>
                    {featured ? (
                      <RadarThumb
                        lon={row.r.center[0]}
                        lat={row.r.center[1]}
                        enabled
                        className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black/15"
                      />
                    ) : null}
                  </div>
                  <ForecastStrip days={days} units={units} compact={!featured} />
                  {featured && mode === 'incoming' && row.storm?.tier ? (
                    <div className="truncate text-[11px] opacity-60">Storm incoming · modeled</div>
                  ) : null}
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
    </div>
  );
}

function ForecastStrip({ days, units, compact }: { days: any[]; units: 'in' | 'cm'; compact?: boolean }) {
  if (!days.length) return null;
  return (
    <div className="flex gap-1" data-testid="forecast-strip">
      {days.map(d => (
        <div key={d.date} className="min-w-0 flex-1 text-center">
          <div className="text-[10px] opacity-60">
            {parseISO(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
          </div>
          <div className={`font-semibold leading-none ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {snowAmount(d.snowCm, units)}
          </div>
          {!compact && d.tmax != null ? (
            <div className="text-[10px] opacity-55">{tempLabel(d.tmax, units)}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

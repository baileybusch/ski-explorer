import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { passLabel } from '@/lib/format';
import { snowSpark } from '../../lib/snowWindow.js';
import { cardTone, gridCols, packCells, rowHeight, snowScore, sparkPath, targetRows } from '@/lib/board';
import { fmtIn } from '../../lib/util.js';

export function BlockBoard({
  rows, units, snow, onOpen, scrollerRef, restoreTop,
}: {
  rows: { r: any; m: any; storm?: any; wx?: any }[];
  units: 'in' | 'cm';
  snow: any;
  onOpen: (id: string) => void;
  scrollerRef?: MutableRefObject<HTMLDivElement | null>;
  restoreTop?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 390, h: 560 });
  const max = Math.max(0, ...rows.map(snowScore));

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
      className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1"
      data-testid="board-b"
    >
      {rows.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
          No resorts in this filter. Open the menu to reset scope.
        </div>
      ) : (
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
            const score = snowScore(row);
            const tone = cardTone(cell.i + 1, score, max);
            const num = units === 'cm' ? Math.round(score) : fmtIn(score);
            const unit = units === 'cm' ? 'cm' : '″';
            const spark = snowSpark(row.r, snow);
            const fg = tone.ink ? '#08090b' : '#f2f3f5';
            const featured = cell.colSpan >= 2 && cell.rowSpan >= 2;
            const wide = cell.colSpan >= 2;
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
                  <span className="text-sm font-semibold opacity-70">#{cell.i + 1}</span>
                  {passLabel(row.r) ? <Badge variant="secondary" className="text-[11px]">{passLabel(row.r)}</Badge> : null}
                </div>
                <div className={`flex min-h-0 items-end justify-between gap-2 ${wide ? '' : 'flex-col items-start'}`}>
                  <div className="min-w-0">
                    <div className={`truncate font-semibold leading-tight ${featured ? 'text-2xl' : wide ? 'text-lg' : 'text-sm'}`}>
                      {row.r.name}
                    </div>
                    {featured || wide ? (
                      <div className="mt-0.5 truncate text-xs opacity-60">{row.r.region || row.r.state}</div>
                    ) : null}
                  </div>
                  <div className="flex items-end gap-2">
                    <Sparkline values={spark} className={`${featured ? 'mb-1 h-5 w-16' : 'hidden'} opacity-70 sm:block`} />
                    <div className="font-display leading-none" style={{ fontSize: featured ? 'clamp(3.2rem, 12vw, 5.4rem)' : wide ? '2.6rem' : '2rem' }}>
                      {num}<span className="text-[0.38em]">{unit}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  return (
    <svg viewBox="0 0 72 22" className={className} aria-hidden>
      <path d={sparkPath(values)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

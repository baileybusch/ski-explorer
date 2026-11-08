import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { dumpParts, cardTone, packCells, relativeUpdated, gridCols, layoutGap, layoutCardH, layoutPadX } from '@/lib/board';
import type { BoardSortId } from '@/lib/boardLayout';
import type { SnowUnits, TempUnits } from '@/lib/format';
import { dumpAria, SnowSplit } from '@/components/SnowSplit';
import { BoardToolbar } from '@/components/BoardToolbar';

export function BlockBoard({
  rows, units, snow, onOpen, scrollerRef, restoreTop, hasMore, onMore, after, tight,
  sort, onSort, regionId, regions, onRegion, observedOnly, onObservedOnly,
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
  sort: BoardSortId;
  onSort: (s: BoardSortId) => void;
  regionId: string;
  regions: { id: string; name: string }[];
  onRegion: (id: string) => void;
  observedOnly: boolean;
  onObservedOnly: (on: boolean) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 390, h: 560 });
  const max = Math.max(0, ...rows.map(row => (row.dump || dumpParts(row.r, snow)).past72Cm));
  const updated = relativeUpdated(snow?.observedFetched || snow?.generated);

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

  const gap = layoutGap(box.w);
  const padX = layoutPadX(box.w);
  const cols = gridCols(box.w);
  const packed = packCells(rows.length, cols);
  const featured = rows.length >= 3;
  const featuredH = layoutCardH(box.w, true);
  const cardH = layoutCardH(box.w, false);
  const templateRows = featured
    ? `${featuredH}px repeat(${Math.max(0, packed.rows - 1)}, ${cardH}px)`
    : `repeat(${packed.rows}, ${cardH}px)`;

  return (
    <div
      ref={wrap}
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${tight ? 'pt-1' : 'pt-3'}`}
      style={{ paddingLeft: padX, paddingRight: padX }}
      data-testid="board-b"
      data-mode="dump"
      data-sort={sort}
      data-cols={cols}
    >
      {rows.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
          No resorts in this filter. Back to all resorts or open the menu to reset.
        </div>
      ) : (
        <>
          <BoardToolbar
            sort={sort}
            onSort={onSort}
            regionId={regionId}
            regions={regions}
            onRegion={onRegion}
            observedOnly={observedOnly}
            onObservedOnly={onObservedOnly}
            updated={updated}
          />
          <div
            className="grid w-full min-w-0"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: templateRows,
              gap,
            }}
          >
            {packed.cells.map(cell => {
              const row = rows[cell.i];
              const dump = row.dump || dumpParts(row.r, snow);
              const tone = cardTone(cell.i + 1, dump.past72Cm, max);
              const fg = tone.ink ? '#08090b' : '#f2f3f5';
              const isFeatured = cell.i === 0 && featured;
              return (
                <button
                  key={row.r.id}
                  type="button"
                  data-testid="block"
                  data-resort={row.r.id}
                  data-rank={cell.i + 1}
                  data-snow72={String(dump.past72In)}
                  data-snow24={String(dump.past24In)}
                  data-next7={String(dump.next7In)}
                  data-source={dump.source}
                  data-estimated={dump.estimated ? '1' : '0'}
                  aria-label={dumpAria(row.r.name, dump.past72Cm, dump.next7Cm, units, dump.estimated)}
                  className="flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-3 text-left"
                  style={{
                    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                    background: `oklch(${tone.l} ${tone.hero ? 0.018 : 0.012} 255)`,
                    color: fg,
                  }}
                  onClick={() => onOpen(row.r.id)}
                >
                  <div className={`truncate font-semibold leading-tight ${isFeatured ? 'text-lg md:text-xl' : 'text-sm'}`}>
                    {row.r.name}
                  </div>
                  <div className={isFeatured ? 'max-w-md' : 'w-full'}>
                    <SnowSplit
                      pastCm={dump.past72Cm}
                      nextCm={dump.next7Cm}
                      units={units}
                      size={isFeatured ? 'featured' : 'card'}
                      estimated={dump.estimated}
                    />
                  </div>
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

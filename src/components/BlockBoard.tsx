import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { dumpParts, cardTone, packCells, relativeUpdated, gridCols, layoutGap, layoutCardH, layoutPadX } from '@/lib/board';
import { BOARD_LAYOUT, boardMode, stakeMax, type BoardSortId } from '@/lib/boardLayout';
import type { SnowUnits, TempUnits } from '@/lib/format';
import { dumpAria, SnowSplit, statNum, Unit } from '@/components/SnowSplit';
import { SnowStake } from '@/components/SnowStake';
import { BoardToolbar } from '@/components/BoardToolbar';

type Row = { r: any; m: any; storm?: any; wx?: any; dump?: ReturnType<typeof dumpParts> };

export function BlockBoard({
  rows, units, snow, onOpen, scrollerRef, restoreTop, hasMore, onMore, after, tight,
  sort, onSort, regionId, regions, onRegion, observedOnly, onObservedOnly,
}: {
  rows: Row[];
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
  const parts = rows.map(row => row.dump || dumpParts(row.r, snow));
  const maxPast = Math.max(0, ...parts.map(d => d.past72Cm));
  const scale = stakeMax(parts.flatMap(d => [d.past72Cm, d.next7Cm]));
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

  const mode = boardMode(box.w);
  const padX = layoutPadX(box.w);
  const cols = mode === 'table' ? 1 : gridCols(box.w);

  return (
    <div
      ref={wrap}
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${tight ? 'pt-1' : 'pt-2'}`}
      style={{ paddingLeft: padX, paddingRight: padX }}
      data-testid="board-b"
      data-mode="dump"
      data-layout={mode}
      data-sort={sort}
      data-cols={cols}
    >
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
      {rows.length === 0 ? (
        <p className="px-1 py-16 text-center text-sm text-muted-foreground" data-testid="board-empty">
          No resorts match this filter. Choose All regions or turn off Observed only.
        </p>
      ) : mode === 'table' ? (
        <BoardTable rows={rows} parts={parts} units={units} scale={scale} sort={sort} onSort={onSort} onOpen={onOpen} />
      ) : (
        <BoardCards rows={rows} parts={parts} units={units} scale={scale} maxPast={maxPast} width={box.w} cols={cols} onOpen={onOpen} />
      )}
      {hasMore && rows.length ? (
        <div className="flex justify-center pt-4">
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" data-testid="show-more" onClick={onMore}>
            Show more resorts
          </Button>
        </div>
      ) : null}
      {after}
    </div>
  );
}

function place(r: any) {
  const where = r.region || r.state || r.country || '';
  return r.town && r.town !== r.name ? `${r.town}, ${where}` : where;
}

function rowAttrs(row: Row, d: ReturnType<typeof dumpParts>, rank: number, units: SnowUnits) {
  return {
    'data-testid': 'block',
    'data-resort': row.r.id,
    'data-rank': rank,
    'data-snow72': String(d.past72In),
    'data-snow24': String(d.past24In),
    'data-next7': String(d.next7In),
    'data-source': d.source,
    'data-estimated': d.estimated ? '1' : '0',
    'aria-label': dumpAria(row.r.name, d.past72Cm, d.next7Cm, units, d.estimated),
  };
}

function BoardCards({
  rows, parts, units, scale, maxPast, width, cols, onOpen,
}: {
  rows: Row[];
  parts: ReturnType<typeof dumpParts>[];
  units: SnowUnits;
  scale: number;
  maxPast: number;
  width: number;
  cols: number;
  onOpen: (id: string) => void;
}) {
  const gap = layoutGap(width);
  const packed = packCells(rows.length, cols);
  const featured = rows.length >= 3;
  const featuredH = layoutCardH(width, true);
  const cardH = layoutCardH(width, false);
  const templateRows = featured
    ? `${featuredH}px repeat(${Math.max(0, packed.rows - 1)}, ${cardH}px)`
    : `repeat(${packed.rows}, ${cardH}px)`;
  return (
    <div
      className="grid w-full min-w-0"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: templateRows, gap }}
      data-testid="board-cards"
    >
      {packed.cells.map(cell => {
        const row = rows[cell.i];
        const d = parts[cell.i];
        const tone = cardTone(cell.i + 1, d.past72Cm, maxPast);
        const isFeatured = cell.i === 0 && featured;
        return (
          <button
            key={row.r.id}
            type="button"
            {...rowAttrs(row, d, cell.i + 1, units)}
            className="flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            style={{
              gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
              gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
              background: `oklch(${tone.l} ${tone.hero ? 0.018 : 0.012} 255)`,
              color: tone.ink ? '#08090b' : '#f2f3f5',
            }}
            onClick={() => onOpen(row.r.id)}
          >
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="tabular shrink-0 text-xs opacity-60" aria-hidden>{cell.i + 1}</span>
              <span className={`truncate font-semibold leading-tight ${isFeatured ? 'text-lg' : 'text-sm'}`}>{row.r.name}</span>
              {isFeatured ? <span className="ml-auto hidden truncate text-xs opacity-60 min-[420px]:inline">{place(row.r)}</span> : null}
            </div>
            <div className={isFeatured ? 'max-w-md' : 'w-full'}>
              <SnowSplit
                pastCm={d.past72Cm}
                nextCm={d.next7Cm}
                units={units}
                size={isFeatured ? 'featured' : 'card'}
                estimated={d.estimated}
                max={scale}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

const HEADERS: { label: string; sort?: BoardSortId; align?: 'end' }[] = [
  { label: 'Rank' },
  { label: 'Resort', sort: 'name' },
  { label: 'Region' },
  { label: 'Last 24h', sort: 'actual24', align: 'end' },
  { label: 'Last 72h', sort: 'actual72' },
  { label: 'Next 7 days', sort: 'forecast7d' },
];

function BoardTable({
  rows, parts, units, scale, sort, onSort, onOpen,
}: {
  rows: Row[];
  parts: ReturnType<typeof dumpParts>[];
  units: SnowUnits;
  scale: number;
  sort: BoardSortId;
  onSort: (s: BoardSortId) => void;
  onOpen: (id: string) => void;
}) {
  const t = BOARD_LAYOUT.table;
  const lead = rows[0];
  const leadD = parts[0];
  return (
    <div className="w-full min-w-0" data-testid="board-table">
      <button
        type="button"
        {...rowAttrs(lead, leadD, 1, units)}
        className="grid w-full min-w-0 items-end gap-x-6 rounded-[var(--radius-card)] px-5 pb-5 pt-4 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        style={{ gridTemplateColumns: t.columns, minHeight: t.featuredH, background: 'var(--paper)', color: 'var(--ink)' }}
        data-featured="1"
        onClick={() => onOpen(lead.r.id)}
      >
        <span className="font-display tabular self-start text-5xl leading-none" aria-hidden>1</span>
        <span className="col-span-2 flex min-w-0 flex-col gap-1 self-start">
          <span className="truncate text-3xl font-semibold leading-tight tracking-tight">{lead.r.name}</span>
          <span className="truncate text-sm opacity-65">{place(lead.r)}</span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="text-xs opacity-70">Last 24h</span>
          <span className="font-display tabular text-[1.75rem] leading-[0.9]">{statNum(leadD.past24Cm, units)}<Unit units={units} /></span>
        </span>
        <span className="col-span-2 min-w-0">
          <SnowSplit pastCm={leadD.past72Cm} nextCm={leadD.next7Cm} units={units} size="hero" estimated={leadD.estimated} max={scale} />
        </span>
      </button>

      <div
        className="sticky top-0 z-10 mt-3 grid gap-x-6 border-b border-foreground/15 bg-background px-5 py-2 text-xs text-muted-foreground"
        style={{ gridTemplateColumns: t.columns }}
        data-testid="board-table-head"
      >
        {HEADERS.map(h => {
          const active = h.sort === sort;
          if (!h.sort) {
            return h.label === 'Rank'
              ? <span key={h.label}><span className="sr-only">{h.label}</span></span>
              : <span key={h.label}>{h.label}</span>;
          }
          return (
            <button
              key={h.label}
              type="button"
              className={`-mx-1 rounded px-1 text-left outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${h.align === 'end' ? 'justify-self-end text-right' : 'justify-self-start'} ${active ? 'font-semibold text-foreground' : ''}`}
              aria-pressed={active}
              aria-label={`Rank by ${h.label.toLowerCase()}`}
              data-testid={`sort-col-${h.sort}`}
              onClick={() => onSort(h.sort!)}
            >
              {h.label}{active ? <span aria-hidden> ↓</span> : null}
            </button>
          );
        })}
      </div>

      <ol className="flex flex-col" data-testid="board-rows">
        {rows.slice(1).map((row, k) => {
          const d = parts[k + 1];
          const rank = k + 2;
          return (
            <li key={row.r.id} className="border-b border-foreground/8">
              <button
                type="button"
                {...rowAttrs(row, d, rank, units)}
                className="grid w-full min-w-0 items-center gap-x-6 px-5 text-left outline-offset-[-2px] hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
                style={{ gridTemplateColumns: t.columns, height: t.rowH }}
                onClick={() => onOpen(row.r.id)}
              >
                <span className="tabular text-sm text-muted-foreground">{rank}</span>
                <span className="truncate text-[15px] font-medium">{row.r.name}</span>
                <span className="truncate text-sm text-muted-foreground">{row.r.region || row.r.state || row.r.country}</span>
                <span className="font-display tabular justify-self-end text-xl leading-none text-foreground/80">
                  {statNum(d.past24Cm, units)}<Unit units={units} />
                </span>
                <StakeCell cm={d.past72Cm} max={scale} units={units} kind="actual" estimated={d.estimated} />
                <StakeCell cm={d.next7Cm} max={scale} units={units} kind="forecast" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StakeCell({
  cm, max, units, kind, estimated = false,
}: {
  cm: number;
  max: number;
  units: SnowUnits;
  kind: 'actual' | 'forecast';
  estimated?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2" data-testid={`cell-${kind}`}>
      <span className="font-display tabular w-14 shrink-0 text-right text-2xl leading-none">
        {statNum(cm, units)}<Unit units={units} />
      </span>
      <span className="w-6 shrink-0 text-[11px] text-muted-foreground">{estimated ? 'est.' : ''}</span>
      <span className="min-w-0 flex-1">
        <SnowStake cm={cm} max={max} kind={kind} estimated={estimated} size="row" />
      </span>
    </span>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { dumpParts, relativeUpdated } from '@/lib/board';
import { BOARD_LAYOUT, boardDensity, layoutPadX, stakeMax, type BoardDensity, type BoardSortId } from '@/lib/boardLayout';
import type { SnowUnits, TempUnits } from '@/lib/format';
import { dumpAria, statNum, Unit } from '@/components/SnowSplit';
import { SnowStake } from '@/components/SnowStake';
import { BoardToolbar } from '@/components/BoardToolbar';

type Row = { r: any; m: any; storm?: any; wx?: any; dump?: ReturnType<typeof dumpParts> };
type Parts = ReturnType<typeof dumpParts>;

export function BlockBoard({
  rows, units, snow, onOpen, scrollerRef, restoreTop, hasMore, onMore, before, after, tight,
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
  before?: ReactNode;
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
  const [width, setWidth] = useState(390);
  const parts = rows.map(row => row.dump || dumpParts(row.r, snow));
  const scale = stakeMax(parts.flatMap(d => [d.past72Cm, d.next7Cm]));
  const updated = relativeUpdated(snow?.observedFetched || snow?.generated);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    if (scrollerRef) scrollerRef.current = el;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 8) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollerRef]);

  useEffect(() => {
    if (wrap.current && restoreTop != null) wrap.current.scrollTop = restoreTop;
  }, [restoreTop]);

  const density = boardDensity(width);
  const padX = layoutPadX(width);

  return (
    <div
      ref={wrap}
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]`}
      style={{ paddingLeft: padX, paddingRight: padX }}
      data-testid="board-b"
      data-mode="dump"
      data-layout="list"
      data-density={density}
      data-sort={sort}
    >
      {before}
      <div className={tight ? 'pt-1' : 'pt-2'}>
        <BoardToolbar
          sort={sort}
          onSort={onSort}
          regionId={regionId}
          regions={regions}
          onRegion={onRegion}
          observedOnly={observedOnly}
          onObservedOnly={onObservedOnly}
          updated={density === 'full' ? updated : null}
        />
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-16 text-center text-sm text-muted-foreground" data-testid="board-empty">
          No resorts match this filter. Choose All regions or turn off Observed only.
        </p>
      ) : (
        <BoardList rows={rows} parts={parts} units={units} scale={scale} sort={sort} onSort={onSort} onOpen={onOpen} density={density} updated={density === 'compact' ? updated : null} />
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

function rowAttrs(row: Row, d: Parts, rank: number, units: SnowUnits) {
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

type StatCol = { key: 'actual24' | 'actual72' | 'forecast7d'; label: string; sort: BoardSortId; testid: string };

/** Fixed stat columns per density. Compact folds 24h into the Actual column. */
function statCols(density: BoardDensity, sort: BoardSortId): StatCol[] {
  if (density === 'full') {
    return [
      { key: 'actual24', label: 'Last 24h', sort: 'actual24', testid: 'cell-24h' },
      { key: 'actual72', label: 'Last 72h', sort: 'actual72', testid: 'cell-actual' },
      { key: 'forecast7d', label: 'Next 7 days', sort: 'forecast7d', testid: 'cell-forecast' },
    ];
  }
  const day = sort === 'actual24';
  return [
    { key: day ? 'actual24' : 'actual72', label: day ? 'Last 24h' : 'Last 72h', sort: day ? 'actual24' : 'actual72', testid: 'cell-actual' },
    { key: 'forecast7d', label: 'Next 7d', sort: 'forecast7d', testid: 'cell-forecast' },
  ];
}

/** Compact has one Actual column: tapping it while it is active flips 72h ↔ 24h. */
function headSort(c: StatCol, sort: BoardSortId, full: boolean): BoardSortId {
  if (full || c.key === 'forecast7d' || sort !== c.sort) return c.sort;
  return c.sort === 'actual72' ? 'actual24' : 'actual72';
}

function cmFor(d: Parts, key: StatCol['key']) {
  return key === 'actual24' ? d.past24Cm : key === 'actual72' ? d.past72Cm : d.next7Cm;
}

/** Re-rank animation: rows glide from their old slot to the new one (FLIP). */
function useReorderMotion(order: string) {
  const els = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    els.current.forEach((el, id) => next.set(id, el.offsetTop));
    const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still && tops.current.size) {
      els.current.forEach((el, id) => {
        const before = tops.current.get(id);
        const after = next.get(id);
        if (before == null || after == null || before === after) return;
        el.animate(
          [{ transform: `translateY(${before - after}px)` }, { transform: 'translateY(0)' }],
          { duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
        );
      });
    }
    tops.current = next;
  }, [order]);
  return (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
}

function BoardList({
  rows, parts, units, scale, sort, onSort, onOpen, density, updated,
}: {
  rows: Row[];
  parts: Parts[];
  units: SnowUnits;
  scale: number;
  sort: BoardSortId;
  onSort: (s: BoardSortId) => void;
  onOpen: (id: string) => void;
  density: BoardDensity;
  updated?: string | null;
}) {
  const t = BOARD_LAYOUT.list[density];
  const cols = statCols(density, sort);
  const full = density === 'full';
  const pad = full ? 'px-4' : 'px-2';
  const gap = full ? 'gap-x-5' : 'gap-x-2.5';
  const refFor = useReorderMotion(rows.map(r => r.r.id).join(','));

  return (
    <div className="w-full min-w-0" data-testid="board-list">
      <div
        className={`sticky top-0 z-10 grid items-end border-b border-foreground/15 bg-background ${pad} ${gap} pt-1.5 pb-2 text-xs text-muted-foreground`}
        style={{ gridTemplateColumns: t.columns }}
        data-testid="board-list-head"
      >
        <span><span className="sr-only">Rank</span></span>
        <span className="flex min-w-0 items-baseline gap-2">
          <HeadButton label="Resort" active={sort === 'name'} align="start" testid="sort-col-name" onClick={() => onSort('name')} />
          {updated ? <span className="truncate text-[11px]" data-testid="board-updated">{updated}</span> : null}
        </span>
        {cols.map(c => (
          <HeadButton
            key={c.testid}
            label={c.label}
            active={sort === c.sort}
            align="end"
            testid={full ? `sort-col-${c.sort}` : c.key === 'forecast7d' ? 'sort-col-forecast7d' : 'sort-col-actual'}
            onClick={() => onSort(headSort(c, sort, full))}
          />
        ))}
      </div>

      <ol className="relative flex flex-col" data-testid="board-rows">
        {rows.map((row, i) => {
          const d = parts[i];
          const lead = i === 0;
          return (
            <li key={row.r.id} ref={refFor(row.r.id)} className={lead ? 'py-1' : 'border-b border-foreground/8'}>
              <button
                type="button"
                {...rowAttrs(row, d, i + 1, units)}
                data-featured={lead ? '1' : undefined}
                className={`grid w-full min-w-0 items-center text-left outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-ring ${pad} ${gap} ${lead ? 'rounded-lg bg-foreground/[0.07] hover:bg-foreground/[0.1]' : 'hover:bg-foreground/[0.04]'}`}
                style={{ gridTemplateColumns: t.columns, height: lead ? t.leadH : t.rowH }}
                onClick={() => onOpen(row.r.id)}
              >
                <span className={`tabular text-right text-sm ${lead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{i + 1}</span>
                <span className="flex min-w-0 flex-col">
                  <span className={`truncate leading-tight ${lead ? 'text-[17px] font-semibold' : 'text-[15px] font-medium'}`}>{row.r.name}</span>
                  <span className="truncate text-xs leading-tight text-muted-foreground">{place(row.r)}</span>
                </span>
                {cols.map(c => (
                  <StatCell
                    key={c.testid}
                    testid={c.testid}
                    cm={cmFor(d, c.key)}
                    max={scale}
                    units={units}
                    kind={c.key === 'forecast7d' ? 'forecast' : 'actual'}
                    estimated={(full ? c.key === 'actual72' : c.key !== 'forecast7d') && d.estimated}
                    active={sort === c.sort}
                    lead={lead}
                    full={full}
                  />
                ))}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function HeadButton({
  label, active, align, testid, onClick,
}: {
  label: string;
  active: boolean;
  align: 'start' | 'end';
  testid: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`-mx-1 min-h-8 rounded px-1 outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${align === 'end' ? 'justify-self-end text-right' : 'justify-self-start text-left'} ${active ? 'font-semibold text-foreground' : ''}`}
      aria-pressed={active}
      aria-label={`Rank by ${label.toLowerCase()}`}
      data-testid={testid}
      onClick={onClick}
    >
      {align === 'end' ? <span aria-hidden className={active ? '' : 'invisible'}>↓ </span> : null}
      {label}
      {align === 'start' && active ? <span aria-hidden> ↓</span> : null}
    </button>
  );
}

function StatCell({
  testid, cm, max, units, kind, estimated, active, lead, full,
}: {
  testid: string;
  cm: number;
  max: number;
  units: SnowUnits;
  kind: 'actual' | 'forecast';
  estimated: boolean;
  active: boolean;
  lead: boolean;
  full: boolean;
}) {
  const size = full ? (lead ? 'text-[1.6rem]' : 'text-[1.4rem]') : (lead ? 'text-[1.4rem]' : 'text-[1.25rem]');
  return (
    <span className="flex min-w-0 flex-col items-stretch gap-1" data-testid={testid} data-active={active ? '1' : '0'}>
      <span className="flex items-baseline justify-end gap-1">
        {estimated ? <span className="text-[10px] leading-none text-muted-foreground" data-testid="est-tag">est.</span> : null}
        <span className={`font-display tabular leading-none transition-colors ${size} ${active ? 'text-foreground' : 'text-foreground/55'}`}>
          {statNum(cm, units)}<Unit units={units} />
        </span>
      </span>
      <span className={`transition-opacity ${active ? '' : 'opacity-45'}`}>
        <SnowStake cm={cm} max={max} kind={kind} estimated={estimated} size="line" />
      </span>
    </span>
  );
}

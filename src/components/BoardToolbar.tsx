import { REGION_CHIPS } from '@/lib/design';
import { BOARD_SORTS, BOARD_SORT_HINT, type BoardSortId } from '@/lib/boardLayout';

const selectClass = 'h-8 max-w-[11rem] min-w-0 rounded-md border border-foreground/15 bg-transparent px-1.5 text-[11px]';

export function BoardToolbar({
  sort, onSort, regionId, regions, onRegion, observedOnly, onObservedOnly, updated,
}: {
  sort: BoardSortId;
  onSort: (s: BoardSortId) => void;
  regionId: string;
  regions: { id: string; name: string }[];
  onRegion: (id: string) => void;
  observedOnly: boolean;
  onObservedOnly: (on: boolean) => void;
  updated?: string | null;
}) {
  const chips = REGION_CHIPS.map(id => regions.find(r => r.id === id)).filter(Boolean) as { id: string; name: string }[];
  if (regionId && !chips.some(c => c.id === regionId)) {
    const extra = regions.find(r => r.id === regionId);
    if (extra) chips.unshift(extra);
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 pb-2" data-testid="board-toolbar">
      <p className="text-[11px] text-muted-foreground" data-testid="board-rank-hint">
        {BOARD_SORT_HINT[sort]}
      </p>
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>Sort</span>
        <select
          className={selectClass}
          value={sort}
          data-testid="board-sort"
          aria-label="Sort board"
          onChange={e => onSort(e.target.value as BoardSortId)}
        >
          {BOARD_SORTS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>Region</span>
        <select
          className={selectClass}
          value={regionId}
          data-testid="board-region"
          aria-label="Filter by region"
          onChange={e => onRegion(e.target.value)}
        >
          <option value="">All</option>
          {chips.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={`h-8 rounded-full px-2.5 text-[11px] ring-1 ring-foreground/15 ${observedOnly ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
        data-testid="observed-only"
        aria-pressed={observedOnly}
        onClick={() => onObservedOnly(!observedOnly)}
      >
        Observed
      </button>
      {updated ? (
        <p className="text-[11px] text-muted-foreground" data-testid="board-updated">{updated}</p>
      ) : null}
    </div>
  );
}

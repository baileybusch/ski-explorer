import { CheckIcon } from 'lucide-react';
import { REGION_CHIPS } from '@/lib/design';
import { BOARD_SORTS, BOARD_SORT_HINT, type BoardSortId } from '@/lib/boardLayout';

const selectClass = 'h-8 min-w-0 rounded-full border border-foreground/15 bg-background px-2.5 text-[13px] min-[840px]:h-9 min-[840px]:px-3 text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring';

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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-1 pb-3" data-testid="board-toolbar">
      <p className="sr-only" aria-live="polite" data-testid="board-rank-hint">{BOARD_SORT_HINT[sort]}</p>
      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>Rank by</span>
        <select
          className={selectClass}
          value={sort}
          data-testid="board-sort"
          aria-label="Rank by"
          onChange={e => onSort(e.target.value as BoardSortId)}
        >
          {BOARD_SORTS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      <select
        className={selectClass}
        value={regionId}
        data-testid="board-region"
        aria-label="Region"
        onChange={e => onRegion(e.target.value)}
      >
        <option value="">All regions</option>
        {chips.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <button
        type="button"
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] min-[840px]:h-9 min-[840px]:px-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${observedOnly ? 'border-foreground/60 text-foreground' : 'border-foreground/15 text-muted-foreground'}`}
        data-testid="observed-only"
        aria-pressed={observedOnly}
        title="Hide resorts whose last 72h is a model estimate"
        onClick={() => onObservedOnly(!observedOnly)}
      >
        {observedOnly ? <CheckIcon className="size-3.5" aria-hidden /> : null}
        Observed only
      </button>
      {updated ? (
        <p className="text-xs text-muted-foreground sm:ml-auto" data-testid="board-updated">{updated}</p>
      ) : null}
    </div>
  );
}

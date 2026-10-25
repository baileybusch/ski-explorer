import { SearchIcon, SparklesIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { SNOW_PRESETS } from '../../lib/snowWindow.js';
import { fmtShort } from '../../lib/util.js';
import { partyOf, tripDates } from '../../lib/trip.js';

export function BoardChrome({
  q, onOpenSearch, loading, pass, setPass, preset, setPreset, trip, win, onTrip, stormsOn,
}: {
  q: string;
  onOpenSearch: () => void;
  loading?: boolean;
  pass: string;
  setPass: (p: string) => void;
  preset: string;
  setPreset: (p: string) => void;
  trip: any;
  win: any;
  onTrip: () => void;
  stormsOn?: boolean;
}) {
  const { adults, kids } = partyOf(trip);
  const { start, end } = tripDates(trip, win || { start: '', end: '' });
  return (
    <header
      className="mx-auto flex w-full max-w-xl flex-col gap-2 px-3 pt-[max(0.55rem,env(safe-area-inset-top))]"
      data-testid="board-chrome"
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 shrink-0 rounded-full px-3 text-sm font-medium"
          onClick={onTrip}
          data-testid="trip-pill"
        >
          {adults}+{kids}  {start ? fmtShort(start) : 'dates'}–{end ? fmtShort(end).replace(/^[A-Za-z]+ /, '') : ''}
        </Button>
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3 text-left ring-1 ring-foreground/10"
          onClick={onOpenSearch}
          data-testid="search-trigger"
        >
          {loading ? <SparklesIcon className="size-4 shrink-0 animate-pulse" /> : <SearchIcon className="size-4 shrink-0 opacity-60" />}
          <span className="truncate text-sm text-muted-foreground">
            {q || 'Ask where the snow is'}
          </span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <ToggleGroup type="single" value={preset} onValueChange={v => v && setPreset(v)} className="min-w-0 flex-1">
          {SNOW_PRESETS.map(p => (
            <ToggleGroupItem key={p.id} value={p.id} className="min-h-11 flex-1 px-1 text-sm" data-testid={`window-${p.id}`}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup type="single" value={pass} onValueChange={v => v && setPass(v)} className="shrink-0">
          <ToggleGroupItem value="all" className="min-h-11 px-2.5 text-sm">All</ToggleGroupItem>
          <ToggleGroupItem value="ikon" className="min-h-11 px-2.5 text-sm">Ikon</ToggleGroupItem>
          <ToggleGroupItem value="epic" className="min-h-11 px-2.5 text-sm">Epic</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {stormsOn ? <p className="px-1 text-xs text-muted-foreground">Storms filter on — ranked by 72h pulse.</p> : null}
    </header>
  );
}

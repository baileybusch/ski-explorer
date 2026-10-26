import { useEffect, useState } from 'react';
import { MenuIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { SNOW_PRESETS } from '../../lib/snowWindow.js';
import { parseISO } from '../../lib/util.js';
import { partyOf, tripDates } from '../../lib/trip.js';
import { GHOSTS } from '@/lib/ghosts';

export function BoardChrome({
  q, onOpenSearch, onMenu, loading, preset, setPreset, trip, win, onTrip, stormsOn,
}: {
  q: string;
  onOpenSearch: () => void;
  onMenu: () => void;
  loading?: boolean;
  preset: string;
  setPreset: (p: string) => void;
  trip: any;
  win: any;
  onTrip: () => void;
  stormsOn?: boolean;
}) {
  const { adults, kids } = partyOf(trip);
  const { start, end } = tripDates(trip, win || { start: '', end: '' });
  const from = start ? parseISO(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'dates';
  const to = end ? String(parseISO(end).getDate()) : '';
  const [ghost, setGhost] = useState(0);
  useEffect(() => {
    if (q) return;
    const t = setInterval(() => setGhost(n => (n + 1) % GHOSTS.length), 3200);
    return () => clearInterval(t);
  }, [q]);

  return (
    <header
      className="flex w-full flex-col gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
      data-testid="board-chrome"
    >
      <div className="flex items-center gap-2">
        <ToggleGroup type="single" value={preset} onValueChange={v => v && setPreset(v)} className="min-w-0 flex-1">
          {SNOW_PRESETS.map(p => (
            <ToggleGroupItem key={p.id} value={p.id} className="min-h-11 flex-1 px-1 text-sm" data-testid={`window-${p.id}`}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 min-w-11 rounded-full"
          aria-label="Menu"
          data-testid="menu-button"
          onClick={onMenu}
        >
          <MenuIcon />
        </Button>
      </div>
      <button
        type="button"
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card px-4 text-left shadow-sm ring-1 ring-foreground/12"
        onClick={onOpenSearch}
        data-testid="search-trigger"
      >
        {loading ? <SparklesIcon className="size-5 shrink-0 animate-pulse" /> : <SearchIcon className="size-5 shrink-0 opacity-70" />}
        <span className="min-w-0 flex-1 truncate text-base text-muted-foreground">
          {q || GHOSTS[ghost]}
        </span>
      </button>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-10 shrink-0 rounded-full px-3 text-sm font-medium"
          onClick={onTrip}
          data-testid="trip-pill"
        >
          {adults}+{kids}&nbsp;&nbsp;{from}–{to}
        </Button>
        {stormsOn ? <p className="text-xs text-muted-foreground">Storms on — ranked by 72h pulse.</p> : null}
      </div>
    </header>
  );
}

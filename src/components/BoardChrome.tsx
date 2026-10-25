import { MoreHorizontalIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { SNOW_PRESETS } from '../../lib/snowWindow.js';
import { parseISO } from '../../lib/util.js';
import { partyOf, tripDates } from '../../lib/trip.js';

const PASS_CYCLE = ['ikon', 'epic', 'all'] as const;

export function BoardChrome({
  q, onOpenSearch, onSettings, loading, pass, setPass, preset, setPreset, trip, win, onTrip, stormsOn,
}: {
  q: string;
  onOpenSearch: () => void;
  onSettings: () => void;
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
  const from = start ? parseISO(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'dates';
  const to = end ? String(parseISO(end).getDate()) : '';
  const passLabel = pass === 'epic' ? 'Epic' : pass === 'all' ? 'All' : 'Ikon';
  const nextPass = PASS_CYCLE[(PASS_CYCLE.indexOf(pass as any) + 1) % PASS_CYCLE.length];
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
          {adults}+{kids}&nbsp;&nbsp;{from}–{to}
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
        <Button type="button" variant="ghost" className="min-h-11 min-w-11 rounded-full" aria-label="Settings" onClick={onSettings}>
          <MoreHorizontalIcon />
        </Button>
      </div>
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
          className="min-h-11 shrink-0 rounded-full px-3 text-sm"
          onClick={() => setPass(nextPass)}
          data-testid="pass-chip"
        >
          {passLabel}
        </Button>
      </div>
      {stormsOn ? <p className="px-1 text-xs text-muted-foreground">Storms filter on — ranked by 72h pulse.</p> : null}
    </header>
  );
}

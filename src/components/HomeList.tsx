import { ScrollArea } from '@/components/ui/scroll-area';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';
import { LocationCard } from '@/components/LocationCard';
import { ListFilters } from '@/components/ListFilters';
import { GHOSTS } from '@/lib/ghosts';

export function HomeList({
  mode, q, setQ, onSubmit, onSettings, onActivateSearch, onBackHome,
  loading, status, pass, setPass, stormsOn, setStormsOn,
  title, watched, rows, units, onOpen, onGhost,
}: {
  mode: 'home' | 'search';
  q: string;
  setQ: (v: string) => void;
  onSubmit: () => void;
  onSettings: () => void;
  onActivateSearch: () => void;
  onBackHome: () => void;
  loading?: boolean;
  status?: string;
  pass: string;
  setPass: (p: string) => void;
  stormsOn: boolean;
  setStormsOn: (on: boolean) => void;
  title: string;
  watched: { r: any; m: any; storm?: any; wx?: any }[];
  rows: { r: any; m: any; storm?: any; wx?: any }[];
  units: 'in' | 'cm';
  onOpen: (id: string) => void;
  onGhost: (text: string) => void;
}) {
  return (
    <div className="flex h-full min-h-dvh flex-col bg-background" data-testid={mode === 'search' ? 'search' : 'home'}>
      <header
        className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <SearchBar
          value={q}
          onChange={setQ}
          onSubmit={onSubmit}
          onSettings={onSettings}
          onActivate={onActivateSearch}
          loading={loading}
          status={status}
          autoFocus={mode === 'search'}
        />
        {mode === 'search' ? (
          <Button type="button" variant="ghost" className="min-h-11 self-start px-1 text-base" onClick={onBackHome}>
            Cancel
          </Button>
        ) : null}
        <ListFilters pass={pass} setPass={setPass} stormsOn={stormsOn} setStormsOn={setStormsOn} />
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {mode === 'search' && !q ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">Try asking</p>
              {GHOSTS.map(g => (
                <Button
                  key={g}
                  type="button"
                  variant="secondary"
                  className="min-h-12 justify-start text-left text-base font-normal whitespace-normal"
                  onClick={() => onGhost(g)}
                >
                  {g}
                </Button>
              ))}
            </div>
          ) : null}

          {mode === 'home' && watched.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">My Resorts</h2>
              {watched.map(row => (
                <LocationCard key={row.r.id} row={row} units={units} onOpen={onOpen} />
              ))}
            </section>
          ) : null}

          {mode === 'home' || (mode === 'search' && q) ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
              {rows.length ? rows.map(row => (
                <LocationCard key={row.r.id} row={row} units={units} onOpen={onOpen} />
              )) : (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>{stormsOn ? 'No storms at this threshold' : 'No matching resorts'}</EmptyTitle>
                    <EmptyDescription>
                      {stormsOn
                        ? 'Early season often has no 6″ pulse. Turn off Storms or open settings to lower the minimum.'
                        : 'Try Both passes or a different region.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

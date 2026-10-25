import { useEffect, useState } from 'react';
import { SearchIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { GHOSTS } from '@/lib/ghosts';
import { REGION_CHIPS } from '@/lib/design';

export function SearchOverlay({
  open, q, setQ, onSubmit, onClose, onGhost, onRegion, onClearScope, regions, stormsOn, setStormsOn, loading, status,
}: {
  open: boolean;
  q: string;
  setQ: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onGhost: (text: string) => void;
  onRegion: (id: string) => void;
  onClearScope: () => void;
  regions: { id: string; name: string }[];
  stormsOn: boolean;
  setStormsOn: (on: boolean) => void;
  loading?: boolean;
  status?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!open || q) return;
    const t = setInterval(() => setI(n => (n + 1) % GHOSTS.length), 3200);
    return () => clearInterval(t);
  }, [open, q]);

  if (!open) return null;
  const chips = REGION_CHIPS.map(id => regions.find(r => r.id === id)).filter(Boolean) as { id: string; name: string }[];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background" data-testid="search">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
          <InputGroup className="h-12 flex-1 rounded-full">
            <InputGroupAddon>
              {loading ? <SparklesIcon className="animate-pulse" /> : <SearchIcon />}
            </InputGroupAddon>
            <InputGroupInput
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={q ? '' : GHOSTS[i]}
              aria-label="Ask SkiScope"
              className="h-12 text-base"
              autoFocus
              autoComplete="off"
              enterKeyHint="search"
            />
          </InputGroup>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-base" onClick={onClose}>
            Cancel
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" onClick={onClearScope}>
            Worldwide
          </Button>
          {chips.map(g => (
            <Button
              key={g.id}
              type="button"
              variant="secondary"
              className="min-h-11 rounded-full px-3 text-sm"
              data-testid={`region-${g.id}`}
              onClick={() => onRegion(g.id)}
            >
              {g.name}
            </Button>
          ))}
          <Button
            type="button"
            variant={stormsOn ? 'default' : 'secondary'}
            className="min-h-11 rounded-full px-3 text-sm"
            data-testid="storms-chip"
            aria-pressed={stormsOn}
            onClick={() => setStormsOn(!stormsOn)}
          >
            Storms
          </Button>
        </div>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-8">
        <Command shouldFilter={false} className="mx-auto max-w-xl bg-transparent p-0">
          <CommandList className="max-h-none overflow-visible">
            <CommandGroup heading="Try asking">
              {GHOSTS.map(g => (
                <CommandItem
                  key={g}
                  value={g}
                  className="min-h-12 items-start whitespace-normal py-3 text-base"
                  onSelect={() => onGhost(g)}
                >
                  {g}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}

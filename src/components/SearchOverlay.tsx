import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { SearchIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { LogoMark } from '@/components/LogoMark';
import { GHOSTS } from '@/lib/ghosts';
import { REGION_CHIPS } from '@/lib/design';
import { fmtShort } from '../../lib/util.js';

export type SearchFacets = {
  regionId?: string | null;
  regionName?: string | null;
  resortId?: string | null;
  resortName?: string | null;
  from?: string | null;
  to?: string | null;
  people?: number | null;
  storms?: boolean;
};

/** Keep the focused search field from swallowing the tap on iPhone. */
function tapSafe(fn: () => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    },
  };
}

export function SearchOverlay({
  open, q, setQ, onSubmit, onClose, onHome, onGhost, onRegion, onResort, onClearScope,
  onClearFacet, onEditTrip, facets, regions, resorts = [], stormsOn, setStormsOn, loading, status, scoped,
  pass, setPass,
}: {
  open: boolean;
  q: string;
  setQ: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onHome: () => void;
  onGhost: (text: string) => void;
  onRegion: (id: string) => void;
  onResort: (id: string) => void;
  onClearScope: () => void;
  onClearFacet: (key: keyof SearchFacets) => void;
  onEditTrip: () => void;
  facets: SearchFacets;
  regions: { id: string; name: string }[];
  resorts?: { id: string; name: string; region?: string; country?: string }[];
  stormsOn: boolean;
  setStormsOn: (on: boolean) => void;
  loading?: boolean;
  status?: string;
  scoped?: boolean;
  pass?: string;
  setPass?: (p: string) => void;
}) {
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open || q) return;
    const t = setInterval(() => setI(n => (n + 1) % GHOSTS.length), 3200);
    return () => clearInterval(t);
  }, [open, q]);

  useEffect(() => {
    if (!open) return;
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    inputRef.current?.focus();
  }, [open]);

  if (!open) return null;
  const chips = REGION_CHIPS.map(id => regions.find(r => r.id === id)).filter(Boolean) as { id: string; name: string }[];
  const qn = q.trim().toLowerCase();
  const matches = qn
    ? resorts.filter(r => r.name.toLowerCase().includes(qn) || r.id.includes(qn)).slice(0, 8)
    : [];

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background" data-testid="search">
      <div className="relative z-20 mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-full px-1"
            aria-label="SkiScope home"
            data-testid="search-logo-home"
            {...tapSafe(onHome)}
          >
            <LogoMark className="size-8" />
            <span className="font-display text-xl tracking-wide">SKISCOPE</span>
          </button>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-base" data-testid="search-cancel" {...tapSafe(onClose)}>
            Cancel
          </Button>
        </div>
        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
          <InputGroup className="h-12 flex-1 rounded-full">
            <InputGroupAddon>
              {loading ? <SparklesIcon className="animate-pulse" /> : <SearchIcon />}
            </InputGroupAddon>
            <InputGroupInput
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={q ? '' : GHOSTS[i]}
              aria-label="Ask SkiScope"
              className="h-12 text-base"
              autoComplete="off"
              enterKeyHint="search"
            />
            {q ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  aria-label="Clear search"
                  data-testid="search-clear"
                  {...tapSafe(() => setQ(''))}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </form>
        {scoped ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 justify-start px-1 text-base"
            data-testid="search-back-to-all"
            {...tapSafe(onClearScope)}
          >
            Back to all resorts
          </Button>
        ) : null}
        <div className="relative z-20 flex flex-wrap gap-2" data-testid="search-chips">
          {setPass ? (
            <>
              <Button type="button" variant={pass === 'ikon' ? 'default' : 'outline'} className="min-h-11 rounded-full px-3 text-sm" data-testid="pass-ikon" {...tapSafe(() => setPass('ikon'))}>Ikon</Button>
              <Button type="button" variant={pass === 'epic' ? 'default' : 'outline'} className="min-h-11 rounded-full px-3 text-sm" data-testid="pass-epic" {...tapSafe(() => setPass('epic'))}>Epic</Button>
              <Button type="button" variant={pass === 'all' ? 'default' : 'outline'} className="min-h-11 rounded-full px-3 text-sm" data-testid="pass-all" {...tapSafe(() => setPass('all'))}>All</Button>
            </>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-3 text-sm" data-testid="chip-worldwide" {...tapSafe(onClearScope)}>
            Worldwide
          </Button>
          {chips.map(g => (
            <Button
              key={g.id}
              type="button"
              variant={facets.regionId === g.id ? 'default' : 'outline'}
              className="min-h-11 rounded-full px-3 text-sm"
              data-testid={`region-${g.id}`}
              {...tapSafe(() => onRegion(g.id))}
            >
              {g.name}
            </Button>
          ))}
          <Button
            type="button"
            variant={stormsOn ? 'default' : 'outline'}
            className="min-h-11 rounded-full px-3 text-sm"
            data-testid="storms-chip"
            aria-pressed={stormsOn}
            {...tapSafe(() => setStormsOn(!stormsOn))}
          >
            Storms
          </Button>
        </div>
        {(facets.regionName || facets.resortName || facets.from || facets.people || facets.storms) ? (
          <div className="relative z-20 flex flex-wrap gap-2" data-testid="parsed-chips">
            {facets.regionName ? (
              <Button type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" data-testid="facet-region" {...tapSafe(() => onClearFacet('regionId'))}>
                {facets.regionName} ×
              </Button>
            ) : null}
            {facets.resortName ? (
              <Button type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" data-testid="facet-resort" {...tapSafe(() => onClearFacet('resortId'))}>
                {facets.resortName} ×
              </Button>
            ) : null}
            {facets.from && facets.to ? (
              <Button type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" data-testid="facet-dates" {...tapSafe(onEditTrip)}>
                {fmtShort(facets.from)}–{fmtShort(facets.to)}
              </Button>
            ) : null}
            {facets.people ? (
              <Button type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" data-testid="facet-people" {...tapSafe(onEditTrip)}>
                {facets.people} people
              </Button>
            ) : null}
          </div>
        ) : null}
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {matches.length ? (
          <div className="relative z-20 flex flex-wrap gap-2" data-testid="result-chips">
            {matches.map(r => (
              <Button
                key={r.id}
                type="button"
                variant="outline"
                className="min-h-11 rounded-full px-3 text-sm"
                data-testid={`result-${r.id}`}
                {...tapSafe(() => onResort(r.id))}
              >
                {r.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-8">
        <div className="mx-auto max-w-xl">
          <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Try asking</p>
          <div className="flex flex-col gap-1">
            {GHOSTS.map(g => (
              <button
                key={g}
                type="button"
                className="min-h-12 rounded-xl px-3 py-3 text-left text-base hover:bg-muted"
                data-testid="ghost-chip"
                {...tapSafe(() => onGhost(g))}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

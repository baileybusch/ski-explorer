import { useEffect, useState } from 'react';
import { MenuIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND } from '@/lib/brand';
import { GHOSTS } from '@/lib/ghosts';
import { prefersReducedMotion } from '@/lib/motion';

function GhostPrompt({ paused }: { paused: boolean }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(GHOSTS[0]);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const t = window.setInterval(() => {
      setPhase('out');
      window.setTimeout(() => {
        setI(n => {
          const next = (n + 1) % GHOSTS.length;
          setShown(GHOSTS[next]);
          return next;
        });
        setPhase('in');
      }, 320);
    }, 3800);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <span
      className="ghost-prompt min-w-0 flex-1 truncate text-base text-muted-foreground"
      data-testid="search-ghost"
      data-ghost-index={i}
      data-ghost-phase={phase}
      aria-hidden={paused ? undefined : true}
    >
      <span data-state={phase}>{shown}</span>
    </span>
  );
}

export function BoardChrome({
  q, onOpenSearch, onMenu, onHome, onClearScope, scoped, loading, chip,
}: {
  q: string;
  onOpenSearch: () => void;
  onMenu: () => void;
  onHome: () => void;
  onClearScope: () => void;
  scoped?: boolean;
  loading?: boolean;
  chip?: string;
}) {
  return (
    <header
      className="mx-auto flex w-full flex-col gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] min-[840px]:px-6 min-[840px]:pt-4"
      data-testid="board-chrome"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 min-[840px]:grid-cols-[minmax(0,1fr)_minmax(0,34rem)_minmax(0,1fr)]">
        <button
          type="button"
          className="col-start-1 row-start-1 flex min-h-11 min-w-0 items-center gap-2 justify-self-start rounded-full px-1 text-left"
          aria-label={`${BRAND.name} home`}
          data-testid="logo-home"
          onClick={onHome}
        >
          <BrandLogo size="header" />
        </button>
        <button
          type="button"
          className="col-span-2 row-start-2 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-card px-4 text-left ring-1 ring-foreground/12 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring min-[840px]:col-span-1 min-[840px]:col-start-2 min-[840px]:row-start-1"
          onClick={onOpenSearch}
          data-testid="search-trigger"
        >
          {loading ? <SparklesIcon className="size-5 shrink-0 animate-pulse" /> : <SearchIcon className="size-5 shrink-0 opacity-70" />}
          {q ? (
            <span className="min-w-0 flex-1 truncate text-base text-muted-foreground">{q}</span>
          ) : (
            <GhostPrompt paused={!!q} />
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          className="col-start-2 row-start-1 min-h-11 min-w-11 justify-self-end rounded-full min-[840px]:col-start-3"
          aria-label="Menu"
          data-testid="menu-button"
          onClick={onMenu}
        >
          <MenuIcon />
        </Button>
      </div>
      {chip ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="intent-chip">
          <span className="rounded-full bg-card px-3 py-1.5 text-sm ring-1 ring-foreground/12">{chip}</span>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-sm" data-testid="intent-clear" onClick={onClearScope}>
            Clear
          </Button>
        </div>
      ) : null}
      {scoped ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 justify-start px-1 text-base"
          data-testid="back-to-all"
          onClick={onClearScope}
        >
          Back to all resorts
        </Button>
      ) : null}
    </header>
  );
}

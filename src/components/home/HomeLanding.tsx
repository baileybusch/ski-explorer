import { useRef, useState } from 'react';
import { MenuIcon, SnowflakeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { FullList, TrendingCards } from '@/components/home/TrendingCards';
import { AgentChat } from '@/components/home/AgentChat';
import { SiteFooter } from '@/components/SiteFooter';
import { BOARD_LAYOUT } from '@/lib/boardLayout';
import type { SnowUnits } from '@/lib/format';
import type { RankOutput } from '@/lib/askTypes';

/** Thought-starter cards shown by default; "See all" expands the rest inline. */
const TOP = 3;
const INLINE_MAX = 25;

export function HomeLanding({
  catalog, units, rows, onOpen, onShowBoard, onMenu, onBoard, pass,
}: {
  catalog: any;
  units: SnowUnits;
  rows: { r: any; dump?: any }[];
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  onMenu: () => void;
  onBoard: () => void;
  pass: 'ikon' | 'epic' | 'all';
}) {
  const [ask, setAsk] = useState<{ text: string; n: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const top = rows.slice(0, TOP);
  const rest = rows.slice(TOP, INLINE_MAX);

  // Card click = ask the chat about that resort (chat is the focus).
  function askAbout(r: { id: string; name: string }) {
    setAsk({ text: `How's ${r.name} looking?`, n: Date.now() });
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col" style={{ maxWidth: BOARD_LAYOUT.maxWidth }} data-testid="home-agent">
      <header className="flex items-center justify-between gap-3 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 min-[840px]:px-6 min-[840px]:pt-4">
        <BrandLogo size="header" />
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="min-h-11 rounded-full px-3 text-sm" data-testid="home-open-board" onClick={onBoard}>
            Board
          </Button>
          <Button type="button" variant="ghost" className="min-h-11 min-w-11 rounded-full" aria-label="Menu" data-testid="menu-button" onClick={onMenu}>
            <MenuIcon />
          </Button>
        </div>
      </header>
      {/* One centered column for everything (Claude-style), ~840px on desktop. */}
      <div className="mx-auto flex w-full max-w-[840px] flex-1 flex-col px-3 pb-8 min-[880px]:px-0" data-testid="home-column">
        <div ref={chatRef} className="scroll-mt-3 pt-6 min-[720px]:pt-[9vh]" data-testid="home-chat-column">
          <h1 className="mb-6 flex items-center justify-center gap-2.5 text-center font-display text-[2rem] leading-none min-[720px]:mb-7 min-[720px]:text-[2.6rem]" data-testid="home-chat-heading">
            <SnowflakeIcon className="size-6 text-[var(--ice)] min-[720px]:size-8" aria-hidden strokeWidth={2.25} />
            Where&rsquo;s the snow good?
          </h1>
          <AgentChat
            units={units}
            catalog={catalog}
            onOpen={onOpen}
            onShowBoard={onShowBoard}
            board={{ pass, regionId: null, observedOnly: false }}
            externalAsk={ask}
            topNames={top.map(x => x.r.name)}
          />
        </div>
        <section className="mt-12 flex flex-col gap-3 min-[720px]:mt-20" data-testid="home-starters">
          <div className="flex items-baseline justify-between gap-3 px-0.5">
            <h2 className="text-sm text-muted-foreground">Trending mountains</h2>
            {rows.length > TOP ? (
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                data-testid="home-see-all"
                aria-expanded={expanded}
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? 'Show less' : 'See all'}
              </button>
            ) : null}
          </div>
          <TrendingCards rows={top} units={units} snow={catalog.snow} onAsk={askAbout} />
          {expanded ? (
            <>
              <FullList rows={rest} start={TOP} units={units} snow={catalog.snow} onAsk={askAbout} />
              <Button type="button" variant="ghost" className="min-h-11 self-start rounded-full px-3 text-sm" data-testid="home-full-board" onClick={onBoard}>
                Open the full board ({rows.length} mountains)
              </Button>
            </>
          ) : null}
        </section>
        <div className="mt-12">
        <SiteFooter />
        </div>
      </div>
    </div>
  );
}

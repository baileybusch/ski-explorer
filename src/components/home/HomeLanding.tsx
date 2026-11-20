import { useEffect, useRef, useState } from 'react';
import { SnowflakeIcon } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { FullList, TrendingCards } from '@/components/home/TrendingCards';
import { AgentChat } from '@/components/home/AgentChat';
import { RegionTiles, RegionView } from '@/components/home/RegionView';
import { explorePath, parseExplorePath } from '../../../lib/homeRegions.js';
import { SiteFooter } from '@/components/SiteFooter';
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
  const [regionId, setRegionId] = useState<string | null>(() => parseExplorePath(location.pathname));
  const region = regionId ? (catalog.regions || []).find((g: any) => g.id === regionId) : null;
  const top = rows.slice(0, TOP);

  // Region view lives at /explore/<id>; back/forward re-syncs from the path.
  useEffect(() => {
    const onPop = () => setRegionId(parseExplorePath(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (region) document.title = `${region.name} snow · ask SkiScope`;
  }, [region]);

  function openRegion(id: string) {
    history.pushState({ ss: 'home', region: id }, '', explorePath(id) + location.search);
    setRegionId(id);
    window.scrollTo({ top: 0 });
  }
  function closeRegion() {
    if (history.state?.region) history.back();
    else {
      history.replaceState({ ss: 'home' }, '', '/' + location.search);
      setRegionId(null);
    }
  }
  const rest = rows.slice(TOP, INLINE_MAX);

  // Card click = ask the chat about that resort (chat is the focus).
  function askAbout(r: { id: string; name: string }) {
    setAsk({ text: `How's ${r.name} looking?`, n: Date.now() });
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex min-h-dvh w-full flex-col" data-testid="home-agent">
      <AppHeader active={region ? 'resorts' : 'home'} onHome={() => (region ? closeRegion() : document.querySelector('[data-testid="home-agent"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))} onResorts={onBoard} onMenu={onMenu} />
      {region ? (
        <>
          <RegionView region={region} catalog={catalog} units={units} onOpen={onOpen} onShowBoard={onShowBoard} onBack={closeRegion} />
          <SiteFooter />
        </>
      ) : (
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
        <RegionTiles catalog={catalog} units={units} onPick={openRegion} />
        <div className="mt-6">
        <SiteFooter />
        </div>
      </div>
      )}
    </div>
  );
}

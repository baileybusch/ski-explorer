import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { TrendingCards } from '@/components/home/TrendingCards';
import { AgentChat } from '@/components/home/AgentChat';
import { SiteFooter } from '@/components/SiteFooter';
import { BOARD_LAYOUT } from '@/lib/boardLayout';
import type { SnowUnits } from '@/lib/format';
import type { RankOutput } from '@/lib/askTypes';

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
      <div className="flex flex-1 flex-col gap-4 px-3 pb-8 min-[840px]:gap-6 min-[840px]:px-6">
        <TrendingCards rows={rows.slice(0, 2)} units={units} snow={catalog.snow} onOpen={onOpen} />
        <AgentChat
          units={units}
          catalog={catalog}
          onOpen={onOpen}
          onShowBoard={onShowBoard}
          board={{ pass, regionId: null, observedOnly: false }}
        />
        <SiteFooter />
      </div>
    </div>
  );
}

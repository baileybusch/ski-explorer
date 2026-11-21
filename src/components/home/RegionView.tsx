import { useMemo, useState } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { ChatDock } from '@/components/ChatDock';
import { AgentChat } from '@/components/home/AgentChat';
import { FullList } from '@/components/home/TrendingCards';
import { ResortPeek } from '@/components/ResortPeek';
import { snowAmount, type SnowUnits } from '@/lib/format';
import { useMediaQuery } from '@/lib/useMediaQuery';
import type { RankOutput } from '@/lib/askTypes';
import { withAlerts } from '@/lib/alertsUi';
import { HOME_REGIONS, regionRows, regionTiles } from '../../../lib/homeRegions.js';
import { categoryPath } from '../../../lib/categoryPages.js';

/** "Browse by region" tiles under the trending cards. */
export function RegionTiles({
  catalog, units, onPick,
}: {
  catalog: any;
  units: SnowUnits;
  onPick: (id: string) => void;
}) {
  const tiles = useMemo(() => regionTiles(catalog, HOME_REGIONS), [catalog]);
  if (!tiles.length) return null;
  return (
    <section className="mt-10 flex flex-col gap-3" data-testid="home-regions">
      <h2 className="px-0.5 text-sm text-muted-foreground">Browse by region</h2>
      <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4 min-[640px]:gap-3">
        {tiles.map((t: any) => (
          <button
            key={t.id}
            type="button"
            className="flex min-h-[4.25rem] flex-col justify-between gap-1 rounded-xl border border-[var(--surface-line)] bg-card px-3 py-2.5 text-left outline-offset-2 transition-colors hover:border-[var(--ice)]/45 hover:bg-[var(--surface-raised)] focus-visible:outline-2 focus-visible:outline-ring"
            data-testid="home-region-tile"
            data-region={t.id}
            aria-label={`${t.name}: ${t.count} resorts, top ${snowAmount(t.topCm, units)} in the last 72 hours`}
            onClick={() => onPick(t.id)}
          >
            <span className="truncate text-[15px] font-medium leading-tight">{t.label}</span>
            <span className="truncate text-xs text-muted-foreground" data-testid="home-region-stat">
              {t.count} resorts{t.topCm != null && t.topCm > 0 ? ` · top ${snowAmount(t.topCm, units)}${t.estimated ? ' est.' : ''}` : ''}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Region view (/explore/<id>): that region's resorts with a region-scoped chat.
 * Desktop: chat in a sticky side panel. Mobile: sticky "Ask about <region>" bar
 * opens the chat full screen. Row tap shows that resort's data with prompts (no agent call until one is tapped).
 */
export function RegionView({
  region, catalog, units, onOpen, onShowBoard, onBack,
}: {
  region: any;
  catalog: any;
  units: SnowUnits;
  onOpen: (id: string) => void;
  onShowBoard: (out: RankOutput) => void;
  onBack: () => void;
}) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const rows = useMemo(() => regionRows(region, catalog), [region, catalog]);
  const [ask, setAsk] = useState<{ text: string; n: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const scope = useMemo(() => ({ id: region.id, name: region.name, topName: rows[0]?.r.name || null }), [region, rows]);
  const [peek, setPeek] = useState<string | null>(null);
  const peekResort = peek ? (catalog.resorts || []).find((x: any) => x.id === peek) || null : null;
  // Row tap shows that mountain's data first; the agent is asked only when a prompt is tapped.
  function askAbout(r: { id: string; name: string }) {
    setPeek(r.id);
    if (!wide) setChatOpen(true);
  }
  function send(text: string) {
    setPeek(null);
    setAsk({ text, n: Date.now() });
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-3 pb-24 min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,1fr)_400px] min-[1024px]:gap-8 min-[1024px]:px-6 min-[1024px]:pb-10" data-testid="region-view" data-region={region.id}>
      <div className="min-w-0">
        <button type="button" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="region-back" onClick={onBack}>
          <ArrowLeftIcon className="size-4" /> All regions
        </button>
        <h1 className="mt-1 font-display text-[2rem] leading-none min-[720px]:text-[2.4rem]" data-testid="region-heading">{region.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="region-summary">
          {rows.length} resorts · most new snow first · tap one for its snow
        </p>
        <div className="mt-5">
          {rows.length ? (
            <FullList rows={rows} units={units} snow={catalog.snow} onAsk={askAbout} />
          ) : (
            <p className="text-sm text-muted-foreground">No mapped resorts in this region yet.</p>
          )}
        </div>
        <a href={withAlerts(categoryPath('region', region.id))} className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--link)] underline-offset-4 hover:underline" data-testid="region-full-board">
          Open {region.name} on the full board
        </a>
      </div>

      {/* One chat instance: docked panel on desktop, sheet under the header on mobile. */}
      <ChatDock
        wide={wide}
        open={chatOpen}
        onOpenChange={setChatOpen}
        title={`Ask about ${region.name}`}
        subtitle={`${rows.length} resorts · live snow`}
        barLabel={`Ask about ${region.name}…`}
        className="sticky top-[calc(var(--app-header-h)+1rem)] mt-4 h-[calc(100dvh-var(--app-header-h)-2rem)] self-start"
        testid="region-chat"
        barTestid="region-chat-bar"
        closeTestid="region-chat-close"
      >
        {peekResort ? (
          <ResortPeek
            key={peekResort.id}
            resort={peekResort}
            snow={catalog.snow}
            units={units}
            onAsk={send}
            onOpen={onOpen}
            onClose={() => setPeek(null)}
            className="min-h-0 flex-1"
            showInput
          />
        ) : null}
        <div className={peekResort ? 'hidden' : 'contents'} data-testid="region-chat-thread">
        <AgentChat
          key={region.id}
          layout="panel"
          units={units}
          catalog={catalog}
          onOpen={onOpen}
          onShowBoard={onShowBoard}
          board={{ pass: 'all', regionId: region.id, observedOnly: false }}
          externalAsk={ask}
          topNames={rows.slice(0, 3).map(x => x.r.name)}
          scope={scope}
        />
        </div>
      </ChatDock>
    </div>
  );
}

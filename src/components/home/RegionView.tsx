import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, MessageCircleIcon, XIcon } from 'lucide-react';
import { AgentChat } from '@/components/home/AgentChat';
import { FullList } from '@/components/home/TrendingCards';
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
            className="flex min-h-[4.25rem] flex-col justify-between gap-1 rounded-xl bg-card px-3 py-2.5 text-left ring-1 ring-foreground/12 outline-offset-2 transition-shadow hover:ring-foreground/25 focus-visible:outline-2 focus-visible:outline-ring"
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
 * opens the chat full screen. Rows ask the chat about that resort.
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
  const sheet = !wide && chatOpen;

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setChatOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [sheet]);

  function askAbout(r: { id: string; name: string }) {
    setAsk({ text: `How's ${r.name} looking?`, n: Date.now() });
    if (!wide) setChatOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-3 pb-24 min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,1fr)_400px] min-[1024px]:gap-8 min-[1024px]:px-6 min-[1024px]:pb-10" data-testid="region-view" data-region={region.id}>
      <div className="min-w-0">
        <button type="button" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="region-back" onClick={onBack}>
          <ArrowLeftIcon className="size-4" /> All regions
        </button>
        <h1 className="mt-1 font-display text-[2rem] leading-none min-[720px]:text-[2.4rem]" data-testid="region-heading">{region.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="region-summary">
          {rows.length} resorts · most new snow first · tap one to ask about it
        </p>
        <div className="mt-5">
          {rows.length ? (
            <FullList rows={rows} units={units} snow={catalog.snow} onAsk={askAbout} />
          ) : (
            <p className="text-sm text-muted-foreground">No mapped resorts in this region yet.</p>
          )}
        </div>
        <a href={withAlerts(categoryPath('region', region.id))} className="mt-4 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" data-testid="region-full-board">
          Open {region.name} on the full board
        </a>
      </div>

      {/* One chat instance: side panel on desktop, full-screen sheet on mobile. */}
      <aside
        className={wide
          ? 'sticky top-4 mt-4 flex max-h-[calc(100dvh-2rem)] flex-col self-start overflow-y-auto'
          : sheet
            ? 'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]'
            : 'hidden'}
        data-testid="region-chat"
        data-open={wide || sheet ? '1' : '0'}
        aria-label={`Chat about ${region.name}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm text-muted-foreground">Ask about {region.name}</h2>
          {!wide ? (
            <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-foreground/5" aria-label="Close chat" data-testid="region-chat-close" onClick={() => setChatOpen(false)}>
              <XIcon className="size-5" />
            </button>
          ) : null}
        </div>
        <AgentChat
          key={region.id}
          units={units}
          catalog={catalog}
          onOpen={onOpen}
          onShowBoard={onShowBoard}
          board={{ pass: 'all', regionId: region.id, observedOnly: false }}
          externalAsk={ask}
          topNames={rows.slice(0, 3).map(x => x.r.name)}
          scope={scope}
        />
      </aside>

      {!wide && !chatOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background/95 to-transparent">
          <button
            type="button"
            className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-card px-4 text-left text-[15px] text-muted-foreground shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] ring-1 ring-foreground/15"
            data-testid="region-chat-bar"
            onClick={() => setChatOpen(true)}
          >
            <MessageCircleIcon className="size-4 shrink-0" />
            <span className="truncate">Ask about {region.name}…</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

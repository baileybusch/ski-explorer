import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardChrome } from '@/components/BoardChrome';
import { BlockBoard } from '@/components/BlockBoard';
import type { RankOutput } from '@/lib/askTypes';
import { TripOnboarding } from '@/components/TripOnboarding';
import { SettingsSheet } from '@/components/SettingsSheet';
import { PlanDialog } from '@/components/PlanDialog';
import { MapLayers } from '@/components/MapLayers';
import { ResortProfile } from '@/components/ResortProfile';
import { GlobeMap, type GlobeHandle, type MapLayout } from '@/components/GlobeMap';
import { loadCatalog } from '@/lib/catalog';
import { watchlist } from '@/lib/watchlist';
import { loadTrip, saveTrip, tripDates, partyOf, buildPlan, planHandoffLinks } from '../lib/trip.js';
import { parseTripQuery, shareSearch } from '../lib/links.js';
import { defaultWindow, forecastEnd, windowMetrics, presetWindow } from '../lib/snowWindow.js';
import { fmtShort } from '../lib/util.js';
import { toast } from 'sonner';
import { stormForResort } from '../lib/storms.js';
import { fetchListWeather } from '../lib/weather.js';
import { fetchNwsWinterAlerts } from '@/lib/nwsAlerts';
import { BOARD_MORE, BOARD_PAGE, dumpParts, rankBoard, regionResortIds } from '@/lib/board';
import { BOARD_LAYOUT, isBoardSort, type BoardSortId } from '@/lib/boardLayout';
import { AlertOnboarding, type AlertContext } from '@/components/AlertOnboarding';
import { HomeSignup } from '@/components/HomeSignup';
import { CategoryFooterCta, CategoryHeader } from '@/components/CategoryHeader';
import { PASS_PAGES, categoryMeta, categoryName, categoryPath, ctaLabel as categoryCta, parseCategoryPath } from '../lib/categoryPages.js';
import { ContextCta } from '@/components/ContextCta';
import { SiteFooter } from '@/components/SiteFooter';
import { intentChip, ctaKind } from '../lib/intent.js';
import { type LocalRule } from '@/lib/alertRules';
import { alertsUiState } from '@/lib/alertsUi';
import { BRAND, brandParams } from '@/lib/brand';
import { snowAmount } from '@/lib/format';
import type { SnowUnits, TempUnits } from '@/lib/format';
import { useMediaQuery } from '@/lib/useMediaQuery';

const AskPanel = lazy(() => import('@/components/ask/AskPanel').then(m => ({ default: m.AskPanel })));

const PASSES = ['all', 'ikon', 'epic'] as const;
const ASK_DOCK_MIN = 1100;
type View = 'board' | 'profile' | 'map';

type SearchFacets = {
  regionId?: string | null;
  regionName?: string | null;
  resortId?: string | null;
  resortName?: string | null;
  from?: string | null;
  to?: string | null;
  people?: number | null;
  storms?: boolean;
};

const ASK_TO_BOARD_SORT: Record<RankOutput['sort'], BoardSortId> = {
  actual72h: 'actual72',
  actual24h: 'actual24',
  forecast7d: 'forecast7d',
};

type Landing = { kind: 'region' | 'pass'; id: string } | null;

function initialPass() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get('pass');
  if (PASSES.includes(q as any)) return q as typeof PASSES[number];
  const landing = parseCategoryPath(location.pathname);
  if (landing?.kind === 'pass') return landing.id as typeof PASSES[number];
  if (landing?.kind === 'region') return 'all';
  const stored = localStorage.getItem('ss_pass');
  if (PASSES.includes(stored as any)) return stored as typeof PASSES[number];
  return 'ikon';
}

export default function App() {
  const globe = useRef<GlobeHandle>(null);
  const boardScroll = useRef<HTMLDivElement | null>(null);
  const savedBoardTop = useRef(0);
  const [catalog, setCatalog] = useState<any>(null);
  const [view, setView] = useState<View>('board');
  const [pass, setPass] = useState(initialPass);
  const [trip, setTrip] = useState(() => loadTrip());
  const [win, setWin] = useState<any>(null);
  const [units, setUnits] = useState<SnowUnits>((localStorage.getItem('ss_units') as SnowUnits) || 'in');
  const [tempUnits, setTempUnits] = useState<TempUnits>((localStorage.getItem('ss_temp') as TempUnits) || 'F');
  const [lodgingOn, setLodgingOn] = useState(false);
  const [radarOn, setRadarOn] = useState(false);
  const [cloudsOn, setCloudsOn] = useState(false);
  const [stormsOn, setStormsOn] = useState(false);
  const [stormsLayerOn, setStormsLayerOn] = useState(false);
  const [nwsOn, setNwsOn] = useState(false);
  const [stormMin, setStormMin] = useState(6);
  const [nwsGeo, setNwsGeo] = useState<any>(null);
  const [wxById, setWxById] = useState<Record<string, any>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastAsk, setLastAsk] = useState('');
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);
  const [askMounted, setAskMounted] = useState(false);
  const [askFocus, setAskFocus] = useState(0);
  const wide = useMediaQuery(`(min-width: ${ASK_DOCK_MIN}px)`);
  const [activeIds, setActiveIds] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planText, setPlanText] = useState('');
  const [planLinks, setPlanLinks] = useState<{ chatgpt?: string; grok?: string }>({});
  const [watchTick, setWatchTick] = useState(0);
  const [heroParallax, setHeroParallax] = useState(0);
  const [restoreTop, setRestoreTop] = useState(0);
  const [shown, setShown] = useState(BOARD_PAGE);
  const [alertsUi] = useState(() => alertsUiState());
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertCtx, setAlertCtx] = useState<AlertContext>({ source: 'menu', pass });
  const [editRule, setEditRule] = useState<LocalRule | null>(null);
  const [facets, setFacets] = useState<SearchFacets>({});
  const [landing, setLanding] = useState<Landing>(() => parseCategoryPath(location.pathname) as Landing);
  const [parsedIntent, setParsedIntent] = useState<any>(null);
  const [boardSort, setBoardSort] = useState<BoardSortId>(() => {
    const stored = localStorage.getItem('ss_board_sort');
    return isBoardSort(stored) ? stored : 'actual72';
  });
  const [observedOnly, setObservedOnly] = useState(() => localStorage.getItem('ss_obs') === '1');

  const scoped = !!(activeIds || stormsOn || facets.regionId || facets.resortId);

  useEffect(() => {
    loadCatalog().then(c => {
      setCatalog(c);
      let nextWin = defaultWindow(c.snow);
      let nextTrip = { ...trip };
      const deep = parseTripQuery(location.search);
      if (deep.from && deep.to) {
        const last = forecastEnd(c.snow);
        nextWin = {
          mode: 'custom', start: deep.from, end: deep.to,
          label: deep.from > last ? `typical ${fmtShort(deep.from)}–${fmtShort(deep.to)}` : `${fmtShort(deep.from)}–${fmtShort(deep.to)}`,
          usedTypicalOnly: deep.from > last,
        };
        nextTrip.start = deep.from;
        nextTrip.end = deep.to;
      }
      if (deep.home) nextTrip.home = deep.home;
      if (deep.adults != null) nextTrip.adults = deep.adults;
      if (deep.kids != null) nextTrip.kids = deep.kids;
      setTrip(nextTrip);
      saveTrip(nextTrip);
      setWin(nextWin);
      if (deep.resort) {
        setSelectedId(deep.resort);
        setView('profile');
        setTimeout(() => {
          const r = c.resorts.find((x: any) => x.id === deep.resort);
          if (r) globe.current?.flyResort(r);
          if (deep.mode === 'plan' && r) openPlan([r], nextWin, nextTrip, c);
        }, 400);
      } else if (landing?.kind === 'region') {
        const g = c.regions.find((x: any) => x.id === landing.id);
        if (g) applyRegion(g, c, pass, { push: false });
        else setLanding(null);
      } else if (deep.q) {
        const g = c.regions.find((x: any) => x.id === deep.q || x.name.toLowerCase() === deep.q.toLowerCase());
        if (g) applyRegion(g, c, pass, { push: false });
      }
      const askParam = new URLSearchParams(location.search).get('ask');
      if (askParam && !deep.resort) {
        setAskRequest({ text: askParam.slice(0, 400), n: Date.now() });
        setSearchOpen(true);
      }
    }).catch(err => toast(`Could not load resorts: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { saveTrip(trip); }, [trip]);
  useEffect(() => { localStorage.setItem('ss_pass', pass); }, [pass]);
  useEffect(() => { localStorage.setItem('ss_units', units); }, [units]);
  useEffect(() => { localStorage.setItem('ss_temp', tempUnits); }, [tempUnits]);

  useEffect(() => {
    if (!catalog) return;
    setWin(w => (w?.mode === 'custom' ? w : defaultWindow(catalog.snow)));
  }, [catalog]);

  function setCustomDates(start: string, end: string) {
    if (!catalog || !start || !end) return;
    const last = forecastEnd(catalog.snow);
    const typicalOnly = start > last;
    const next = {
      mode: 'custom', start, end,
      label: typicalOnly ? `typical ${fmtShort(start)}–${fmtShort(end)}` : `${fmtShort(start)}–${fmtShort(end)}`,
      usedTypicalOnly: typicalOnly,
    };
    setWin(next);
    setTrip(t => ({ ...t, start, end }));
    setFacets(f => ({ ...f, from: start, to: end }));
  }

  /** Category pages keep a clean shareable path while the board's region / pass match them. */
  function boardPath(region: string | null | undefined, p = pass) {
    if (landing?.kind === 'region') return region ? categoryPath('region', region) : '/';
    if (landing?.kind === 'pass') return p === landing.id && !region ? categoryPath('pass', p) : '/';
    return location.pathname;
  }

  function writeURL(extra: any = {}) {
    if (!win) return;
    const { start, end } = tripDates(trip, win);
    const { adults, kids } = partyOf(trip);
    const kind = extra.ss
      || (extra.resort ?? selectedId ? 'profile' : (extra.region || activeIds ? 'filter' : 'board'));
    const region = 'region' in extra ? extra.region : facets.regionId;
    const path = boardPath(region);
    const onCategory = path.startsWith('/region/') || path.startsWith('/pass/');
    history.replaceState({ ...(history.state || {}), ss: kind, top: savedBoardTop.current }, '', path + shareSearch({
      resort: extra.resort ?? selectedId,
      from: start, to: end, adults, kids, home: trip.home,
      mode: extra.mode,
      pass: path.startsWith('/pass/') ? undefined : pass,
      region: onCategory ? undefined : extra.region ?? facets.regionId,
      alerts: alertsUi.mode === 'preview' ? '1' : undefined,
      ...Object.fromEntries(brandParams()),
    }));
  }

  useEffect(() => { if (win) writeURL(); }, [pass, win, trip, selectedId, facets.regionId, landing]);

  useEffect(() => {
    if (!landing || !catalog) return;
    if (landing.kind === 'region' && facets.regionId !== landing.id) {
      setLanding(facets.regionId ? { kind: 'region', id: facets.regionId } : null);
    }
    if (landing.kind === 'pass' && pass !== landing.id) {
      setLanding(PASS_PAGES[pass as keyof typeof PASS_PAGES] ? { kind: 'pass', id: pass } : null);
    }
  }, [landing, catalog, facets.regionId, pass]);

  const landingName = catalog && landing ? categoryName(landing, catalog.regions) : null;
  const landingMeta = landing && landingName ? categoryMeta(landing, { name: landingName, brand: BRAND.name }) : null;
  useEffect(() => {
    document.title = landingMeta && view === 'board' ? landingMeta.title : BRAND.title;
  }, [landingMeta?.title, view]);

  function rememberBoard() {
    savedBoardTop.current = boardScroll.current?.scrollTop || 0;
    setRestoreTop(savedBoardTop.current);
  }

  function pushScope(kind: 'filter' | 'profile' | 'board') {
    rememberBoard();
    history.pushState({ ss: kind, top: savedBoardTop.current }, '');
  }

  function applyRegion(g: any, cat = catalog, p = pass, opts: { push?: boolean } = {}) {
    if (!g || !cat) return;
    if (opts.push !== false) pushScope('filter');
    setActiveIds(regionResortIds(cat.resorts, g, p));
    setSelectedId(null);
    setSearchOpen(false);
    setMenuOpen(false);
    setView('board');
    setFacets(f => ({ ...f, regionId: g.id, regionName: g.name, resortId: null, resortName: null }));
    globe.current?.flyRegion(g);
    writeURL({ resort: null, region: g.id, ss: 'filter' });
  }

  function openPlan(resorts: any[], w = win, t = trip, cat = catalog) {
    if (!cat || !w) return;
    const snowLabel: Record<string, string> = {};
    for (const r of resorts) {
      const m = windowMetrics(r, cat.snow, w, cat.typical);
      snowLabel[r.id] = m.usedTypical && !m.usedForecast
        ? `typical (not a forecast)`
        : `outlook + recent`;
    }
    const text = buildPlan({ resorts, win: w, trip: t, snowLabel });
    setPlanText(text);
    setPlanLinks(planHandoffLinks(text));
    setPlanOpen(true);
  }

  function openResort(id: string, mode: 'explore' | 'plan' = 'explore') {
    pushScope('profile');
    setSelectedId(id);
    setHeroParallax(0);
    setView('profile');
    setSearchOpen(false);
    const r = catalog?.resorts.find((x: any) => x.id === id);
    if (r) setTimeout(() => globe.current?.flyResort(r), 80);
    writeURL({ resort: id, mode, ss: 'profile' });
    if (mode === 'plan' && r) openPlan([r]);
  }

  function backToBoard() {
    setView('board');
    setHeroParallax(0);
    setSelectedId(null);
    writeURL({ resort: null, ss: activeIds ? 'filter' : 'board' });
    setRestoreTop(savedBoardTop.current);
  }

  function resetHome() {
    rememberBoard();
    if (landing) {
      setLanding(null);
      history.replaceState(history.state, '', '/' + location.search);
    }
    setActiveIds(null);
    setStormsOn(false);
    setSearchOpen(false);
    setSelectedId(null);
    setFacets({});
    setParsedIntent(null);
    setView('board');
    if (catalog) setWin(presetWindow(catalog.snow, 'fc7'));
    writeURL({ resort: null, region: null, ss: 'board' });
    setRestoreTop(0);
    requestAnimationFrame(() => {
      if (boardScroll.current) boardScroll.current.scrollTop = 0;
    });
  }

  function showOnBoard(out: RankOutput) {
    if (!catalog) return;
    const nextPass = (out.pass as typeof PASSES[number]) || 'all';
    if (nextPass !== pass) setPass(nextPass);
    setBoardSort(ASK_TO_BOARD_SORT[out.sort] || 'actual72');
    setObservedOnly(!!out.observedOnly);
    setStormsOn(false);
    const g = out.regionId ? catalog.regions.find((x: any) => x.id === out.regionId) : null;
    if (g) {
      applyRegion(g, catalog, nextPass);
      setParsedIntent({
        type: 'region', q: lastAsk, region: { id: g.id, name: g.name },
        metric: out.sort === 'forecast7d' ? 'next7' : 'past72',
      });
    } else {
      setActiveIds(null);
      setFacets({});
      setParsedIntent(null);
      setSearchOpen(false);
      setSelectedId(null);
      setView('board');
      writeURL({ resort: null, region: null, ss: 'board' });
    }
    requestAnimationFrame(() => {
      if (boardScroll.current) boardScroll.current.scrollTop = 0;
    });
  }

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const kind = e.state?.ss;
      setSearchOpen(false);
      if (kind === 'profile') return;
      if (view === 'profile' || kind === 'filter') {
        setView('board');
        setSelectedId(null);
        setHeroParallax(0);
        if (kind !== 'filter') {
          setActiveIds(null);
          setStormsOn(false);
          setFacets({});
        }
        setRestoreTop(e.state?.top ?? savedBoardTop.current);
        return;
      }
      resetHome();
      if (e.state?.top != null) setRestoreTop(e.state.top);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [view, catalog]);

  /** Desktop: the Ask panel stays docked beside the board instead of opening on demand. */
  const askDocked = wide && view === 'board' && !!catalog;
  const askVisible = searchOpen || askDocked;
  useEffect(() => { if (askVisible) setAskMounted(true); }, [askVisible]);

  const rowsAll = useMemo(() => {
    if (!catalog) return [];
    void watchTick;
    const list = rankBoard(catalog.resorts, catalog.snow, { pass, ids: activeIds, observedOnly, sort: boardSort });
    const w = win || defaultWindow(catalog.snow);
    const rows = list.map((r: any) => ({
      r,
      m: windowMetrics(r, catalog.snow, w, catalog.typical),
      storm: stormForResort(r, catalog.snow),
      wx: wxById[r.id],
      dump: dumpParts(r, catalog.snow),
    }));
    return stormsOn ? rows.filter(x => x.storm.tier >= stormMin) : rows;
  }, [catalog, pass, activeIds, win, watchTick, stormsOn, stormMin, wxById, boardSort, observedOnly]);

  useEffect(() => {
    setShown(BOARD_PAGE);
  }, [pass, activeIds, stormsOn, boardSort, observedOnly]);

  useEffect(() => {
    localStorage.setItem('ss_board_sort', boardSort);
  }, [boardSort]);

  useEffect(() => {
    localStorage.setItem('ss_obs', observedOnly ? '1' : '0');
  }, [observedOnly]);

  useEffect(() => {
    if (!nwsOn) return;
    fetchNwsWinterAlerts().then(setNwsGeo).catch(() => setNwsGeo(null));
  }, [nwsOn]);

  useEffect(() => {
    if (!catalog) return;
    const ids = rowsAll.slice(0, 16).map(x => x.r);
    fetchListWeather(ids, { limit: 16, batch: 8 }).then(setWxById).catch(() => { /* snapshot */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, pass, activeIds, stormsOn]);

  const visibleRows = rowsAll.slice(0, shown);
  const selected = catalog?.resorts.find((r: any) => r.id === selectedId) || visibleRows[0]?.r || null;
  const maxDump = Math.max(0, ...rowsAll.map(x => x.dump.past72Cm));
  const zeroHint = maxDump === 0;
  const mapLayout: MapLayout = view === 'map' ? 'full' : view === 'profile' ? 'hero' : 'hidden';

  function openCategoryAlert() {
    if (!landing || !landingName) return;
    setEditRule(null);
    setAlertCtx(landing.kind === 'pass'
      ? { source: 'pass', type: 'region', region: null, regionName: `${PASS_PAGES[landing.id as keyof typeof PASS_PAGES]?.short} resorts`, pass: landing.id }
      : { source: 'region', type: 'region', region: landing.id, regionName: landingName, pass });
    setAlertOpen(true);
  }

  const leaderRow = rowsAll[0];
  const leaderLabel = leaderRow ? (() => {
    const d = leaderRow.dump;
    const [cm, label] = boardSort === 'forecast7d' ? [d.next7Cm, 'next 7d'] : boardSort === 'actual24' ? [d.past24Cm, 'last 24h'] : [d.past72Cm, 'last 72h'];
    return `${leaderRow.r.name} ${snowAmount(cm, units)} ${label}`;
  })() : null;
  const categoryHeader = landing && landingName && landingMeta ? (
    <CategoryHeader
      page={{ ...landing, name: landingName }}
      heading={landingMeta.heading}
      count={rowsAll.length}
      leader={leaderLabel}
      cta={categoryCta(landing, landingName)}
      onAlert={openCategoryAlert}
    />
  ) : null;

  return (
    <div className="relative h-full min-h-dvh w-full overflow-hidden bg-background">
      {catalog ? (
        <GlobeMap
          ref={globe}
          layout={mapLayout}
          parallax={heroParallax}
          resorts={(activeIds ? catalog.resorts.filter((r: any) => activeIds.includes(r.id)) : catalog.resorts)}
          snow={catalog.snow}
          typical={catalog.typical}
          fire={catalog.fire}
          win={win || catalog.win}
          units={units}
          lodgingOn={lodgingOn}
          selectedId={selectedId}
          radarOn={radarOn}
          cloudsOn={cloudsOn}
          stormsLayerOn={stormsLayerOn}
          nwsOn={nwsOn}
          nwsGeo={nwsGeo}
          onSelect={id => openResort(id)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">Loading…</div>
      )}

      {catalog && win && view === 'map' ? (
        <div className="absolute inset-0 z-20 pointer-events-none" data-testid="map-mode">
          <div className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3">
            <MapLayers
              radarOn={radarOn} setRadarOn={setRadarOn}
              cloudsOn={cloudsOn} setCloudsOn={setCloudsOn}
              stormsLayerOn={stormsLayerOn} setStormsLayerOn={setStormsLayerOn}
              nwsOn={nwsOn} setNwsOn={setNwsOn}
              lodgingOn={lodgingOn} setLodgingOn={setLodgingOn}
            />
          </div>
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-xl items-center gap-2">
              <Button type="button" variant="outline" className="min-h-12 flex-1 text-base" onClick={backToBoard} data-testid="list-button">
                <ListIcon /> Cards
              </Button>
              {selected ? (
                <Button type="button" variant="ghost" className="min-h-12 flex-1 truncate text-base" onClick={() => openResort(selected.id)}>
                  {selected.name}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {catalog && win && view === 'board' ? (
        <div className={`flex h-full min-h-dvh flex-col ${askVisible ? 'min-[1100px]:pr-[30rem]' : ''}`} data-ask-open={askVisible ? '1' : '0'} data-ask-docked={askDocked ? '1' : '0'}>
          <div
            className="mx-auto flex min-h-0 w-full flex-1 flex-col"
            style={{ maxWidth: BOARD_LAYOUT.maxWidth }}
            data-testid="board-shell"
          >
          <BoardChrome
            q={lastAsk}
            onOpenSearch={() => (askDocked ? setAskFocus(n => n + 1) : setSearchOpen(true))}
            onMenu={() => setMenuOpen(true)}
            onHome={resetHome}
            onClearScope={resetHome}
            scoped={scoped}
            chip={parsedIntent ? intentChip(parsedIntent) : ''}
          />
          {zeroHint ? (
            <p className="px-4 pt-1 text-sm text-muted-foreground">
              Quiet across the board. US numbers are SNOTEL; elsewhere modeled (est.).
            </p>
          ) : null}
          <BlockBoard
            rows={visibleRows}
            units={units}
            tempUnits={tempUnits}
            snow={catalog.snow}
            hasMore={shown < rowsAll.length}
            onMore={() => setShown(n => Math.min(rowsAll.length, n === BOARD_PAGE ? BOARD_PAGE + BOARD_MORE : rowsAll.length))}
            onOpen={id => openResort(id)}
            scrollerRef={boardScroll}
            restoreTop={restoreTop}
            tight={scoped}
            sort={boardSort}
            onSort={setBoardSort}
            regionId={facets.regionId || ''}
            regions={catalog.regions || []}
            onRegion={id => {
              if (!id) {
                setActiveIds(null);
                setFacets(f => ({ ...f, regionId: null, regionName: null }));
                writeURL({ region: null, ss: 'board' });
                return;
              }
              const g = catalog.regions.find((x: any) => x.id === id);
              if (g) applyRegion(g);
            }}
            observedOnly={observedOnly}
            onObservedOnly={setObservedOnly}
            before={categoryHeader}
            after={(
              <>
                {landing && landingName ? (
                  <CategoryFooterCta
                    name={landing.kind === 'pass' ? PASS_PAGES[landing.id as keyof typeof PASS_PAGES]?.short || landingName : landingName}
                    cta={categoryCta(landing, landingName)}
                    onAlert={openCategoryAlert}
                  />
                ) : scoped && parsedIntent ? (
                  <ContextCta
                    parsed={parsedIntent}
                    onAlert={() => {
                      const kind = ctaKind(parsedIntent);
                      setEditRule(null);
                      setAlertCtx({
                        source: 'search',
                        type: kind === 'home' ? 'resort' : kind,
                        pass,
                        region: parsedIntent.region?.id,
                        regionName: parsedIntent.region?.name,
                        resortId: parsedIntent.resort?.id,
                        resortName: parsedIntent.resort?.name,
                        from: parsedIntent.from,
                        to: parsedIntent.to,
                        adults: parsedIntent.adults,
                        kids: parsedIntent.kids,
                      });
                      setAlertOpen(true);
                    }}
                  />
                ) : (
                  <HomeSignup onStart={() => {
                    setEditRule(null);
                    setAlertCtx({ source: 'home', type: 'resort', pass });
                    setAlertOpen(true);
                  }} />
                )}
                <SiteFooter />
              </>
            )}
          />
          </div>
        </div>
      ) : null}

      {catalog && win && view === 'profile' && selectedId && selected ? (
        <ResortProfile
          row={visibleRows.find(x => x.r.id === selectedId) || { r: selected, m: windowMetrics(selected, catalog.snow, win, catalog.typical), storm: stormForResort(selected, catalog.snow), wx: wxById[selected.id] }}
          onBack={backToBoard}
          onScroll={setHeroParallax}
          snow={catalog.snow}
          units={units}
          tempUnits={tempUnits}
          onShowMap={r => { setSelectedId(r.id); setLodgingOn(true); setView('map'); setTimeout(() => globe.current?.flyResort(r), 80); }}
          onAlert={r => { setEditRule(null); setAlertCtx({ source: 'resort', resortId: r.id, resortName: r.name, pass }); setAlertOpen(true); }}
          history={catalog.history}
          social={catalog.social?.[selectedId] || null}
        />
      ) : null}

      {askMounted ? (
      <Suspense fallback={null}>
      <AskPanel
        open={askVisible}
        docked={askDocked}
        focusTick={askFocus}
        onClose={() => setSearchOpen(false)}
        units={units}
        catalog={catalog}
        request={askRequest}
        onAsked={setLastAsk}
        onOpenResort={id => openResort(id)}
        onShowBoard={showOnBoard}
        onAlertSignup={() => {
          setEditRule(null);
          setAlertCtx({ source: 'chat', type: 'resort', pass });
          setAlertOpen(true);
        }}
        regions={catalog?.regions || []}
        onRegion={id => {
          const g = catalog?.regions.find((x: any) => x.id === id);
          if (g) applyRegion(g);
        }}
        onWorldwide={resetHome}
        pass={pass}
        board={{ pass, regionId: facets.regionId || null, observedOnly, sort: boardSort }}
        setPass={p => { setPass(p as typeof PASSES[number]); setActiveIds(null); }}
        stormsOn={stormsOn}
        setStormsOn={on => { setStormsOn(on); setFacets(f => ({ ...f, storms: on })); if (on) setSearchOpen(false); }}
      />
      </Suspense>
      ) : null}

      <TripOnboarding
        open={tripOpen}
        onOpenChange={setTripOpen}
        resort={selected}
        win={win || { start: '', end: '' }}
        trip={trip}
        setTrip={setTrip}
        setCustomDates={setCustomDates}
        onAskAi={r => { setTripOpen(false); writeURL({ resort: r.id, mode: 'plan' }); openPlan([r]); }}
        onAlert={draft => {
          setTripOpen(false);
          setEditRule(null);
          setAlertCtx({
            source: 'trip',
            type: 'trip',
            pass,
            resortId: selected?.id,
            resortName: selected?.name,
            from: draft?.start,
            to: draft?.end,
            adults: draft?.adults,
            kids: draft?.kids,
          });
          setAlertOpen(true);
        }}
      />

      <SettingsSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        units={units}
        setUnits={setUnits}
        tempUnits={tempUnits}
        setTempUnits={setTempUnits}
        mode={alertsUi.mode}
        onPlanTrip={() => { setMenuOpen(false); setTripOpen(true); }}
      />

      <AlertOnboarding
        open={alertOpen}
        onOpenChange={v => { setAlertOpen(v); if (!v) setEditRule(null); }}
        ctx={alertCtx}
        mode={alertsUi.mode}
        resorts={catalog?.resorts || []}
        editRule={editRule}
      />

      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} text={planText} links={planLinks} />
    </div>
  );
}

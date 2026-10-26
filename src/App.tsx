import { useEffect, useMemo, useRef, useState } from 'react';
import { ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardChrome } from '@/components/BoardChrome';
import { BlockBoard } from '@/components/BlockBoard';
import { SearchOverlay, type SearchFacets } from '@/components/SearchOverlay';
import { TripSheet } from '@/components/TripSheet';
import { SettingsSheet } from '@/components/SettingsSheet';
import { PlanDialog } from '@/components/PlanDialog';
import { MapLayers } from '@/components/MapLayers';
import { ResortProfile } from '@/components/ResortProfile';
import { GlobeMap, type GlobeHandle, type MapLayout } from '@/components/GlobeMap';
import { loadCatalog } from '@/lib/catalog';
import { askAgent } from '@/lib/agentClient';
import { watchlist } from '@/lib/watchlist';
import { loadTrip, saveTrip, tripDates, partyOf, buildPlan, planHandoffLinks } from '../lib/trip.js';
import { parseTripQuery, shareSearch } from '../lib/links.js';
import { defaultWindow, forecastEnd, windowMetrics, presetWindow } from '../lib/snowWindow.js';
import { fmtShort } from '../lib/util.js';
import { toast } from 'sonner';
import { stormForResort } from '../lib/storms.js';
import { fetchListWeather } from '../lib/weather.js';
import { fetchNwsWinterAlerts } from '@/lib/nwsAlerts';
import { BOARD_MORE, BOARD_PAGE, compareDump, dumpParts } from '@/lib/board';
import { AlertOnboarding, type AlertContext } from '@/components/AlertOnboarding';
import { HomeSignup } from '@/components/HomeSignup';
import { SiteFooter } from '@/components/SiteFooter';
import { type LocalRule, setAccountEmail } from '@/lib/alertRules';
import { alertsUiState } from '@/lib/alertsUi';
import type { SnowUnits, TempUnits } from '@/lib/format';

const PASSES = ['all', 'ikon', 'epic'] as const;
type View = 'board' | 'profile' | 'map';

function initialPass() {
  const qs = new URLSearchParams(location.search);
  const q = qs.get('pass');
  if (PASSES.includes(q as any)) return q as typeof PASSES[number];
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
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
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

  const scoped = !!(activeIds || stormsOn || facets.regionId || facets.resortId || q);

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
      } else if (deep.q) {
        const g = c.regions.find((x: any) => x.id === deep.q || x.name.toLowerCase() === deep.q.toLowerCase());
        if (g) applyRegion(g, c, pass, { push: false });
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

  function writeURL(extra: any = {}) {
    if (!win) return;
    const { start, end } = tripDates(trip, win);
    const { adults, kids } = partyOf(trip);
    const kind = extra.ss
      || (extra.resort ?? selectedId ? 'profile' : (extra.region || activeIds ? 'filter' : 'board'));
    history.replaceState({ ...(history.state || {}), ss: kind, top: savedBoardTop.current }, '', location.pathname + shareSearch({
      resort: extra.resort ?? selectedId,
      from: start, to: end, adults, kids, home: trip.home,
      mode: extra.mode, pass, region: extra.region ?? facets.regionId,
      alerts: alertsUi.mode === 'preview' ? '1' : undefined,
    }));
  }

  useEffect(() => { if (win) writeURL(); }, [pass, win, trip, selectedId, facets.regionId]);

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
    const passOK = (r: any) => p === 'all' || (r.passes || []).includes(p);
    const ids = cat.resorts.filter((r: any) => passOK(r) && matchRegion(g, r)).map((r: any) => r.id);
    setActiveIds(ids);
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
    setActiveIds(null);
    setStormsOn(false);
    setQ('');
    setStatus('');
    setSearchOpen(false);
    setSelectedId(null);
    setFacets({});
    setView('board');
    if (catalog) setWin(presetWindow(catalog.snow, 'fc7'));
    writeURL({ resort: null, region: null, ss: 'board' });
    setRestoreTop(0);
    requestAnimationFrame(() => {
      if (boardScroll.current) boardScroll.current.scrollTop = 0;
    });
  }

  function applyActions(actions: any[], cat = catalog, parsed?: any) {
    if (!cat) return;
    let nextTrip = { ...trip };
    let nextPass = pass;
    let nextWin = win;
    for (const a of actions) {
      if (a.type === 'setTrip' && a.trip) {
        nextTrip = { ...nextTrip, ...a.trip };
        if (a.trip.pass && PASSES.includes(a.trip.pass)) nextPass = a.trip.pass;
        if (a.trip.start && a.trip.end) {
          const last = forecastEnd(cat.snow);
          nextWin = {
            mode: 'custom', start: a.trip.start, end: a.trip.end,
            label: a.trip.start > last ? `typical ${fmtShort(a.trip.start)}–${fmtShort(a.trip.end)}` : `${fmtShort(a.trip.start)}–${fmtShort(a.trip.end)}`,
            usedTypicalOnly: a.trip.start > last,
          };
        }
      }
      if (a.type === 'setWatchOnly' && a.on) {
        setActiveIds(watchlist());
        setSearchOpen(false);
        setMenuOpen(false);
        setView('board');
      }
      if (a.type === 'setStorms') {
        setStormsOn(!!a.on);
        if (a.on) setSearchOpen(false);
      }
      if (a.type === 'setWatchlist') {
        const cur = new Set(watchlist());
        for (const id of a.add || []) cur.add(id);
        for (const id of a.remove || []) cur.delete(id);
        localStorage.setItem('ss_watch', JSON.stringify([...cur]));
        setWatchTick(n => n + 1);
      }
    }
    setTrip(nextTrip);
    saveTrip(nextTrip);
    if (nextPass !== pass) setPass(nextPass);
    if (nextWin) setWin(nextWin);
    if (parsed) {
      setFacets({
        regionId: parsed.region?.id || null,
        regionName: parsed.region?.name || null,
        resortId: parsed.resort?.id || null,
        resortName: parsed.resort?.name || null,
        from: parsed.from || nextTrip.start || null,
        to: parsed.to || nextTrip.end || null,
        people: parsed.people || ((nextTrip.adults || 0) + (nextTrip.kids || 0)) || null,
        storms: !!parsed.storms,
      });
    }

    for (const a of actions) {
      if (a.type === 'showResorts') {
        pushScope('filter');
        setActiveIds(a.ids || []);
        setSearchOpen(false);
        setView('board');
      }
      if (a.type === 'flyTo') {
        setView('map');
        if (a.kind === 'region') {
          const g = cat.regions.find((x: any) => x.id === a.id);
          if (g) globe.current?.flyRegion(g);
        } else {
          const r = cat.resorts.find((x: any) => x.id === a.id);
          if (r) globe.current?.flyResort(r);
        }
      }
      if (a.type === 'openResort') {
        rememberBoard();
        history.pushState({ ss: 'profile', top: savedBoardTop.current }, '');
        setSelectedId(a.id);
        setSearchOpen(false);
        setView('profile');
        const r = cat.resorts.find((x: any) => x.id === a.id);
        if (r) setTimeout(() => globe.current?.flyResort(r), 80);
        if (a.mode === 'plan' && r) openPlan([r], nextWin, nextTrip, cat);
      }
    }
  }

  async function submit(raw?: string) {
    const text = (raw ?? q).trim();
    if (!text || !catalog) return;
    setQ(text);
    setSearchOpen(true);
    setLoading(true);
    setStatus('Reading that…');
    try {
      const out = await askAgent(text, {
        pass, regions: catalog.regions, resorts: catalog.resorts, today: catalog.today,
      }, setStatus);
      applyActions(out.actions || [], catalog, out.parsed);
      setStatus(out.llm ? 'Agent updated the trip.' : out.mode === 'deterministic' ? 'Parsed locally.' : '');
      if (!out.actions?.length) toast('Could not place that trip — try a region or resort name.');
    } catch (err: any) {
      setStatus('');
      toast(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function clearFacet(key: keyof SearchFacets) {
    if (key === 'regionId' || key === 'regionName') {
      setFacets(f => ({ ...f, regionId: null, regionName: null }));
      setActiveIds(null);
    } else if (key === 'resortId' || key === 'resortName') {
      setFacets(f => ({ ...f, resortId: null, resortName: null }));
      setActiveIds(null);
    } else if (key === 'from' || key === 'to') {
      setFacets(f => ({ ...f, from: null, to: null }));
      if (catalog) setWin(defaultWindow(catalog.snow));
    } else if (key === 'people') {
      setFacets(f => ({ ...f, people: null }));
    } else if (key === 'storms') {
      setFacets(f => ({ ...f, storms: false }));
      setStormsOn(false);
    }
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
          setQ('');
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

  const rowsAll = useMemo(() => {
    if (!catalog) return [];
    void watchTick;
    const passOK = (r: any) => pass === 'all' || (r.passes || []).includes(pass);
    let list = catalog.resorts.filter(passOK);
    if (activeIds) list = list.filter((r: any) => activeIds.includes(r.id));
    const w = win || defaultWindow(catalog.snow);
    const rows = list.map((r: any) => ({
      r,
      m: windowMetrics(r, catalog.snow, w, catalog.typical),
      storm: stormForResort(r, catalog.snow),
      wx: wxById[r.id],
      dump: dumpParts(r, catalog.snow),
    }));
    let out = rows;
    if (stormsOn) out = out.filter(x => x.storm.tier >= stormMin);
    out.sort((a, b) => compareDump(a, b, catalog.snow));
    return out;
  }, [catalog, pass, activeIds, win, watchTick, stormsOn, stormMin, wxById]);

  useEffect(() => {
    setShown(BOARD_PAGE);
  }, [pass, activeIds, stormsOn]);

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
  const maxDump = Math.max(0, ...rowsAll.map(x => x.dump.dumpCm));
  const zeroHint = maxDump === 0;
  const mapLayout: MapLayout = view === 'map' ? 'full' : view === 'profile' ? 'hero' : 'hidden';

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
        <div className="flex h-full min-h-dvh flex-col">
          <BoardChrome
            q={q}
            onOpenSearch={() => setSearchOpen(true)}
            onMenu={() => setMenuOpen(true)}
            onHome={resetHome}
            onClearScope={resetHome}
            scoped={scoped}
            loading={loading}
          />
          {zeroHint ? (
            <p className="px-4 pt-1 text-sm text-muted-foreground">
              Quiet across the board. Modeled, not resort-reported.
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
            after={(
              <>
                <HomeSignup onStart={addr => {
                  setAccountEmail(addr);
                  setEditRule(null);
                  setAlertCtx({ source: 'signup', email: addr, pass });
                  setAlertOpen(true);
                }} />
                <SiteFooter />
              </>
            )}
          />
        </div>
      ) : null}

      {catalog && win && view === 'profile' && selectedId && selected ? (
        <ResortProfile
          row={visibleRows.find(x => x.r.id === selectedId) || { r: selected, m: windowMetrics(selected, catalog.snow, win, catalog.typical), storm: stormForResort(selected, catalog.snow), wx: wxById[selected.id] }}
          onBack={backToBoard}
          onPlan={r => { writeURL({ resort: r.id, mode: 'plan' }); openPlan([r]); }}
          onScroll={setHeroParallax}
          snow={catalog.snow}
          typical={catalog.typical}
          units={units}
          tempUnits={tempUnits}
          trip={trip}
          win={win}
          onShowMap={r => { setSelectedId(r.id); setLodgingOn(true); setView('map'); setTimeout(() => globe.current?.flyResort(r), 80); }}
          onAlert={r => { setEditRule(null); setAlertCtx({ source: 'resort', resortId: r.id, resortName: r.name, pass }); setAlertOpen(true); }}
          onEditTrip={() => setTripOpen(true)}
        />
      ) : null}

      <SearchOverlay
        open={searchOpen}
        q={q}
        setQ={setQ}
        onSubmit={() => submit()}
        onClose={() => { setSearchOpen(false); setStatus(''); }}
        onHome={resetHome}
        onGhost={text => submit(text)}
        onRegion={id => {
          const g = catalog?.regions.find((x: any) => x.id === id);
          if (g) applyRegion(g);
        }}
        onResort={id => openResort(id)}
        onClearScope={resetHome}
        onClearFacet={clearFacet}
        onEditTrip={() => { setSearchOpen(false); setTripOpen(true); }}
        facets={facets}
        regions={catalog?.regions || []}
        resorts={catalog?.resorts || []}
        stormsOn={stormsOn}
        setStormsOn={on => { setStormsOn(on); setFacets(f => ({ ...f, storms: on })); if (on) setSearchOpen(false); }}
        loading={loading}
        status={status}
        scoped={scoped}
        pass={pass}
        setPass={p => { setPass(p); setActiveIds(null); }}
      />

      <TripSheet
        open={tripOpen}
        onOpenChange={setTripOpen}
        trip={trip}
        setTrip={setTrip}
        win={win || { start: '', end: '' }}
        setCustomDates={setCustomDates}
      />

      <SettingsSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        units={units}
        setUnits={setUnits}
        tempUnits={tempUnits}
        setTempUnits={setTempUnits}
        mode={alertsUi.mode}
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

function matchRegion(region: any, r: any) {
  const m = region.match || {};
  if (m.country && m.country.includes(r.country)) return true;
  if (m.region && m.region.includes(r.region)) return true;
  if (m.subregion && m.subregion.includes(r.subregion)) return true;
  return false;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapIcon, ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardChrome } from '@/components/BoardChrome';
import { BlockBoard } from '@/components/BlockBoard';
import { SearchOverlay } from '@/components/SearchOverlay';
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
import { defaultWindow, forecastEnd, windowMetrics, presetWindow, slotPreset } from '../lib/snowWindow.js';
import { fmtShort } from '../lib/util.js';
import { toast } from 'sonner';
import { stormForResort } from '../lib/storms.js';
import { fetchListWeather } from '../lib/weather.js';
import { fetchNwsWinterAlerts } from '@/lib/nwsAlerts';
import { BOARD_MORE, BOARD_PAGE, incomingScore, snowScore } from '@/lib/board';
import { AlertMeSheet, type AlertContext } from '@/components/AlertMeSheet';
import { alertsUiState } from '@/lib/alertsUi';

const PASSES = ['all', 'ikon', 'epic'] as const;
type View = 'board' | 'profile' | 'map';
type Slot = '24h' | '48h' | '72h' | '7d';

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
  const [windowSlot, setWindowSlot] = useState<Slot>('7d');
  const [trip, setTrip] = useState(() => loadTrip());
  const [win, setWin] = useState<any>(null);
  const [units, setUnits] = useState<'in' | 'cm'>((localStorage.getItem('ss_units') as any) || 'in');
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
  const [boardMode, setBoardMode] = useState<'recent' | 'incoming'>('recent');
  const preset = slotPreset(boardMode, windowSlot);
  const [shown, setShown] = useState(BOARD_PAGE);
  const [alertsUi] = useState(() => alertsUiState());
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertCtx, setAlertCtx] = useState<AlertContext>({ source: 'incoming', pass });

  useEffect(() => {
    loadCatalog().then(c => {
      setCatalog(c);
      let nextWin = presetWindow(c.snow, slotPreset('recent', '7d'));
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
      const qs = new URLSearchParams(location.search);
      if (qs.get('view') === 'incoming' || qs.get('mode') === 'incoming') setBoardMode('incoming');
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
        if (g) applyRegion(g, c, pass);
      }
    }).catch(err => toast(`Could not load resorts: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { saveTrip(trip); }, [trip]);
  useEffect(() => { localStorage.setItem('ss_pass', pass); }, [pass]);
  useEffect(() => { localStorage.setItem('ss_units', units); }, [units]);

  useEffect(() => {
    if (!catalog || win?.mode === 'custom') return;
    setWin(presetWindow(catalog.snow, preset));
  }, [catalog, preset]);

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
  }

  function writeURL(extra: any = {}) {
    if (!win) return;
    const { start, end } = tripDates(trip, win);
    const { adults, kids } = partyOf(trip);
    history.replaceState(null, '', location.pathname + shareSearch({
      resort: extra.resort ?? selectedId,
      from: start, to: end, adults, kids, home: trip.home,
      mode: extra.mode, pass, region: extra.region,
      view: boardMode === 'incoming' ? 'incoming' : undefined,
      alerts: alertsUi.mode === 'preview' ? '1' : undefined,
    }));
  }

  useEffect(() => { if (win) writeURL(); }, [pass, win, trip, selectedId, boardMode]);

  function applyRegion(g: any, cat = catalog, p = pass) {
    if (!g || !cat) return;
    const passOK = (r: any) => p === 'all' || (r.passes || []).includes(p);
    const ids = cat.resorts.filter((r: any) => passOK(r) && matchRegion(g, r)).map((r: any) => r.id);
    setActiveIds(ids);
    setSelectedId(null);
    setSearchOpen(false);
    setMenuOpen(false);
    setView('board');
    globe.current?.flyRegion(g);
    writeURL({ resort: null, region: g.id });
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

  function rememberBoard() {
    savedBoardTop.current = boardScroll.current?.scrollTop || 0;
    setRestoreTop(savedBoardTop.current);
  }

  function openResort(id: string, mode: 'explore' | 'plan' = 'explore') {
    rememberBoard();
    setSelectedId(id);
    setHeroParallax(0);
    setView('profile');
    const r = catalog?.resorts.find((x: any) => x.id === id);
    if (r) setTimeout(() => globe.current?.flyResort(r), 80);
    writeURL({ resort: id, mode });
    if (mode === 'plan' && r) openPlan([r]);
  }

  function backToBoard() {
    setView('board');
    setHeroParallax(0);
    writeURL({ resort: null });
    setRestoreTop(savedBoardTop.current);
  }

  function applyActions(actions: any[], cat = catalog) {
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
        if (a.on) {
          setBoardMode('incoming');
          setSearchOpen(false);
        }
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

    for (const a of actions) {
      if (a.type === 'showResorts') {
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
      applyActions(out.actions || [], catalog);
      setStatus(out.llm ? 'Agent updated the trip.' : out.mode === 'deterministic' ? 'Parsed locally.' : '');
      if (!out.actions?.length) toast('Could not place that trip — try a region or resort name.');
    } catch (err: any) {
      setStatus('');
      toast(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

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
    }));
    let out = rows;
    if (boardMode === 'incoming' || stormsOn) {
      if (stormsOn) out = out.filter(x => x.storm.tier >= stormMin);
      out.sort((a, b) => incomingScore(b) - incomingScore(a) || b.storm.max72Cm - a.storm.max72Cm || a.r.name.localeCompare(b.r.name));
    } else {
      out.sort((a, b) => snowScore(b) - snowScore(a) || a.r.name.localeCompare(b.r.name));
    }
    return out;
  }, [catalog, pass, activeIds, win, watchTick, stormsOn, stormMin, wxById, boardMode]);

  useEffect(() => {
    setShown(BOARD_PAGE);
  }, [pass, activeIds, stormsOn, boardMode, preset]);

  useEffect(() => {
    if (!nwsOn) return;
    fetchNwsWinterAlerts().then(setNwsGeo).catch(() => setNwsGeo(null));
  }, [nwsOn]);

  useEffect(() => {
    if (!catalog) return;
    const ids = rowsAll.slice(0, 16).map(x => x.r);
    fetchListWeather(ids, { limit: 16, batch: 8 }).then(setWxById).catch(() => { /* snapshot */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, pass, activeIds, stormsOn, preset]);

  const visibleRows = rowsAll.slice(0, shown);
  const selected = catalog?.resorts.find((r: any) => r.id === selectedId) || visibleRows[0]?.r || null;
  const max = Math.max(0, ...rowsAll.map(boardMode === 'incoming' ? incomingScore : snowScore));
  const zeroHint = boardMode === 'recent' && max === 0 && !String(preset).startsWith('fc');
  const mapLayout: MapLayout = view === 'map' ? 'full' : view === 'profile' ? 'hero' : 'hidden';

  function selectProfile(id: string) {
    setSelectedId(id);
    writeURL({ resort: id, mode: 'explore' });
    const r = catalog?.resorts.find((x: any) => x.id === id);
    if (r) globe.current?.flyResort(r);
  }

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
            loading={loading}
            windowSlot={windowSlot}
            setWindowSlot={p => setWindowSlot(p as Slot)}
            boardMode={boardMode}
            setBoardMode={m => { setBoardMode(m); setStormsOn(false); }}
          />
          {zeroHint ? (
            <p className="px-4 pt-1 text-sm text-muted-foreground">
              Quiet on this window. Try 7d or Incoming.
            </p>
          ) : null}
          <BlockBoard
            rows={visibleRows}
            units={units}
            snow={catalog.snow}
            mode={boardMode}
            hasMore={shown < rowsAll.length}
            onMore={() => setShown(n => Math.min(rowsAll.length, n === BOARD_PAGE ? BOARD_PAGE + BOARD_MORE : rowsAll.length))}
            onOpen={id => openResort(id)}
            scrollerRef={boardScroll}
            restoreTop={restoreTop}
          />
        </div>
      ) : null}

      {catalog && win && view === 'profile' && selectedId && selected ? (
        <ResortProfile
          pages={visibleRows.some(x => x.r.id === selectedId) ? visibleRows : [{ r: selected, m: windowMetrics(selected, catalog.snow, win, catalog.typical), storm: stormForResort(selected, catalog.snow), wx: wxById[selected.id] }, ...visibleRows]}
          selectedId={selectedId}
          onSelect={selectProfile}
          onBack={backToBoard}
          onPlan={r => { writeURL({ resort: r.id, mode: 'plan' }); openPlan([r]); }}
          onWatch={() => setWatchTick(n => n + 1)}
          onScroll={setHeroParallax}
          snow={catalog.snow}
          typical={catalog.typical}
          units={units}
          trip={trip}
          win={win}
          pass={pass}
          lodgingOn={lodgingOn}
          setLodgingOn={setLodgingOn}
          onShowMap={r => { setSelectedId(r.id); setView('map'); setTimeout(() => globe.current?.flyResort(r), 80); }}
          showAlert
          onAlert={r => { setAlertCtx({ source: 'resort', resortId: r.id, resortName: r.name, pass }); setAlertOpen(true); }}
          onEditTrip={() => setTripOpen(true)}
        />
      ) : null}

      {view === 'board' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2">
            <Button
              type="button"
              className="min-h-12 flex-1 text-base shadow-lg"
              data-testid="home-alert-me"
              onClick={() => { setAlertCtx({ source: 'incoming', pass }); setAlertOpen(true); }}
            >
              Alert me
            </Button>
            <Button type="button" variant="outline" className="min-h-12 min-w-12 rounded-full" aria-label="Map" data-testid="map-button" onClick={() => { setView('map'); if (selected) globe.current?.flyResort(selected); }}>
              <MapIcon />
            </Button>
          </div>
        </div>
      ) : null}

      <SearchOverlay
        open={searchOpen}
        q={q}
        setQ={setQ}
        onSubmit={() => submit()}
        onClose={() => { setSearchOpen(false); setQ(''); setStatus(''); }}
        onGhost={text => submit(text)}
        onRegion={id => {
          const g = catalog?.regions.find((x: any) => x.id === id);
          if (g) applyRegion(g);
        }}
        onClearScope={() => { setActiveIds(null); setStormsOn(false); setSearchOpen(false); }}
        regions={catalog?.regions || []}
        stormsOn={stormsOn}
        setStormsOn={on => { setStormsOn(on); if (on) { setBoardMode('incoming'); setSearchOpen(false); } }}
        loading={loading}
        status={status}
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
        pass={pass}
        setPass={p => { setPass(p); setActiveIds(null); }}
        onMyResorts={() => { setActiveIds(watchlist()); setStormsOn(false); setMenuOpen(false); setView('board'); }}
        watchCount={watchlist().length}
        onAlert={() => { setMenuOpen(false); setAlertCtx({ source: 'incoming', pass }); setAlertOpen(true); }}
        mode={alertsUi.mode}
        snowGenerated={catalog?.snow?.generated}
        resorts={catalog?.resorts || []}
      />

      <AlertMeSheet
        open={alertOpen}
        onOpenChange={setAlertOpen}
        ctx={alertCtx}
        mode={alertsUi.mode}
        regions={catalog?.regions || []}
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

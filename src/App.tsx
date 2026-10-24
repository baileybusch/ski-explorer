import { useEffect, useMemo, useRef, useState } from 'react';
import { HomeList } from '@/components/HomeList';
import { ResortDetail } from '@/components/ResortDetail';
import { SettingsSheet } from '@/components/SettingsSheet';
import { PlanDialog } from '@/components/PlanDialog';
import { MapLayers } from '@/components/MapLayers';
import { BottomChrome } from '@/components/BottomChrome';
import { GlobeMap, type GlobeHandle } from '@/components/GlobeMap';
import { loadCatalog } from '@/lib/catalog';
import { askAgent } from '@/lib/agentClient';
import { watchlist } from '@/lib/watchlist';
import { loadTrip, saveTrip, tripDates, partyOf, buildPlan, planHandoffLinks } from '../lib/trip.js';
import { parseTripQuery, shareSearch } from '../lib/links.js';
import { defaultWindow, forecastEnd, windowMetrics } from '../lib/snowWindow.js';
import { fmtShort } from '../lib/util.js';
import { toast } from 'sonner';
import { stormForResort } from '../lib/storms.js';
import { fetchListWeather } from '../lib/weather.js';
import { fetchNwsWinterAlerts } from '@/lib/nwsAlerts';

const PASSES = ['all', 'ikon', 'epic'] as const;
type View = 'home' | 'search' | 'detail' | 'map';

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
  const [catalog, setCatalog] = useState<any>(null);
  const [view, setView] = useState<View>('home');
  const [pass, setPass] = useState(initialPass);
  const [trip, setTrip] = useState(() => loadTrip());
  const [win, setWin] = useState<any>(null);
  const [units, setUnits] = useState<'in' | 'cm'>((localStorage.getItem('ss_units') as any) || 'in');
  const [sort, setSort] = useState<'snow' | 'name'>('snow');
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
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeIds, setActiveIds] = useState<string[] | null>(null);
  const [listTitle, setListTitle] = useState('Most snow');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planText, setPlanText] = useState('');
  const [planLinks, setPlanLinks] = useState<{ chatgpt?: string; grok?: string }>({});
  const [watchTick, setWatchTick] = useState(0);

  useEffect(() => {
    loadCatalog().then(c => {
      setCatalog(c);
      let nextWin = c.win;
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
        setView('detail');
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
    }));
  }

  function applyRegion(g: any, cat = catalog, p = pass) {
    if (!g || !cat) return;
    const passOK = (r: any) => p === 'all' || (r.passes || []).includes(p);
    const ids = cat.resorts.filter((r: any) => passOK(r) && matchRegion(g, r)).map((r: any) => r.id);
    setActiveIds(ids);
    setListTitle(g.name);
    setSelectedId(null);
    setView('search');
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

  function openResort(id: string, mode: 'explore' | 'plan' = 'explore') {
    setSelectedId(id);
    setView('detail');
    const r = catalog?.resorts.find((x: any) => x.id === id);
    if (r) globe.current?.flyResort(r);
    writeURL({ resort: id, mode });
    if (mode === 'plan' && r) openPlan([r]);
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
      if (a.type === 'setSort' && a.sort) setSort(a.sort);
      if (a.type === 'setWatchOnly' && a.on) {
        const ids = watchlist();
        setActiveIds(ids);
        setListTitle('My Resorts');
        setView('search');
      }
      if (a.type === 'setStorms') {
        setStormsOn(!!a.on);
        if (a.on) { setListTitle('Storms'); setView('search'); }
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
        setListTitle(a.title || 'Results');
        setView('search');
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
        setSelectedId(a.id);
        setView('detail');
        const r = cat.resorts.find((x: any) => x.id === a.id);
        if (r) globe.current?.flyResort(r);
        if (a.mode === 'plan' && r) openPlan([r], nextWin, nextTrip, cat);
      }
    }
  }

  async function submit(raw?: string) {
    const text = (raw ?? q).trim();
    if (!text || !catalog) return;
    setQ(text);
    setView('search');
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
    const rows = list.map((r: any) => ({
      r,
      m: windowMetrics(r, catalog.snow, win || defaultWindow(catalog.snow), catalog.typical),
      storm: stormForResort(r, catalog.snow),
      wx: wxById[r.id],
    }));
    let out = rows;
    if (stormsOn) out = out.filter(x => x.storm.tier >= stormMin);
    if (sort === 'name') out.sort((a, b) => a.r.name.localeCompare(b.r.name));
    else if (stormsOn) out.sort((a, b) => b.storm.max72Cm - a.storm.max72Cm);
    else out.sort((a, b) => b.m.outlookCm - a.m.outlookCm || b.m.recent - a.m.recent);
    return out;
  }, [catalog, pass, activeIds, sort, win, watchTick, stormsOn, stormMin, wxById]);

  const watchedRows = useMemo(() => {
    if (!catalog) return [];
    void watchTick;
    const ids = watchlist();
    return ids.map(id => {
      const r = catalog.resorts.find((x: any) => x.id === id);
      if (!r) return null;
      return {
        r,
        m: windowMetrics(r, catalog.snow, win || defaultWindow(catalog.snow), catalog.typical),
        storm: stormForResort(r, catalog.snow),
        wx: wxById[r.id],
      };
    }).filter(Boolean) as any[];
  }, [catalog, win, watchTick, wxById]);

  const swipePages = useMemo(() => {
    if (!catalog) return [];
    void watchTick;
    const ids = watchlist();
    const ordered = [...ids];
    if (selectedId && !ordered.includes(selectedId)) ordered.unshift(selectedId);
    return ordered.map(id => catalog.resorts.find((x: any) => x.id === id)).filter(Boolean);
  }, [catalog, selectedId, watchTick]);

  useEffect(() => {
    if (!nwsOn) return;
    fetchNwsWinterAlerts().then(setNwsGeo).catch(() => setNwsGeo(null));
  }, [nwsOn]);

  useEffect(() => {
    if (!catalog) return;
    const ids = [...watchedRows.map(x => x.r), ...rowsAll.slice(0, 12).map(x => x.r)]
      .filter((r, i, a) => a.findIndex(x => x.id === r.id) === i)
      .slice(0, 16);
    fetchListWeather(ids, { limit: 16, batch: 8 }).then(setWxById).catch(() => { /* snapshot glyph/temp */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, pass, activeIds, stormsOn, watchTick]);

  const title = (stormsOn ? 'Storms' : listTitle) + (win?.label ? ` · ${win.label}` : '');
  const selected = catalog?.resorts.find((r: any) => r.id === selectedId) || null;
  const mapIndex = Math.max(0, swipePages.findIndex((r: any) => r.id === selectedId));

  return (
    <div className="relative h-full min-h-dvh w-full overflow-hidden bg-background">
      {catalog ? (
        <div className={view === 'map' ? 'absolute inset-0' : 'pointer-events-none invisible absolute inset-0'} data-testid="map-mode">
          <GlobeMap
            ref={globe}
            active={view === 'map'}
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
          <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20">
            <MapLayers
              radarOn={radarOn} setRadarOn={setRadarOn}
              cloudsOn={cloudsOn} setCloudsOn={setCloudsOn}
              stormsLayerOn={stormsLayerOn} setStormsLayerOn={setStormsLayerOn}
              nwsOn={nwsOn} setNwsOn={setNwsOn}
              lodgingOn={lodgingOn} setLodgingOn={setLodgingOn}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20">
            <BottomChrome
              page={mapIndex}
              count={Math.max(swipePages.length, 1)}
              onList={() => setView('home')}
              onMap={() => { /* already map */ }}
              onDot={i => { const r = swipePages[i]; if (r) { setSelectedId(r.id); globe.current?.flyResort(r); } }}
            />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">Loading…</div>
      )}

      {catalog && win && (view === 'home' || view === 'search') ? (
        <HomeList
          mode={view}
          q={q}
          setQ={setQ}
          onSubmit={submit}
          onSettings={() => setMenuOpen(true)}
          onActivateSearch={() => setView('search')}
          onBackHome={() => { setView('home'); setQ(''); setStatus(''); setActiveIds(null); setListTitle('Most snow'); }}
          loading={loading}
          status={status}
          pass={pass}
          setPass={p => { setPass(p); setActiveIds(null); }}
          stormsOn={stormsOn}
          setStormsOn={on => { setStormsOn(on); if (on) setListTitle('Storms'); else if (!activeIds) setListTitle('Most snow'); }}
          title={title}
          watched={watchedRows}
          rows={rowsAll}
          units={units}
          onOpen={id => openResort(id)}
          onGhost={text => submit(text)}
        />
      ) : null}

      {catalog && win && view === 'detail' && selected ? (
        <ResortDetail
          pages={swipePages.length ? swipePages : [selected]}
          selectedId={selected.id}
          onSelect={id => { setSelectedId(id); writeURL({ resort: id, mode: 'explore' }); }}
          snow={catalog.snow}
          typical={catalog.typical}
          units={units}
          trip={trip}
          win={win}
          pass={pass}
          onPlan={r => { writeURL({ resort: r.id, mode: 'plan' }); openPlan([r]); }}
          onWatch={() => setWatchTick(n => n + 1)}
          onList={() => setView('home')}
          onMap={() => { setView('map'); if (selected) globe.current?.flyResort(selected); }}
          onExpandMap={r => { setSelectedId(r.id); setView('map'); globe.current?.flyResort(r); }}
        />
      ) : null}

      <SettingsSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        trip={trip}
        setTrip={setTrip}
        units={units}
        setUnits={setUnits}
        sort={sort}
        setSort={setSort}
        stormMin={stormMin}
        setStormMin={setStormMin}
        win={win || { start: '', end: '' }}
        setCustomDates={setCustomDates}
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

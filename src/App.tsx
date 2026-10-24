import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { SettingsSheet } from '@/components/SettingsSheet';
import { ResultsSheet } from '@/components/ResultsSheet';
import { ResortSheet } from '@/components/ResortSheet';
import { PlanDialog } from '@/components/PlanDialog';
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
import { Button } from '@/components/ui/button';

const PASSES = ['all', 'ikon', 'epic'] as const;

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
  const [pass, setPass] = useState(initialPass);
  const [trip, setTrip] = useState(() => loadTrip());
  const [win, setWin] = useState<any>(null);
  const [units, setUnits] = useState<'in' | 'cm'>((localStorage.getItem('ss_units') as any) || 'in');
  const [sort, setSort] = useState<'snow' | 'name'>('snow');
  const [watchOnly, setWatchOnly] = useState(false);
  const [lodgingOn, setLodgingOn] = useState(false);
  const [radarOn, setRadarOn] = useState(false);
  const [cloudsOn, setCloudsOn] = useState(false);
  const [stormsOn, setStormsOn] = useState(false);
  const [nwsOn, setNwsOn] = useState(false);
  const [stormMin, setStormMin] = useState(6);
  const [nwsGeo, setNwsGeo] = useState<any>(null);
  const [wxById, setWxById] = useState<Record<string, any>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [snap, setSnap] = useState<'peek' | 'half' | 'full'>('peek');
  const [activeIds, setActiveIds] = useState<string[] | null>(null);
  const [listTitle, setListTitle] = useState('Most snow');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resortOpen, setResortOpen] = useState(false);
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
        setResortOpen(true);
        setSnap('half');
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
    setResortOpen(false);
    setSnap('half');
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
      if (a.type === 'setWatchOnly') setWatchOnly(!!a.on);
      if (a.type === 'setStorms') {
        setStormsOn(!!a.on);
        if (a.on) { setListTitle('Storms'); setSnap('half'); }
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
        setSnap('half');
      }
      if (a.type === 'flyTo') {
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
        setResortOpen(true);
        const r = cat.resorts.find((x: any) => x.id === a.id);
        if (r) globe.current?.flyResort(r);
        if (a.mode === 'plan' && r) openPlan([r], nextWin, nextTrip, cat);
      }
    }
  }

  async function submit() {
    const text = q.trim();
    if (!text || !catalog) return;
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

  const visible = useMemo(() => {
    if (!catalog) return [];
    const watch = new Set(watchlist());
    void watchTick;
    const passOK = (r: any) => pass === 'all' || (r.passes || []).includes(pass);
    let list = catalog.resorts.filter(passOK);
    if (activeIds) list = list.filter((r: any) => activeIds.includes(r.id));
    if (watchOnly) list = list.filter((r: any) => watch.has(r.id));
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
  }, [catalog, pass, activeIds, watchOnly, sort, win, watchTick, stormsOn, stormMin, wxById]);

  useEffect(() => {
    if (!nwsOn) return;
    fetchNwsWinterAlerts().then(setNwsGeo).catch(() => setNwsGeo(null));
  }, [nwsOn]);

  useEffect(() => {
    if (!catalog || snap === 'peek') return;
    const ids = visible.slice(0, 12).map(x => x.r);
    fetchListWeather(ids, { limit: 12, batch: 8 }).then(setWxById).catch(() => { /* snapshot glyph/temp still show */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, snap, pass, activeIds, stormsOn]);


  const selected = catalog?.resorts.find((r: any) => r.id === selectedId) || null;
  const title = (stormsOn ? 'Storms' : listTitle) + (win?.label ? ` · ${win.label}` : '');

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(8,12,20,.45)_100%)]" />
      {catalog ? (
        <GlobeMap
          ref={globe}
          resorts={visible.map(x => x.r)}
          snow={catalog.snow}
          typical={catalog.typical}
          fire={catalog.fire}
          win={win || catalog.win}
          units={units}
          lodgingOn={lodgingOn}
          selectedId={selectedId}
          radarOn={radarOn}
          cloudsOn={cloudsOn}
          stormsLayerOn={stormsOn}
          nwsOn={nwsOn}
          nwsGeo={nwsGeo}
          onSelect={id => { setSelectedId(id); setResortOpen(true); writeURL({ resort: id, mode: 'explore' }); }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">Loading the globe…</div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <SearchBar
          value={q}
          onChange={setQ}
          onSubmit={submit}
          onMenu={() => setMenuOpen(true)}
          loading={loading}
          status={status}
        />
        <div className="pointer-events-auto mt-2 flex">
          <Button
            type="button"
            size="sm"
            variant={stormsOn ? 'default' : 'secondary'}
            className="min-h-10 rounded-full px-4 text-sm font-semibold"
            data-testid="storms-chip"
            aria-pressed={stormsOn}
            onClick={() => {
              const next = !stormsOn;
              setStormsOn(next);
              if (next) { setListTitle('Storms'); setSnap('half'); }
              else setListTitle(activeIds ? listTitle : 'Most snow');
            }}
          >
            Storms
          </Button>
        </div>
      </div>

      {catalog && win ? (
        <ResultsSheet
          title={title}
          rows={visible}
          units={units}
          snap={snap}
          onSnap={setSnap}
          onExplore={id => {
            setSelectedId(id);
            setResortOpen(true);
            const r = catalog.resorts.find((x: any) => x.id === id);
            if (r) globe.current?.flyResort(r);
            writeURL({ resort: id, mode: 'explore' });
          }}
        />
      ) : null}

      <SettingsSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        pass={pass}
        setPass={p => { setPass(p); setActiveIds(null); }}
        trip={trip}
        setTrip={setTrip}
        units={units}
        setUnits={setUnits}
        sort={sort}
        setSort={setSort}
        watchOnly={watchOnly}
        setWatchOnly={setWatchOnly}
        lodgingOn={lodgingOn}
        setLodgingOn={setLodgingOn}
        radarOn={radarOn}
        setRadarOn={setRadarOn}
        cloudsOn={cloudsOn}
        setCloudsOn={setCloudsOn}
        stormsOn={stormsOn}
        setStormsOn={on => { setStormsOn(on); if (on) { setListTitle('Storms'); setSnap('half'); } }}
        nwsOn={nwsOn}
        setNwsOn={setNwsOn}
        stormMin={stormMin}
        setStormMin={setStormMin}
        win={win || { start: '', end: '' }}
        setCustomDates={setCustomDates}
        onResetGlobe={() => {
          setActiveIds(null);
          setListTitle('Most snow');
          setSelectedId(null);
          setSnap('peek');
          globe.current?.flyHome();
          writeURL({ resort: null, region: null });
        }}
      />

      <ResortSheet
        resort={selected}
        open={!!selected && resortOpen}
        onOpenChange={v => { setResortOpen(v); if (!v) writeURL({ resort: null }); }}
        win={win}
        trip={trip}
        units={units}
        pass={pass}
        snow={catalog?.snow}
        typical={catalog?.typical}
        onPlan={() => { if (selected) { writeURL({ resort: selected.id, mode: 'plan' }); openPlan([selected]); } }}
        onWatch={() => setWatchTick(n => n + 1)}
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

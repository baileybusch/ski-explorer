import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import { windowMetrics } from '../../lib/snowWindow.js';
import { snowAmount } from '@/lib/format';
import { fallbackStyle, loadStyle } from '@/lib/mapStyle';
import { stormForResort } from '../../lib/storms.js';
import { rainviewerMaps, radarTileUrl, satelliteTileUrl, radarAvailable, satelliteAvailable, probeRadarTile } from '@/lib/rainviewer';
import type { LayerStatus } from '@/components/MapLayers';

const DEM = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const EXAG = 1.25;
const lodgingCache: Record<string, any> = {};
const osmCache: Record<string, Promise<any>> = {};

export type MapLayout = 'hidden' | 'hero' | 'full';

export type GlobeHandle = {
  flyHome: () => void;
  flyRegion: (g: any) => void;
  flyResort: (r: any) => void;
};

function padFor(layout: MapLayout) {
  if (layout === 'hero') return { top: 56, bottom: 28, left: 12, right: 12 };
  const mobile = typeof window !== 'undefined' && window.innerWidth < 900;
  return mobile
    ? { top: 90, bottom: Math.round(window.innerHeight * 0.42), left: 16, right: 16 }
    : { top: 80, bottom: 80, left: 40, right: 40 };
}

function setInteractive(map: MapLibreMap, on: boolean) {
  const names = ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch'] as const;
  for (const name of names) {
    try {
      const h = (map as any)[name];
      if (!h) continue;
      if (on) h.enable();
      else h.disable();
    } catch { /* */ }
  }
}

function setHeroBase(map: MapLibreMap, hero: boolean) {
  const vis = (id: string, on: boolean) => {
    try { map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } catch { /* style not ready */ }
  };
  vis('resort-label', !hero);
  vis('resort-dot', !hero);
  vis('resort-hit', !hero);
  vis('fire-fill', !hero);
  vis('fire-line', !hero);
  vis('snow', !hero);
}

export const GlobeMap = forwardRef(function GlobeMap(
  {
    resorts, snow, typical, fire, win, units, lodgingOn, selectedId, onSelect,
    radarOn, cloudsOn, stormsLayerOn, nwsOn, nwsGeo, layout = 'full', parallax = 0,
    radarEpoch = 0, onLayerStatus, onLodgingStatus,
  }: {
    resorts: any[];
    snow: any;
    typical: any;
    fire: any;
    win: any;
    units: 'in' | 'cm';
    lodgingOn: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
    radarOn?: boolean;
    cloudsOn?: boolean;
    stormsLayerOn?: boolean;
    nwsOn?: boolean;
    nwsGeo?: any;
    layout?: MapLayout;
    parallax?: number;
    radarEpoch?: number;
    onLayerStatus?: (s: Pick<LayerStatus, 'radar' | 'clouds'> & Pick<LayerStatus, 'radarCover' | 'stormRings'>) => void;
    onLodgingStatus?: (s: LayerStatus['lodging']) => void;
  },
  ref: Ref<GlobeHandle>,
) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const terrainOn = useRef(false);
  const terrainOk = useRef(true);
  const ready = useRef(false);
  const fellBack = useRef(false);
  const onSelectRef = useRef(onSelect);
  const layoutRef = useRef(layout);
  const fireRef = useRef(fire);
  const onLayerStatusRef = useRef(onLayerStatus);
  const onLodgingStatusRef = useRef(onLodgingStatus);
  const radarOnRef = useRef(radarOn);
  const cloudsOnRef = useRef(cloudsOn);
  const stormsLayerOnRef = useRef(stormsLayerOn);
  const nwsOnRef = useRef(nwsOn);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [wxAttr, setWxAttr] = useState({ radar: 'off', clouds: 'off', storms: 'off', nws: 'off', radarReady: '0', cloudsReady: '0', radarCover: 'unknown', stormRings: '0', stormHits: '0' });
  onSelectRef.current = onSelect;
  layoutRef.current = layout;
  fireRef.current = fire;
  onLayerStatusRef.current = onLayerStatus;
  onLodgingStatusRef.current = onLodgingStatus;
  radarOnRef.current = radarOn;
  cloudsOnRef.current = cloudsOn;
  stormsLayerOnRef.current = stormsLayerOn;
  nwsOnRef.current = nwsOn;

  useImperativeHandle(ref, () => ({
    flyHome() {
      const map = mapRef.current;
      if (!map) return;
      try { map.setTerrain(null); } catch { /* */ }
      terrainOn.current = false;
      map.flyTo({ center: [-30, 28], zoom: 1.55, pitch: 0, bearing: 0, duration: 1800, essential: true });
    },
    flyRegion(g) {
      const map = mapRef.current;
      if (!map || !g) return;
      map.flyTo({ center: g.center, zoom: g.zoom, pitch: g.pitch || 28, bearing: 0, duration: 2400, essential: true, curve: 1.5, padding: padFor(layoutRef.current) });
    },
    flyResort(r) {
      const map = mapRef.current;
      if (!map || !r) return;
      const [x0, y0, x1, y1] = r.bbox || [r.center[0] - 0.2, r.center[1] - 0.15, r.center[0] + 0.2, r.center[1] + 0.15];
      const pad = padFor(layoutRef.current);
      const cam = map.cameraForBounds([[x0, y0], [x1, y1]], { padding: pad });
      const hero = layoutRef.current === 'hero';
      // RainViewer mosaic maxzoom is 7. Full-map camera stays near that so
      // precipitation in the cell is on screen; close-up overzoom is a clear hole.
      const z = hero
        ? (r.id === 'eagle-point' ? 11.6 : Math.min(12.6, Math.max(11.0, (cam?.zoom ?? 12) - 0.2)))
        : 7.35;
      syncTerrain(map, terrainOn, terrainOk);
      map.flyTo({
        center: [(x0 + x1) / 2, (y0 + y1) / 2],
        zoom: z,
        pitch: hero ? 54 : 36,
        bearing: r.bearing || 0,
        duration: hero ? 1400 : 2800,
        essential: true,
        curve: 1.4,
        padding: pad,
      });
      loadOSM(map, r.id);
    },
  }));

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    function hideFailedBasemap(instance: MapLibreMap) {
      try {
        const style = instance.getStyle();
        for (const layer of style?.layers || []) {
          if (layer.source === 'openmaptiles' || layer.source === 'ne2_shaded') {
            instance.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        }
        if (instance.getLayer('background')) {
          instance.setPaintProperty('background', 'background-color', '#1c1d21');
        }
      } catch { /* keep last paint */ }
    }

    function bind(instance: MapLibreMap) {
      instance.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      instance.on('load', () => {
        ready.current = true;
        setMapEpoch(n => n + 1);
        try { instance.resize(); } catch { /* */ }
        try {
          import('maplibre-contour').then(mlcontour => {
            const demSource = new mlcontour.default.DemSource({ url: DEM, encoding: 'terrarium', maxzoom: 12, worker: true });
            demSource.setupMaplibre({ Map: MapLibreMap } as any);
          }).catch(() => { /* contours stay off */ });
        } catch { /* */ }
      });
      instance.on('click', e => {
        if (layoutRef.current !== 'full') return;
        const P = 24, { x, y } = e.point;
        const f = instance.queryRenderedFeatures([[x - P, y - P], [x + P, y + P]], { layers: ['resort-hit', 'resort-dot', 'resort-label'] });
        if (!f.length) return;
        f.sort((a, b) => {
          const pa = instance.project((a.geometry as any).coordinates);
          const pb = instance.project((b.geometry as any).coordinates);
          return Math.hypot(pa.x - x, pa.y - y) - Math.hypot(pb.x - x, pb.y - y);
        });
        onSelectRef.current(f[0].properties.id);
      });
      instance.on('mousemove', e => {
        if (layoutRef.current !== 'full') {
          instance.getCanvas().style.cursor = '';
          return;
        }
        const P = 16, { x, y } = e.point;
        instance.getCanvas().style.cursor = instance.queryRenderedFeatures([[x - P, y - P], [x + P, y + P]], { layers: ['resort-hit', 'resort-label'] }).length ? 'pointer' : '';
      });
      instance.on('zoomend', () => syncTerrain(instance, terrainOn, terrainOk));
      instance.on('moveend', () => syncTerrain(instance, terrainOn, terrainOk));
      instance.on('error', (err: any) => {
        const src = err?.sourceId || err?.source?.id;
        const msg = String(err?.error?.message || err?.error || '');
        if (src === 'dem' || /mapterhorn|terrain|dem/i.test(msg)) {
          terrainOk.current = false;
          try { instance.setTerrain(null); } catch { /* */ }
          terrainOn.current = false;
        }
        if (src === 'openmaptiles' || src === 'ne2_shaded' || /openfreemap|openmaptiles|failed to load/i.test(msg)) {
          if (fellBack.current) {
            hideFailedBasemap(instance);
            return;
          }
          fellBack.current = true;
          try { instance.setStyle(fallbackStyle({ fire: fireRef.current }) as any); } catch { hideFailedBasemap(instance); }
        }
      });
    }

    loadStyle({ fire }).then(style => {
      if (cancelled || !el.current) return;
      map = new MapLibreMap({
        container: el.current,
        hash: false,
        attributionControl: false,
        maxPitch: 80,
        center: [-30, 28],
        zoom: 1.55,
        pitch: 0,
        bearing: 0,
        projection: { type: 'globe' },
        style: style as any,
        interactive: true,
      });
      mapRef.current = map;
      bind(map);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, [fire]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      setInteractive(map, layout === 'full');
      setHeroBase(map, layout === 'hero');
      try { map.resize(); } catch { /* */ }
      if (layout !== 'hidden') syncTerrain(map, terrainOn, terrainOk);
    };
    if (map.loaded()) apply();
    else map.once('load', apply);
  }, [layout, mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !snow) return;
    const paint = () => {
      if (!map.getSource('resorts')) {
        map.once('idle', paint);
        return;
      }
      const pts = snow.grid
        ? snow.grid.filter(([x, y]: number[]) => resorts.some(r => Math.hypot(r.center[0] - x, r.center[1] - y) < 3)).map(([x, y, sf]: any) => [x, y, (sf || []).reduce((a: number, b: number) => a + b, 0)])
        : resorts.map(r => [r.center[0], r.center[1], (r.d7 || 0) / 6]);
      (map.getSource('snow') as any)?.setData({
        type: 'FeatureCollection',
        features: pts.map(([x, y, v]: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: { v } })),
      });
      (map.getSource('resorts') as any)?.setData({
        type: 'FeatureCollection',
        features: resorts.map(r => {
          const m = windowMetrics(r, snow, win, typical);
          const v = m.windowCm;
          const storm = stormForResort(r, snow);
          const lbl = r.id === 'eagle-point' ? 'Closed 26/27' : `${snowAmount(v, units)}${m.usedTypical ? ' typ' : ''}`;
          return { type: 'Feature', geometry: { type: 'Point', coordinates: r.center }, properties: { id: r.id, pass: (r.passes || []).join('+'), name: r.name.replace(/ \(.*\)/, ''), v, lbl, tier: storm.tier } };
        }),
      });
      const rings = resorts.filter(r => stormForResort(r, snow).tier > 0).length;
      setWxAttr(s => ({ ...s, stormRings: String(rings) }));
      onLayerStatusRef.current?.({ stormRings: rings } as any);
    };
    const cancel = whenStyleReady(map, paint);
    return () => cancel();
  }, [resorts, snow, typical, win, units, mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = lodgingOn ? 'visible' : 'none';
    const apply = () => {
      try {
        map.setLayoutProperty('lodge-dot', 'visibility', vis);
        map.setLayoutProperty('lodge-label', 'visibility', vis);
      } catch { /* */ }
      if (!lodgingOn) {
        onLodgingStatusRef.current?.('off');
        (map.getSource('lodging') as any)?.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const r = resorts.find(x => x.id === selectedId);
      if (r) loadLodging(map, r, s => onLodgingStatusRef.current?.(s));
      else onLodgingStatusRef.current?.('empty');
    };
    const cancel = whenStyleReady(map, apply);
    return () => cancel();
  }, [lodgingOn, selectedId, resorts, mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let live = true;
    const paintOverlays = () => {
      const full = layoutRef.current === 'full';
      const vis = (on: boolean) => (full && on ? 'visible' : 'none');
      const radar = !!radarOnRef.current;
      const clouds = !!cloudsOnRef.current;
      const storms = !!stormsLayerOnRef.current;
      const nws = !!nwsOnRef.current;
      try {
        map.setLayoutProperty('radar', 'visibility', vis(radar));
        map.setLayoutProperty('clouds', 'visibility', vis(clouds));
        map.setLayoutProperty('storm-ring', 'visibility', vis(storms));
        map.setLayoutProperty('nws-fill', 'visibility', vis(nws));
        map.setLayoutProperty('nws-line', 'visibility', vis(nws));
      } catch { /* style not ready */ }
      let hits = 0;
      if (full && storms) {
        try {
          const box = map.getContainer();
          hits = map.queryRenderedFeatures([[0, 0], [box.clientWidth, box.clientHeight]], { layers: ['storm-ring'] }).length;
        } catch { /* style not ready */ }
      }
      setWxAttr(s => ({ ...s, stormHits: String(hits) }));
      return { full, radar, clouds };
    };
    const apply = async () => {
      if (!live) return;
      const { full, radar, clouds } = paintOverlays();
      if (full && (radar || clouds)) {
        try {
          const maps = await rainviewerMaps();
          if (!live) return;
          paintOverlays();
          const rUrl = radarTileUrl(maps);
          const cUrl = satelliteTileUrl(maps);
          if (rUrl) setRasterTiles(map, 'radar', rUrl);
          if (cUrl) setRasterTiles(map, 'clouds', cUrl);
          const radarOk = radarAvailable(maps);
          const cloudsOk = satelliteAvailable(maps);
          const focus = resorts.find(x => x.id === selectedId) || resorts[0];
          const probe = focus?.center
            ? await probeRadarTile(maps, focus.center[0], focus.center[1], 7)
            : { kind: 'unavailable' as const };
          if (!live) return;
          setWxAttr(s => ({
            ...s,
            radarReady: radarOk ? '1' : '0',
            cloudsReady: cloudsOk ? '1' : '0',
            radarCover: probe.kind,
          }));
          onLayerStatusRef.current?.({
            radar: radarOk ? 'ready' : 'empty',
            clouds: cloudsOk ? 'ready' : 'unavailable',
            radarCover: probe.kind,
          });
        } catch {
          if (!live) return;
          setWxAttr(s => ({ ...s, radarReady: '0', cloudsReady: '0', radarCover: 'error' }));
          onLayerStatusRef.current?.({ radar: 'error', clouds: 'error', radarCover: 'error' });
        }
      } else if (full) {
        setWxAttr(s => ({ ...s, radarCover: s.radarCover }));
      }
      if (nwsGeo && map.getSource('nws')) (map.getSource('nws') as any).setData(nwsGeo);
    };
    const cancel = whenStyleReady(map, () => {
      apply().catch(() => {});
      map.once('idle', () => { if (live) paintOverlays(); });
    });
    return () => { live = false; cancel(); };
  }, [radarOn, cloudsOn, stormsLayerOn, nwsOn, nwsGeo, mapEpoch, radarEpoch, layout, selectedId, resorts]);

  const hidden = layout === 'hidden';
  const hero = layout === 'hero';
  const full = layout === 'full';
  const stormRingCount = (resorts || []).filter((r: any) => snow && stormForResort(r, snow).tier > 0).length;

  return (
    <div
      className={hidden ? 'hidden' : hero ? 'hero-map absolute inset-x-0 top-0 z-0 h-[48dvh] overflow-hidden' : 'absolute inset-0 z-10'}
      data-testid="globe"
      data-radar={full && radarOn ? 'on' : 'off'}
      data-clouds={full && cloudsOn ? 'on' : 'off'}
      data-storms={full && stormsLayerOn ? 'on' : 'off'}
      data-nws={full && nwsOn ? 'on' : 'off'}
      data-radar-ready={wxAttr.radarReady}
      data-clouds-ready={wxAttr.cloudsReady}
      data-radar-cover={wxAttr.radarCover}
      data-storm-rings={String(stormRingCount)}
      data-storm-hits={wxAttr.stormHits}
      style={hero ? { transform: `translate3d(0, ${Math.round(parallax * 0.22)}px, 0)`, pointerEvents: 'none' } : undefined}
    >
      <div ref={el} className="h-full w-full" />
    </div>
  );
});

function syncTerrain(map: MapLibreMap, terrainOn: { current: boolean }, terrainOk: { current: boolean }) {
  const z = map.getZoom();
  if (terrainOk.current && z >= 6 && z <= 13.2) {
    try {
      map.setTerrain({ source: 'dem', exaggeration: EXAG });
      terrainOn.current = true;
    } catch {
      terrainOk.current = false;
      try { map.setTerrain(null); } catch { /* */ }
      terrainOn.current = false;
    }
  } else if (terrainOn.current) {
    try { map.setTerrain(null); } catch { /* */ }
    terrainOn.current = false;
  }
}

async function loadOSM(map: MapLibreMap, id: string) {
  if (!osmCache[id]) osmCache[id] = fetch(`/data/resorts/${id}.json`).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }));
  const loaded = await Promise.all(Object.values(osmCache));
  (map.getSource('osm') as any)?.setData({ type: 'FeatureCollection', features: loaded.flatMap((f: any) => f.features || []) });
}

function whenStyleReady(map: MapLibreMap, fn: () => void) {
  let done = false;
  let timer = 0;
  const run = () => {
    if (done) return;
    done = true;
    map.off('load', run);
    map.off('idle', run);
    if (timer) window.clearTimeout(timer);
    try { map.resize(); } catch { /* hidden → full */ }
    fn();
  };
  if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
    run();
    return () => {};
  }
  map.once('load', run);
  map.once('idle', run);
  timer = window.setTimeout(run, 500);
  return () => {
    done = true;
    map.off('load', run);
    map.off('idle', run);
    if (timer) window.clearTimeout(timer);
  };
}

function setRasterTiles(map: MapLibreMap, id: string, url: string) {
  const src = map.getSource(id) as any;
  if (src?.setTiles) {
    src.setTiles([url]);
    return;
  }
  try {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
    map.addSource(id, {
      type: 'raster',
      tiles: [url],
      tileSize: 256,
      maxzoom: 7,
      attribution: 'Radar © RainViewer',
    });
    const before = map.getLayer('lodge-dot') ? 'lodge-dot' : (map.getLayer('storm-ring') ? 'storm-ring' : undefined);
    map.addLayer({
      id,
      type: 'raster',
      source: id,
      paint: { 'raster-opacity': id === 'radar' ? 0.95 : 0.45, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
    }, before);
  } catch { /* style mid-swap */ }
}

async function loadLodging(map: MapLibreMap, r: any, onStatus?: (s: LayerStatus['lodging']) => void) {
  if (lodgingCache[r.id]) {
    (map.getSource('lodging') as any)?.setData(lodgingCache[r.id]);
    onStatus?.(lodgingCache[r.id].features?.length ? 'ready' : 'empty');
    return;
  }
  onStatus?.('loading');
  const [lon, lat] = r.center;
  const q = `[out:json][timeout:12];(nwr["tourism"~"hotel|chalet|guest_house|apartment"](around:7000,${lat},${lon}););out center 30;`;
  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(q),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const features = (json.elements || []).map((el: any) => {
      const c = el.center || (el.lat != null ? { lat: el.lat, lon: el.lon } : null);
      if (!c) return null;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { name: el.tags?.name || 'Lodging (OSM)' } };
    }).filter(Boolean);
    const fc = { type: 'FeatureCollection', features };
    lodgingCache[r.id] = fc;
    (map.getSource('lodging') as any)?.setData(fc);
    onStatus?.(features.length ? 'ready' : 'empty');
  } catch {
    (map.getSource('lodging') as any)?.setData({ type: 'FeatureCollection', features: [] });
    onStatus?.('error');
  } finally {
    window.clearTimeout(timer);
  }
}

import { forwardRef, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import { windowMetrics } from '../../lib/snowWindow.js';
import { snowAmount } from '@/lib/format';
import { buildStyle } from '@/lib/mapStyle';

const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const EXAG = 1.35;
const lodgingCache: Record<string, any> = {};
const osmCache: Record<string, Promise<any>> = {};

export type GlobeHandle = {
  flyHome: () => void;
  flyRegion: (g: any) => void;
  flyResort: (r: any) => void;
};

function padForSheet() {
  const mobile = typeof window !== 'undefined' && window.innerWidth < 900;
  return mobile
    ? { top: 90, bottom: Math.round(window.innerHeight * 0.42), left: 16, right: 16 }
    : { top: 80, bottom: 80, left: 40, right: 40 };
}

export const GlobeMap = forwardRef(function GlobeMap(
  {
    resorts, snow, typical, fire, win, units, lodgingOn, selectedId, onSelect,
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
  },
  ref: Ref<GlobeHandle>,
) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const terrainOn = useRef(false);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
      map.flyTo({ center: g.center, zoom: g.zoom, pitch: g.pitch || 28, bearing: 0, duration: 2400, essential: true, curve: 1.5, padding: padForSheet() });
    },
    flyResort(r) {
      const map = mapRef.current;
      if (!map || !r) return;
      const [x0, y0, x1, y1] = r.bbox || [r.center[0] - 0.2, r.center[1] - 0.15, r.center[0] + 0.2, r.center[1] + 0.15];
      const pad = padForSheet();
      const cam = map.cameraForBounds([[x0, y0], [x1, y1]], { padding: pad });
      const z = r.id === 'eagle-point' ? 11.9 : Math.min(13.6, Math.max(11.2, (cam?.zoom ?? 12) - 0.2));
      syncTerrain(map);
      map.flyTo({ center: [(x0 + x1) / 2, (y0 + y1) / 2], zoom: z, pitch: window.innerWidth < 900 ? 58 : 64, bearing: r.bearing || 0, duration: 2800, essential: true, curve: 1.4, padding: pad });
      loadOSM(map, r.id);
    },
  }));

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const contourUrl: string | undefined = undefined;
    const map = new MapLibreMap({
      container: el.current,
      hash: false,
      attributionControl: false,
      maxPitch: 80,
      center: [-30, 28],
      zoom: 1.55,
      pitch: 0,
      bearing: 0,
      projection: { type: 'globe' },
      style: buildStyle({ contourUrl, fire }) as any,
    });
    map.addControl(new AttributionControl({ compact: true, customAttribution: 'Snow: <a href="https://open-meteo.com">Open-Meteo</a> (NOAA GFS/HRRR, ECMWF, ERA5)' }), 'top-left');
    mapRef.current = map;

    map.on('load', () => {
      ready.current = true;
      try {
        import('maplibre-contour').then(mlcontour => {
          const demSource = new mlcontour.default.DemSource({ url: DEM, encoding: 'terrarium', maxzoom: 13, worker: true });
          demSource.setupMaplibre({ Map: MapLibreMap } as any);
        }).catch(() => { /* contours stay off */ });
      } catch { /* */ }
    });
    map.on('click', e => {
      const P = 24, { x, y } = e.point;
      const f = map.queryRenderedFeatures([[x - P, y - P], [x + P, y + P]], { layers: ['resort-hit', 'resort-dot', 'resort-label'] });
      if (!f.length) return;
      f.sort((a, b) => {
        const pa = map.project((a.geometry as any).coordinates);
        const pb = map.project((b.geometry as any).coordinates);
        return Math.hypot(pa.x - x, pa.y - y) - Math.hypot(pb.x - x, pb.y - y);
      });
      onSelectRef.current(f[0].properties.id);
    });
    map.on('mousemove', e => {
      const P = 16, { x, y } = e.point;
      map.getCanvas().style.cursor = map.queryRenderedFeatures([[x - P, y - P], [x + P, y + P]], { layers: ['resort-hit', 'resort-label'] }).length ? 'pointer' : '';
    });
    map.on('zoomend', () => syncTerrain(map));
    map.on('moveend', () => syncTerrain(map));

    return () => {
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, [fire]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !snow) return;
    const paint = () => {
      if (!map.getSource('resorts')) return;
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
          const lbl = r.id === 'eagle-point' ? 'Closed 26/27' : `${snowAmount(v, units)}${m.usedTypical ? ' typ' : ''}`;
          return { type: 'Feature', geometry: { type: 'Point', coordinates: r.center }, properties: { id: r.id, pass: (r.passes || []).join('+'), name: r.name.replace(/ \(.*\)/, ''), v, lbl } };
        }),
      });
    };
    if (map.loaded()) paint();
    else map.once('load', paint);
  }, [resorts, snow, typical, win, units]);

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
        (map.getSource('lodging') as any)?.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const r = resorts.find(x => x.id === selectedId);
      if (r) loadLodging(map, r);
    };
    if (map.loaded()) apply();
    else map.once('load', apply);
  }, [lodgingOn, selectedId, resorts]);

  return <div ref={el} className="absolute inset-0" data-testid="globe" />;
});

function syncTerrain(map: MapLibreMap) {
  const z = map.getZoom();
  if (z >= 6) {
    try { map.setTerrain({ source: 'dem', exaggeration: EXAG }); } catch { /* globe+terrain unsupported */ }
  } else {
    try { map.setTerrain(null); } catch { /* */ }
  }
}

async function loadOSM(map: MapLibreMap, id: string) {
  if (!osmCache[id]) osmCache[id] = fetch(`/data/resorts/${id}.json`).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }));
  const loaded = await Promise.all(Object.values(osmCache));
  (map.getSource('osm') as any)?.setData({ type: 'FeatureCollection', features: loaded.flatMap((f: any) => f.features || []) });
}

async function loadLodging(map: MapLibreMap, r: any) {
  if (lodgingCache[r.id]) {
    (map.getSource('lodging') as any)?.setData(lodgingCache[r.id]);
    return;
  }
  const [lon, lat] = r.center;
  const q = `[out:json][timeout:20];(nwr["tourism"~"hotel|chalet|guest_house|apartment"](around:7000,${lat},${lon}););out center 30;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
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
  } catch {
    (map.getSource('lodging') as any)?.setData({ type: 'FeatureCollection', features: [] });
  }
}

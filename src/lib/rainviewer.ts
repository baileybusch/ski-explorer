/**
 * RainViewer radar + infrared satellite tiles.
 * Free, no key. Personal/educational API: https://www.rainviewer.com/api.html
 * Color 6 = NEXRAD Level III (readable on a dark globe). Smooth + snow.
 * Mosaic max zoom 7; MapLibre overzooms past that. Empty tiles (~300B) mean
 * clear / no echo at that cell, not a failed mosaic.
 */
export const RADAR_COLOR = 6;
export const RADAR_OPTIONS = '1_1';
export const RADAR_MAXZOOM = 7;
export const RADAR_EMPTY_BYTES = 500;
let maps: any = null;
let mapsAt = 0;

export async function rainviewerMaps() {
  if (maps && Date.now() - mapsAt < 5 * 60 * 1000) return maps;
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error('RainViewer ' + res.status);
  maps = await res.json();
  mapsAt = Date.now();
  return maps;
}

export function radarFrames(mapsJson: any) {
  return [...(mapsJson?.radar?.past || []), ...(mapsJson?.radar?.nowcast || [])].filter((f: any) => f?.path);
}

export function satelliteFrames(mapsJson: any) {
  return (mapsJson?.satellite?.infrared || []).filter((f: any) => f?.path);
}

export function radarAvailable(mapsJson: any) {
  return radarFrames(mapsJson).length > 0;
}

export function satelliteAvailable(mapsJson: any) {
  return satelliteFrames(mapsJson).length > 0;
}

export function radarTileUrl(mapsJson: any) {
  const host = mapsJson?.host || 'https://tilecache.rainviewer.com';
  const frames = radarFrames(mapsJson);
  const last = frames[frames.length - 1];
  if (!last?.path) return null;
  return `${host}${last.path}/256/{z}/{x}/{y}/${RADAR_COLOR}/${RADAR_OPTIONS}.png`;
}

export function satelliteTileUrl(mapsJson: any) {
  const host = mapsJson?.host || 'https://tilecache.rainviewer.com';
  const frames = satelliteFrames(mapsJson);
  const last = frames[frames.length - 1];
  if (!last?.path) return null;
  return `${host}${last.path}/256/{z}/{x}/{y}/0/0_0.png`;
}

export function lon2tile(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * (2 ** z));
}

export function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * (2 ** z));
}

export function fillTile(tmpl: string | null, lon: number, lat: number, z: number) {
  if (!tmpl) return null;
  return tmpl
    .replace('{z}', String(z))
    .replace('{x}', String(lon2tile(lon, z)))
    .replace('{y}', String(lat2tile(lat, z)));
}

export function radarPointUrl(mapsJson: any, lon: number, lat: number, z = 6) {
  return fillTile(radarTileUrl(mapsJson), lon, lat, z);
}

export function radarFrameUrls(mapsJson: any, lon: number, lat: number, z = 7) {
  const host = mapsJson.host || 'https://tilecache.rainviewer.com';
  const frames = [...(mapsJson.radar?.past || []), ...(mapsJson.radar?.nowcast || [])];
  const x = lon2tile(lon, z);
  const y = lat2tile(lat, z);
  return frames.filter((f: any) => f.path).map((f: any) => `${host}${f.path}/256/${z}/${x}/${y}/${RADAR_COLOR}/${RADAR_OPTIONS}.png`);
}

export type RadarCover = 'unavailable' | 'error' | 'clear' | 'precip';

/** Distinguish mosaic-up-but-clear from mosaic-down. Empty RainViewer cells are tiny transparent PNGs. */
export async function probeRadarTile(mapsJson: any, lon: number, lat: number, z = 6): Promise<{ kind: RadarCover; bytes?: number; url?: string | null }> {
  if (!radarAvailable(mapsJson)) return { kind: 'unavailable', url: null };
  const url = radarPointUrl(mapsJson, lon, lat, z);
  if (!url) return { kind: 'unavailable', url: null };
  try {
    const res = await fetch(url);
    if (!res.ok) return { kind: 'error', url };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < RADAR_EMPTY_BYTES) return { kind: 'clear', bytes: buf.byteLength, url };
    return { kind: 'precip', bytes: buf.byteLength, url };
  } catch {
    return { kind: 'error', url };
  }
}

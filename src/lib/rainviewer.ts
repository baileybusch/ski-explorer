/**
 * RainViewer radar + infrared satellite tiles.
 * Free, no key. Attribution required: https://www.rainviewer.com/api.html
 * Color scheme 2, smooth, snow on.
 */
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

export function radarTileUrl(mapsJson: any) {
  const host = mapsJson.host || 'https://tilecache.rainviewer.com';
  const frames = [...(mapsJson.radar?.past || []), ...(mapsJson.radar?.nowcast || [])];
  const last = frames[frames.length - 1];
  if (!last?.path) return null;
  return `${host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

export function satelliteTileUrl(mapsJson: any) {
  const host = mapsJson.host || 'https://tilecache.rainviewer.com';
  const frames = mapsJson.satellite?.infrared || [];
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
  return frames.filter((f: any) => f.path).map((f: any) => `${host}${f.path}/256/${z}/${x}/${y}/2/1_1.png`);
}

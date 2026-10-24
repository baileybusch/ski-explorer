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

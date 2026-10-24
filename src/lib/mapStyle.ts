/** MapLibre style: globe night + sat + snow heatmap + pins. Contours optional. */

export function buildStyle({ contourUrl, fire }: { contourUrl?: string; fire?: any }) {
  const sources: any = {
    sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
    dark: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© CARTO © OpenStreetMap contributors' },
    dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], tileSize: 256, encoding: 'terrarium', maxzoom: 15, attribution: 'Terrain: Mapzen/AWS Terrarium' },
    hs: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], tileSize: 256, encoding: 'terrarium', maxzoom: 15 },
    snow: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    resorts: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    osm: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Runs & lifts © <a href="https://openskimap.org">OpenSkiMap</a>, © OpenStreetMap contributors (ODbL)' },
    fire: { type: 'geojson', data: fire || { type: 'FeatureCollection', features: [] }, attribution: 'Fire perimeter: NIFC WFIGS' },
    lodging: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Lodging © OpenStreetMap contributors (ODbL) via Overpass' },
  };
  if (contourUrl) {
    sources.contours = { type: 'vector', tiles: [contourUrl], maxzoom: 15 };
  }

  const layers: any[] = [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b0f17' } },
    { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
    { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-brightness-max': 0.82, 'raster-saturation': -0.25, 'raster-contrast': 0.05 } },
    { id: 'hillshade', type: 'hillshade', source: 'hs', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#05070c', 'hillshade-highlight-color': 'rgba(255,255,255,.25)' } },
  ];
  if (contourUrl) {
    layers.push(
      { id: 'contours', type: 'line', source: 'contours', 'source-layer': 'contours', layout: { visibility: 'none' }, paint: { 'line-color': 'rgba(230,210,170,.55)', 'line-width': ['match', ['get', 'level'], 1, 1.1, 0.5] } },
      { id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0], layout: { visibility: 'none', 'symbol-placement': 'line', 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], "'"], 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: { 'text-color': 'rgba(240,225,190,.9)', 'text-halo-color': 'rgba(0,0,0,.6)', 'text-halo-width': 1 } },
    );
  }
  layers.push(
    { id: 'fire-fill', type: 'fill', source: 'fire', paint: { 'fill-color': '#ff4d1f', 'fill-opacity': 0.28 } },
    { id: 'fire-line', type: 'line', source: 'fire', paint: { 'line-color': '#ff7a45', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 2.5], 'line-opacity': .95 } },
    { id: 'snow', type: 'heatmap', source: 'snow', paint: {
      'heatmap-weight': ['min', 1, ['/', ['get', 'v'], 60]],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 4, 0.6, 10, 0.9, 14, 1.1],
      'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 1, 3, 4, 6, 8, 20, 10, 60, 12, 200, 14, 800],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 4, 0.85, 9, 0.7, 12, 0.42, 15, 0.3],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(120,190,255,0)', 0.08, 'rgba(120,190,255,.25)', 0.3, 'rgba(140,205,255,.55)', 0.55, 'rgba(210,235,255,.75)', 0.8, 'rgba(255,255,255,.85)', 1, 'rgba(225,190,255,.95)'] } },
    { id: 'runs-case', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'run'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.55)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.6, 16, 5] } },
    { id: 'runs', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'run'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3.5],
      'line-color': ['match', ['get', 'd'], 'novice', '#3ddc84', 'easy', '#3ddc84', 'intermediate', '#3d8bff', 'advanced', '#111', 'expert', '#111', 'freeride', '#ff9f1a', '#9aa4b2'] } },
    { id: 'lifts', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'lift'], paint: { 'line-color': '#ff5a5f', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 2.6], 'line-dasharray': [3, 1] } },
    { id: 'run-labels', type: 'symbol', source: 'osm', minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.75)', 'text-halo-width': 1.2 } },
    { id: 'lodge-dot', type: 'circle', source: 'lodging', layout: { visibility: 'none' }, paint: { 'circle-radius': 6, 'circle-color': '#f0c27a', 'circle-stroke-color': 'rgba(10,14,22,.8)', 'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'viewport' } },
    { id: 'lodge-label', type: 'symbol', source: 'lodging', minzoom: 11, layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top' }, paint: { 'text-color': '#f6e6c4', 'text-halo-color': 'rgba(5,8,14,.85)', 'text-halo-width': 1 } },
    { id: 'resort-hit', type: 'circle', source: 'resorts', paint: { 'circle-radius': 26, 'circle-opacity': 0, 'circle-pitch-alignment': 'viewport' } },
    { id: 'resort-dot', type: 'circle', source: 'resorts', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 3, 4.5, 9, 7], 'circle-color': ['case', ['==', ['get', 'id'], 'eagle-point'], '#ff6b3d', ['==', ['get', 'pass'], 'ikon+epic'], '#7cf0c8', ['==', ['get', 'pass'], 'epic'], '#8fb8ff', '#ffe08a'], 'circle-stroke-color': 'rgba(10,14,22,.8)', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'viewport' } },
    { id: 'resort-label', type: 'symbol', source: 'resorts', layout: { 'text-field': ['format', ['get', 'name'], { 'font-scale': 1 }, '\n', {}, ['get', 'lbl'], { 'font-scale': 0.92, 'text-color': '#bfe3ff' }], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 4, 10, 10, 13], 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-allow-overlap': false, 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'v']] }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(5,8,14,.85)', 'text-halo-width': 1.4 } },
  );

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sky: { 'sky-color': '#0d1626', 'horizon-color': '#3a4a66', 'fog-color': '#1a2436', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.9, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0] },
    sources,
    layers,
  };
}

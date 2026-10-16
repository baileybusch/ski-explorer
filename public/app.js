const $ = s => document.querySelector(s);
const IN = cm => cm / 2.54, FT = m => m * 3.28084;
const fmtIn = cm => { const v = IN(cm); return v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10); };
const fmtFt = m => m == null ? '—' : Math.round(FT(m)).toLocaleString();
const isDesk = () => matchMedia('(min-width:900px)').matches;

const [IDX, SNOW0, FIRE] = await Promise.all(['data/resorts-index.json', 'data/snow.json', 'data/cottonwood-fire.json'].map(u => fetch(u).then(r => r.json())));
const SNOW = SNOW0;
const D = SNOW.dates.length, TODAY = SNOW.today;
const byId = Object.fromEntries(IDX.map(r => [r.id, r]));
for (const r of IDX) {
  const s = SNOW.resorts[r.id] || { sf: Array(D).fill(0), depth: [] };
  r.sf = s.sf; r.depth = s.depth;
  const sum = (a, b) => r.sf.slice(a, b).reduce((x, y) => x + y, 0);
  r.d1 = sum(TODAY, TODAY + 1) ; r.d24 = r.sf[TODAY - 1] ?? 0; r.d7 = sum(TODAY - 6, TODAY + 1); r.d30 = sum(0, TODAY + 1); r.fc = sum(TODAY + 1, D);
  r.base_depth = r.depth[TODAY];
}
const sorted = [...IDX].sort((a, b) => b.d7 - a.d7 || b.d30 - a.d30);

// ---------- map ----------
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const demSource = new mlcontour.DemSource({ url: DEM, encoding: 'terrarium', maxzoom: 13, worker: true });
demSource.setupMaplibre(maplibregl);
const start = byId['eagle-point'];
const map = new maplibregl.Map({
  container: 'map', hash: false, attributionControl: false, maxPitch: 80,
  center: [-111.2, 40.2], zoom: 5.6, pitch: 45, bearing: 0,
  style: {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sky: { 'sky-color': '#0d1626', 'horizon-color': '#3a4a66', 'fog-color': '#1a2436', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.9, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0] },
    sources: {
      sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
      dark: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© CARTO © OpenStreetMap contributors' },
      dem: { type: 'raster-dem', tiles: [DEM], tileSize: 256, encoding: 'terrarium', maxzoom: 15, attribution: 'Terrain: Mapzen/AWS Terrarium' },
      hs: { type: 'raster-dem', tiles: [DEM], tileSize: 256, encoding: 'terrarium', maxzoom: 15 },
      contours: { type: 'vector', tiles: [demSource.contourProtocolUrl({ multiplier: 3.28084, thresholds: { 10: [500, 2500], 12: [200, 1000], 13: [100, 500], 14: [50, 250] }, elevationKey: 'ele', levelKey: 'level', contourLayer: 'contours' })], maxzoom: 15 },
      snow: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      resorts: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      osm: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Runs & lifts © <a href="https://openskimap.org">OpenSkiMap</a>, © OpenStreetMap contributors (ODbL)' },
      fire: { type: 'geojson', data: FIRE, attribution: 'Fire perimeter: NIFC WFIGS' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b0f17' } },
      { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
      { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-brightness-max': 0.82, 'raster-saturation': -0.25, 'raster-contrast': 0.05 } },
      { id: 'hillshade', type: 'hillshade', source: 'hs', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#05070c', 'hillshade-highlight-color': 'rgba(255,255,255,.25)' } },
      { id: 'contours', type: 'line', source: 'contours', 'source-layer': 'contours', layout: { visibility: 'none' }, paint: { 'line-color': 'rgba(230,210,170,.55)', 'line-width': ['match', ['get', 'level'], 1, 1.1, 0.5] } },
      { id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0], layout: { visibility: 'none', 'symbol-placement': 'line', 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], "'"], 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: { 'text-color': 'rgba(240,225,190,.9)', 'text-halo-color': 'rgba(0,0,0,.6)', 'text-halo-width': 1 } },
      { id: 'fire-fill', type: 'fill', source: 'fire', paint: { 'fill-color': '#ff4d1f', 'fill-opacity': 0.28 } },
      { id: 'fire-line', type: 'line', source: 'fire', paint: { 'line-color': '#ff7a45', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 2.5], 'line-opacity': .95 } },
      { id: 'snow', type: 'heatmap', source: 'snow', paint: {
        'heatmap-weight': ['min', 1, ['/', ['get', 'v'], 60]],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 0.9, 14, 1.1],
        'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 4, 6, 8, 20, 10, 60, 12, 200, 14, 800],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.85, 9, 0.7, 12, 0.42, 15, 0.3],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(120,190,255,0)', 0.08, 'rgba(120,190,255,.25)', 0.3, 'rgba(140,205,255,.55)', 0.55, 'rgba(210,235,255,.75)', 0.8, 'rgba(255,255,255,.85)', 1, 'rgba(225,190,255,.95)'] } },
      { id: 'runs-case', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'run'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.55)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.6, 16, 5] } },
      { id: 'runs', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'run'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3.5],
        'line-color': ['match', ['get', 'd'], 'novice', '#3ddc84', 'easy', '#3ddc84', 'intermediate', '#3d8bff', 'advanced', '#111', 'expert', '#111', 'freeride', '#ff9f1a', '#9aa4b2'] } },
      { id: 'lifts', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'lift'], paint: { 'line-color': '#ff5a5f', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 2.6], 'line-dasharray': [3, 1] } },
      { id: 'run-labels', type: 'symbol', source: 'osm', minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.75)', 'text-halo-width': 1.2 } },
      { id: 'resort-dot', type: 'circle', source: 'resorts', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 9, 7], 'circle-color': ['case', ['==', ['get', 'id'], 'eagle-point'], '#ff6b3d', '#fff'], 'circle-stroke-color': 'rgba(10,14,22,.8)', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'viewport' } },
      { id: 'resort-label', type: 'symbol', source: 'resorts', layout: { 'text-field': ['format', ['get', 'name'], { 'font-scale': 1 }, '\n', {}, ['get', 'lbl'], { 'font-scale': 0.92, 'text-color': '#bfe3ff' }], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 13], 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-allow-overlap': false, 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'v']] }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(5,8,14,.85)', 'text-halo-width': 1.4 } },
    ],
  },
});
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Snow: <a href="https://open-meteo.com">Open-Meteo</a> (NOAA GFS/HRRR, ECMWF)' }), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: false }), 'top-right');

// ---------- timeline ----------
let T = TODAY;
const fmtDate = (i, wd = true) => new Date(SNOW.dates[i] + 'T12:00').toLocaleDateString('en-US', wd ? { month: 'short', day: 'numeric', weekday: 'short' } : { month: 'short', day: 'numeric' });
const totals = SNOW.dates.map((_, i) => IDX.reduce((a, r) => a + (r.sf[i] || 0), 0) / IDX.length);
const maxTot = Math.max(...totals, 0.5);
$('#tlBars').innerHTML = totals.map((v, i) => `<i class="${i > TODAY ? 'f' : ''}" style="height:${Math.max(8, v / maxTot * 100)}%"></i>`).join('');
const bars = [...$('#tlBars').children];
$('#tlFc').style.left = `${(TODAY + 1) / D * 100}%`;
$('#scrub').max = D - 1;
let selected = null;
function accum(sf, t) { let a = 0; const fl = Math.floor(t); for (let i = 0; i <= fl && i < D; i++) a += sf[i] || 0; if (fl + 1 < D) a += (sf[fl + 1] || 0) * (t - fl); return a; }
function render() {
  const fl = Math.round(T);
  $('#tlDate').textContent = fmtDate(fl, isDesk());
  const tag = $('#tlTag'); tag.textContent = fl === TODAY ? 'Today' : fl > TODAY ? 'Forecast' : ''; tag.className = fl > TODAY ? 'fc' : '';
  $('#tlToday').style.left = `${(T + 0.5) / D * 100}%`;
  bars.forEach((b, i) => b.classList.toggle('on', i <= fl));
  const tgt = selected || null;
  const tot = tgt ? accum(tgt.sf, T) : null;
  $('#tlTotal').innerHTML = tgt ? `<span class="hide-s">${tgt.name.split(' (')[0]} </span><b>${fmtIn(tot)}″</b> <span class="hide-s">since ${fmtDate(0).split(', ')[1]}</span>` : `<b>${SNOW.dates.length - TODAY - 1}d</b> forecast`;
  map.getSource('snow')?.setData({ type: 'FeatureCollection', features: SNOW.grid.map(([x, y, sf]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: { v: accum(sf, T) } })) });
  map.getSource('resorts')?.setData({ type: 'FeatureCollection', features: IDX.map(r => { const v = accum(r.sf, T); return { type: 'Feature', geometry: { type: 'Point', coordinates: r.center }, properties: { id: r.id, name: r.name.replace(/ \(.*\)/, ''), v, lbl: r.id === 'eagle-point' ? 'Closed 26/27' : `${fmtIn(v)}″` } }; }) });
}
let playing = false, last = 0;
function tick(ts) { if (!playing) return; const dt = last ? (ts - last) / 1000 : 0; last = ts; T += dt * 3; if (T >= D - 1) { T = D - 1; stop(); } $('#scrub').value = T; render(); if (playing) requestAnimationFrame(tick); }
function stop() { playing = false; $('#play').classList.remove('on'); }
$('#play').onclick = () => { if (playing) return stop(); if (T >= D - 1.01) T = 0; playing = true; last = 0; $('#play').classList.add('on'); requestAnimationFrame(tick); };
$('#scrub').addEventListener('input', e => { stop(); T = +e.target.value; render(); });

// ---------- sheet ----------
const sheet = $('#sheet');
function sparkSVG(r) {
  const m = Math.max(...r.sf, 1), w = 70, h = 26, bw = w / D;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}">${r.sf.map((v, i) => `<rect x="${i * bw}" y="${h - Math.max(1, v / m * h)}" width="${bw - .5}" height="${Math.max(1, v / m * h)}" rx=".6" fill="${i > TODAY ? '#c48cff' : i === TODAY ? '#fff' : '#7cc4ff'}" opacity="${i > TODAY ? .7 : 1}"/>`).join('')}</svg>`;
}
$('#countPill').textContent = `${IDX.length} areas`;
$('#list').innerHTML = sorted.map((r, i) => `<div class="row" data-id="${r.id}"><div class="rk">${i + 1}</div><div class="nm"><b>${r.name}</b><span class="dim small">${r.state} · ${r.id === 'eagle-point' ? '<span class="tag fire">BURN SCAR</span>' : '<span class="tag">IKON</span>'} ${r.ikon.replace(/^Not Ikon · featured$/, '')}</span></div>${sparkSVG(r)}<div class="val"><b>${fmtIn(r.d7)}″</b><div class="dim small">7 day</div></div></div>`).join('');
$('#list').onclick = e => { const row = e.target.closest('.row'); if (row) select(row.dataset.id); };
$('#credits').innerHTML = `Snow: Open-Meteo forecast API (NOAA GFS/HRRR + ECMWF models), updated ${new Date(SNOW.generated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Runs/lifts: OpenSkiMap / OSM (ODbL). Terrain: AWS Terrarium. Imagery: Esri. Fire: NIFC WFIGS. <a href="https://github.com/baileybusch/ski-explorer">Source</a>`;

const SNAPS = { peek: () => getPeek(), half: () => Math.round(innerHeight * 0.42), full: () => sheet.offsetHeight };
function getPeek() { return 150 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sbpx')) || 0); }
function setSnap(s) {
  if (isDesk()) return;
  sheet.dataset.snap = s; const h = SNAPS[s]();
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
  sheet.style.transform = `translateY(${sheet.offsetHeight - h}px)`;
  document.body.classList.toggle('sheet-full', s === 'full');
}
// measure safe-area bottom
const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden'; document.body.appendChild(probe);
document.documentElement.style.setProperty('--sbpx', probe.offsetHeight);
let drag = null;
sheet.addEventListener('pointerdown', e => {
  if (isDesk()) return;
  const body = $('#sheetBody');
  const onGrab = e.target.closest('#grab') || sheet.dataset.snap !== 'full' || body.scrollTop <= 0;
  if (!onGrab) return;
  drag = { y: e.clientY, h: SNAPS[sheet.dataset.snap](), moved: false, t: performance.now(), id: e.pointerId, fromBody: !e.target.closest('#grab') };
});
addEventListener('pointermove', e => {
  if (!drag) return; const dy = e.clientY - drag.y;
  if (!drag.moved) { if (Math.abs(dy) < 6) return; if (drag.fromBody && sheet.dataset.snap === 'full' && dy < 0) { drag = null; return; } drag.moved = true; sheet.classList.add('drag'); }
  const h = Math.min(sheet.offsetHeight, Math.max(getPeek() * 0.7, drag.h - dy)); drag.cur = h;
  sheet.style.transform = `translateY(${sheet.offsetHeight - h}px)`;
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
});
addEventListener('pointerup', e => {
  if (!drag) return; const d = drag; drag = null; sheet.classList.remove('drag');
  if (!d.moved) { if (e.target.closest('#grab')) setSnap(sheet.dataset.snap === 'peek' ? 'half' : 'peek'); return; }
  const v = (e.clientY - d.y) / (performance.now() - d.t);
  const opts = Object.entries(SNAPS).map(([k, f]) => [k, f()]);
  let target = opts.reduce((a, b) => Math.abs(b[1] - d.cur) < Math.abs(a[1] - d.cur) ? b : a)[0];
  if (Math.abs(v) > 0.5) { const order = ['peek', 'half', 'full']; const i = order.indexOf(sheet.dataset.snap); target = order[Math.max(0, Math.min(2, i + (v < 0 ? 1 : -1)))]; }
  setSnap(target);
});
addEventListener('resize', () => setSnap(sheet.dataset.snap || 'peek'));

// ---------- detail ----------
const osmCache = {};
async function loadOSM(id) {
  if (!osmCache[id]) osmCache[id] = fetch(`data/resorts/${id}.json`).then(r => r.json());
  const fc = await osmCache[id];
  const loaded = await Promise.all(Object.values(osmCache));
  map.getSource('osm').setData({ type: 'FeatureCollection', features: loaded.flatMap(f => f.features) });
  return fc;
}
function chartSVG(r) {
  const w = 340, h = 80, m = Math.max(...r.sf, 1), bw = w / D;
  let acc = 0; const pts = r.sf.map((v, i) => (acc += v, [i * bw + bw / 2, acc]));
  const am = Math.max(acc, 1);
  const line = pts.map(([x, a]) => `${x.toFixed(1)},${(h - 4 - a / am * (h - 14)).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
  ${r.sf.map((v, i) => `<rect x="${i * bw + .5}" y="${h - Math.max(1, v / m * (h - 20))}" width="${bw - 1.5}" height="${Math.max(1, v / m * (h - 20))}" rx="1" fill="${i > TODAY ? '#c48cff' : '#7cc4ff'}" opacity=".85"/>`).join('')}
  <polyline points="${line}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9" vector-effect="non-scaling-stroke"/></svg>
  <div class="dim small" style="display:flex;justify-content:space-between"><span>${fmtDate(0)}</span><span>Today</span><span>${fmtDate(D - 1)}</span></div>`;
}
const FIREHTML = `<div class="firecard"><h3>🔥 2026 Cottonwood Fire</h3><div class="dim small">Burn perimeter shown on map (NIFC WFIGS). Toggle under Layers.</div>
<div class="grid"><div class="stat"><b>97,464</b><span>acres burned</span></div><div class="stat"><b>~300</b><span>of 600 skiable ac</span></div><div class="stat"><b>4<small>/5</small></b><span>lifts affected</span></div></div>
<ul><li>Started <b>June 22, 2026</b>; 100% contained <b>Sept 1</b></li><li>Canyonside Lodge destroyed</li><li>Resort <b>closed for 2026–27</b>; targeting reopening <b>Nov 2027</b></li></ul>
<div class="links"><a href="https://www.eaglepointresort.com/eagle-point-resort-announces-2026-27-winter-season-closure-following-cottonwood-fire/" target="_blank" rel="noopener">Resort announcement ↗</a><a href="https://inciweb.wildfire.gov/incident-information/utfif-cottonwood-fire" target="_blank" rel="noopener">InciWeb ↗</a></div></div>`;
function detailHTML(r) {
  const fc = r.sf.slice(TODAY + 1);
  const fm = Math.max(...fc, 1);
  const vert = r.summit && r.base ? r.summit - r.base : null;
  return `<button class="back" id="back"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>All resorts</button>
  <div class="dh"><div><h2>${r.name}</h2><div class="dim" style="margin-top:4px">${r.state} · ${r.id === 'eagle-point' ? '<span class="tag fire">CLOSED 26/27</span> Not on Ikon' : `<span class="tag">IKON</span> ${r.ikon}`}</div></div></div>
  <div class="grid">
    <div class="stat"><b>${fmtIn(r.d24)}<small>″</small></b><span>Last 24h</span></div>
    <div class="stat"><b>${fmtIn(r.d7)}<small>″</small></b><span>Last 7 days</span></div>
    <div class="stat"><b>${fmtIn(r.d30)}<small>″</small></b><span>Last 30 days</span></div>
    <div class="stat"><b>${r.base_depth == null ? '—' : fmtIn(r.base_depth)}<small>″</small></b><span>Snow depth*</span></div>
    <div class="stat"><b>${fmtIn(r.fc)}<small>″</small></b><span>Next 7 days</span></div>
    <div class="stat"><b>${vert ? fmtFt(vert) : '—'}<small>ft</small></b><span>Vertical</span></div>
  </div>
  <div class="sec">7-day forecast</div>
  <div class="fc">${fc.map((v, i) => `<div><span>${new Date(SNOW.dates[TODAY + 1 + i] + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })}</span><div class="bar"><i style="height:${Math.max(4, v / fm * 100)}%"></i></div><b>${fmtIn(v)}″</b></div>`).join('')}</div>
  <div class="sec">Snowfall · 30 days + forecast</div>${chartSVG(r)}
  ${r.id === 'eagle-point' ? FIREHTML : ''}
  <div class="sec">Mountain</div>
  <div class="grid">
    <div class="stat"><b>${fmtFt(r.summit)}<small>ft</small></b><span>Summit</span></div>
    <div class="stat"><b>${fmtFt(r.base)}<small>ft</small></b><span>Base</span></div>
    <div class="stat"><b>${r.lifts}</b><span>Lifts</span></div>
    <div class="stat"><b>${r.runs}</b><span>Runs (OSM)</span></div>
    <div class="stat"><b>${SNOW.resorts[r.id]?.elev ? fmtFt(SNOW.resorts[r.id].elev) : '—'}<small>ft</small></b><span>Snow model elev</span></div>
    <div class="stat"><b>${r.bearing}°</b><span>View bearing</span></div>
  </div>
  <div class="dim small" style="line-height:1.5">*Modeled snow depth at mid-mountain from Open-Meteo, not a resort-reported base. Elevations, lift and run counts from OpenSkiMap/OSM.</div>
  <div class="links" style="margin-top:12px">${r.web ? `<a href="${r.web}" target="_blank" rel="noopener">Resort site ↗</a>` : ''}<a href="https://openskimap.org/#13/${r.center[1]}/${r.center[0]}" target="_blank" rel="noopener">OpenSkiMap ↗</a></div>`;
}
const EXAG = 1.35;
// MapLibre doesn't re-anchor the camera's center elevation onto the terrain during flyTo, so set it up front
// while compensating zoom so the camera itself barely moves.
function setElev(e) {
  const old = map.getCenterElevation(), dz = e - old; if (Math.abs(dz) < 50) return;
  const z = map.getZoom(), lat = map.getCenter().lat, pitch = map.getPitch() * Math.PI / 180;
  const mpp = 40075016 * Math.cos(lat * Math.PI / 180) / (512 * 2 ** z);
  const d = (map.getCanvas().clientHeight / 2) / Math.tan(map.transform.fov * Math.PI / 360 || 0.3217) * mpp;
  const d2 = Math.max(800, d - dz / Math.max(0.3, Math.cos(pitch)));
  map.jumpTo({ elevation: e, zoom: z - Math.log2(d2 / d) });
}
function select(id, fly = true) {
  const r = byId[id]; if (!r) return; selected = r;
  $('#detailView').innerHTML = detailHTML(r);
  $('#listView').classList.add('hidden'); $('#detailView').classList.remove('hidden');
  $('#sheetBody').scrollTop = 0;
  $('#back').onclick = () => { selected = null; $('#detailView').classList.add('hidden'); $('#listView').classList.remove('hidden'); $('#searchLabel').textContent = 'Search resorts'; render(); };
  $('#searchLabel').textContent = r.name; $('#searchLabel').style.color = '#fff';
  loadOSM(id);
  if (fly) {
    const [x0, y0, x1, y1] = r.bbox;
    const pad = isDesk() ? { top: 60, bottom: 110, left: 400, right: 40 } : { top: 70, bottom: Math.round(innerHeight * 0.42) + 84, left: 16, right: 16 };
    const cam = map.cameraForBounds([[x0, y0], [x1, y1]], { padding: pad });
    const z = r.id === 'eagle-point' ? 11.9 : Math.min(13.6, Math.max(11.8, (cam?.zoom ?? 13) - 0.2));
    setElev(r.summit && r.base ? (r.summit * 0.4 + r.base * 0.6) * EXAG : 300);
    map.flyTo({ center: [(x0 + x1) / 2, (y0 + y1) / 2], zoom: z, pitch: isDesk() ? 64 : 60, bearing: r.bearing, duration: 3200, essential: true, curve: 1.6, padding: pad });
  }
  if (sheet.dataset.snap === 'peek' || sheet.dataset.snap === 'full') setSnap('half');
  render();
}
map.on('click', 'resort-dot', e => select(e.features[0].properties.id));
map.on('mouseenter', 'resort-dot', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'resort-dot', () => map.getCanvas().style.cursor = '');

// ---------- search ----------
const openSearch = () => { $('#search').classList.remove('hidden'); $('#q').value = ''; doSearch(); setTimeout(() => $('#q').focus(), 30); };
const closeSearch = () => { $('#search').classList.add('hidden'); $('#q').blur(); };
function doSearch() {
  const q = $('#q').value.trim().toLowerCase();
  const res = (q ? IDX.filter(r => (r.name + ' ' + r.state).toLowerCase().includes(q)) : sorted).slice(0, 30);
  $('#qResults').innerHTML = res.map(r => `<div class="qr" data-id="${r.id}"><span><b>${r.name}</b> <span class="dim small">${r.state}</span></span><span class="dim">${fmtIn(r.d7)}″ 7d</span></div>`).join('');
}
$('#searchBtn').onclick = openSearch; $('#qClose').onclick = closeSearch; $('#q').oninput = doSearch;
$('#search').onclick = e => { const it = e.target.closest('.qr'); if (it) { closeSearch(); select(it.dataset.id); } else if (e.target.id === 'search') closeSearch(); };
$('#q').onkeydown = e => { if (e.key === 'Enter') { const f = $('#qResults .qr'); if (f) { closeSearch(); select(f.dataset.id); } } if (e.key === 'Escape') closeSearch(); };

// ---------- layers ----------
$('#layersBtn').onclick = e => { e.stopPropagation(); $('#layers').classList.toggle('hidden'); };
document.addEventListener('click', e => { if (!e.target.closest('#layers,#layersBtn')) $('#layers').classList.add('hidden'); });
const LAYERS = { snow: ['snow'], runs: ['runs-case', 'runs', 'lifts', 'run-labels'], burn: ['fire-fill', 'fire-line'], contours: ['contours', 'contour-labels'], sat: ['sat'] };
document.querySelectorAll('#layers input').forEach(inp => inp.onchange = () => {
  const vis = inp.checked ? 'visible' : 'none';
  LAYERS[inp.dataset.layer].forEach(l => map.setLayoutProperty(l, 'visibility', vis));
  if (inp.dataset.layer === 'sat') map.setLayoutProperty('dark', 'visibility', inp.checked ? 'none' : 'visible');
});

// ---------- boot ----------
setSnap('peek');
map.on('load', () => {
  map.setTerrain({ source: 'dem', exaggeration: EXAG });
  render();
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  const want = new URLSearchParams(location.search).get('r') || location.hash.slice(1);
  setTimeout(() => select(byId[want] ? want : 'eagle-point'), 600);
});
window.__app = { map, select, setT: t => { T = t; $('#scrub').value = t; render(); } };

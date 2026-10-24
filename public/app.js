import { EMAIL_ALERTS_ENABLED, affiliateConfigured } from './config.js';
import { $, IN, fmtIn, fmtFt, isDesk, esc, addDays, fmtShort, C2F } from './lib/util.js';
import { searchAll, resortsForRegion } from './lib/search.js';
import { watchlist, isWatched, toggleWatch } from './lib/watchlist.js';
import { loadTrip, saveTrip, tripDates, interestingBlurb, buildPlan, planHandoffLinks, peopleLabel, partyOf } from './lib/trip.js';
import { flightQuote, lodgingQuote } from './lib/prices.js';
import { flightLinks, lodgingLinks, outboundHTML, parseTripQuery, shareSearch, shareURL } from './lib/links.js';
import { defaultWindow, forecastEnd, windowMetrics, weatherGlyph } from './lib/snowWindow.js';

const [IDX, SNOW0, FIRE, GAZ, TYPICAL] = await Promise.all([
  'data/resorts-index.json', 'data/snow.json', 'data/cottonwood-fire.json', 'data/gazetteer.json', 'data/typical.json',
].map((u, i) => fetch(u).then(r => r.ok ? r.json() : (i === 4 ? { windows: {} } : { regions: [] })).catch(() => (i === 4 ? { windows: {} } : i === 3 ? { regions: [] } : null))));
const SNOW = SNOW0;
const SUMMARY = await fetch('data/seasons/summary.json').then(r => r.ok ? r.json() : { seasons: [], totals: {} }).catch(() => ({ seasons: [], totals: {} }));
const D = SNOW.dates.length, TODAY = SNOW.today;
const REGIONS = GAZ.regions || [];
const byId = Object.fromEntries(IDX.map(r => [r.id, r]));
for (const r of IDX) {
  const s = SNOW.resorts[r.id] || { sf: Array(D).fill(0), depth: [], tmax: null };
  r.sf = s.sf; r.depth = s.depth; r.tmax = s.tmax; r.tmin = s.tmin; r.wcode = s.wcode;
  const sum = (a, b) => (r.sf || []).slice(a, b).reduce((x, y) => x + y, 0);
  r.d1 = sum(TODAY, TODAY + 1); r.d24 = r.sf[TODAY - 1] ?? 0; r.d7 = sum(TODAY - 6, TODAY + 1); r.d30 = sum(0, TODAY + 1); r.fc = sum(TODAY + 1, D);
  r.base_depth = r.depth?.[TODAY];
}

const PASSES = ['all', 'ikon', 'epic'];
const qs = new URLSearchParams(location.search);
const qsPass = qs.get('pass');
let PASS = PASSES.includes(qsPass) ? qsPass : (PASSES.includes(localStorage.getItem('ss_pass')) ? localStorage.getItem('ss_pass') : 'ikon');
const passOK = r => PASS === 'all' || (r.passes || []).includes(PASS);
const VIS = () => IDX.filter(r => passOK(r) && (!activeIds || activeIds.has(r.id)));
const passTags = r => r.id === 'eagle-point' ? '' : (r.passes || []).map(p => `<span class="tag ${p}">${p.toUpperCase()}</span>`).join(' ');
const passCount = p => p === 'all' ? IDX.length : IDX.filter(r => (r.passes || []).includes(p)).length;
const chipsHTML = () => PASSES.map(p => `<button data-pass="${p}" class="${p} ${PASS === p ? 'on' : ''}" aria-pressed="${PASS === p}">${p === 'all' ? 'Both' : p[0].toUpperCase() + p.slice(1)}<small>${passCount(p)}</small></button>`).join('');

let TRIP = loadTrip();
let WIN = defaultWindow(SNOW);
let activeRegion = null;
let activeIds = null;
let lodgingOn = false;
const lodgingCache = {};

const deep = parseTripQuery(qs);
function applyWhenQuery() {
  if (deep.from && deep.to) {
    const last = forecastEnd(SNOW);
    const typicalOnly = deep.from > last;
    WIN = { mode: 'custom', start: deep.from, end: deep.to, label: typicalOnly ? `typical ${fmtShort(deep.from)}–${fmtShort(deep.to)}` : `${fmtShort(deep.from)}–${fmtShort(deep.to)}`, usedTypicalOnly: typicalOnly };
    TRIP.start = deep.from; TRIP.end = deep.to;
  } else {
    const w = qs.get('when');
    if (!w) return;
    const [a, b] = w.split(',');
    if (a && b) { WIN = { mode: 'custom', start: a, end: b || a, label: `${fmtShort(a)}–${fmtShort(b || a)}` }; }
  }
}
if (deep.home) TRIP.home = deep.home;
if (deep.adults != null) TRIP.adults = deep.adults;
if (deep.kids != null) TRIP.kids = deep.kids;
applyWhenQuery();
saveTrip(TRIP);

const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const demSource = new mlcontour.DemSource({ url: DEM, encoding: 'terrarium', maxzoom: 13, worker: true });
demSource.setupMaplibre(maplibregl);

const map = new maplibregl.Map({
  container: 'map', hash: false, attributionControl: false, maxPitch: 80,
  center: [-30, 28], zoom: 1.55, pitch: 0, bearing: 0,
  projection: { type: 'globe' },
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
      lodging: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Lodging © OpenStreetMap contributors (ODbL) via Overpass' },
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
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 4, 0.6, 10, 0.9, 14, 1.1],
        'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 1, 3, 4, 6, 8, 20, 10, 60, 12, 200, 14, 800],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 4, 0.85, 9, 0.7, 12, 0.42, 15, 0.3],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(120,190,255,0)', 0.08, 'rgba(120,190,255,.25)', 0.3, 'rgba(140,205,255,.55)', 0.55, 'rgba(210,235,255,.75)', 0.8, 'rgba(255,255,255,.85)', 1, 'rgba(225,190,255,.95)'] } },
      { id: 'runs-case', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'run'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.55)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.6, 16, 5] } },
      { id: 'runs', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'run'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3.5],
        'line-color': ['match', ['get', 'd'], 'novice', '#3ddc84', 'easy', '#3ddc84', 'intermediate', '#3d8bff', 'advanced', '#111', 'expert', '#111', 'freeride', '#ff9f1a', '#9aa4b2'] } },
      { id: 'lifts', type: 'line', source: 'osm', filter: ['==', ['get', 'k'], 'lift'], paint: { 'line-color': '#ff5a5f', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 2.6], 'line-dasharray': [3, 1] } },
      { id: 'run-labels', type: 'symbol', source: 'osm', minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.75)', 'text-halo-width': 1.2 } },
      { id: 'lodge-dot', type: 'circle', source: 'lodging', paint: { 'circle-radius': 6, 'circle-color': '#f0c27a', 'circle-stroke-color': 'rgba(10,14,22,.8)', 'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'viewport' } },
      { id: 'lodge-label', type: 'symbol', source: 'lodging', minzoom: 11, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top' }, paint: { 'text-color': '#f6e6c4', 'text-halo-color': 'rgba(5,8,14,.85)', 'text-halo-width': 1 } },
      { id: 'resort-hit', type: 'circle', source: 'resorts', paint: { 'circle-radius': 26, 'circle-opacity': 0, 'circle-pitch-alignment': 'viewport' } },
      { id: 'resort-dot', type: 'circle', source: 'resorts', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 3, 4.5, 9, 7], 'circle-color': ['case', ['==', ['get', 'id'], 'eagle-point'], '#ff6b3d', ['==', ['get', 'pass'], 'ikon+epic'], '#7cf0c8', ['==', ['get', 'pass'], 'epic'], '#8fb8ff', '#ffe08a'], 'circle-stroke-color': 'rgba(10,14,22,.8)', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'viewport' } },
      { id: 'resort-label', type: 'symbol', source: 'resorts', layout: { 'text-field': ['format', ['get', 'name'], { 'font-scale': 1 }, '\n', {}, ['get', 'lbl'], { 'font-scale': 0.92, 'text-color': '#bfe3ff' }], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 4, 10, 10, 13], 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-allow-overlap': false, 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'v']] }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(5,8,14,.85)', 'text-halo-width': 1.4 } },
    ],
  },
});
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Snow: <a href="https://open-meteo.com">Open-Meteo</a> (NOAA GFS/HRRR, ECMWF, ERA5)' }), 'top-left');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: false }), 'top-right');

const CUR_SEASON = 2026;
const current = { key: 'cur', label: '2026–27', dates: SNOW.dates, today: TODAY, sf: Object.fromEntries(IDX.map(r => [r.id, r.sf])), grid: SNOW.grid };
let DS = current, T = TODAY, selected = null, terrainOn = false;
const seasonCache = {};

function syncTerrain() {
  const z = map.getZoom();
  if (z >= 6 && !terrainOn) {
    try { map.setTerrain({ source: 'dem', exaggeration: EXAG }); terrainOn = true; document.body.classList.remove('globe-home'); } catch { /* globe+terrain unsupported */ }
  } else if (z < 5 && terrainOn) {
    try { map.setTerrain(null); } catch { /* */ }
    terrainOn = false;
    document.body.classList.add('globe-home');
  }
  document.body.classList.toggle('globe-home', z < 5);
}

async function loadSeason(y) {
  stop();
  if (y === CUR_SEASON) { DS = current; T = TODAY; }
  else {
    seasonCache[y] ||= fetch(`data/seasons/${y}.json`).then(r => r.json());
    const s = await seasonCache[y];
    const start = new Date(s.start + 'T12:00');
    const dates = Array.from({ length: s.days }, (_, i) => new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10));
    DS = { key: y, label: `${y}–${String(y + 1).slice(2)}`, dates, today: dates.length - 1, sf: s.resorts, grid: null };
    T = 0;
  }
  $('#seasonChip span').textContent = DS.label;
  buildTimeline(); render();
  if (DS !== current) setTimeout(() => $('#play').click(), 350);
}

const nD = () => DS.dates.length;
const fmtDate = (i, wd = true) => new Date(DS.dates[i] + 'T12:00').toLocaleDateString('en-US', wd ? { month: 'short', day: 'numeric', weekday: 'short' } : { month: 'short', day: 'numeric' });
let bars = [];
function buildTimeline() {
  const vis = VIS(), n = nD(), tot = DS.dates.map((_, i) => vis.reduce((a, r) => a + ((DS.sf[r.id] || [])[i] || 0), 0) / Math.max(1, vis.length));
  const mx = Math.max(...tot, 0.5);
  $('#tlBars').innerHTML = tot.map((v, i) => `<i class="${i > DS.today ? 'f' : ''}" style="height:${Math.max(8, v / mx * 100)}%"></i>`).join('');
  bars = [...$('#tlBars').children];
  $('#tlFc').style.display = DS === current ? '' : 'none';
  $('#tlFc').style.left = `${(DS.today + 1) / n * 100}%`;
  $('#scrub').max = n - 1; $('#scrub').value = T;
}
function accum(sf, t) { if (!sf) return 0; let a = 0; const fl = Math.floor(t); for (let i = 0; i <= fl && i < sf.length; i++) a += sf[i] || 0; if (fl + 1 < sf.length) a += (sf[fl + 1] || 0) * (t - fl); return a; }
function render() {
  const fl = Math.round(T), n = nD();
  $('#tlDate').textContent = fmtDate(fl, isDesk());
  const tag = $('#tlTag');
  if (DS === current) { tag.textContent = fl === DS.today ? 'Today' : fl > DS.today ? 'Forecast' : ''; tag.className = fl > DS.today ? 'fc' : ''; }
  else { tag.textContent = DS.label; tag.className = 'past'; }
  $('#tlToday').style.left = `${(T + 0.5) / n * 100}%`;
  bars.forEach((b, i) => b.classList.toggle('on', i <= fl));
  const tot = selected ? accum(DS.sf[selected.id], T) : null;
  $('#tlTotal').innerHTML = selected ? `<span class="hide-s">${selected.name.split(' (')[0]} </span><b>${fmtIn(tot)}″</b>` : `<b>${DS === current ? `${n - DS.today - 1}d forecast` : 'All resorts'}</b>`;
  const vis = VIS();
  const pts = DS.grid ? DS.grid.filter(([x, y]) => vis.some(r => Math.hypot(r.center[0] - x, r.center[1] - y) < 3)).map(([x, y, sf]) => [x, y, accum(sf, T)]) : vis.map(r => [r.center[0], r.center[1], accum(DS.sf[r.id], T) / 6]);
  map.getSource('snow')?.setData({ type: 'FeatureCollection', features: pts.map(([x, y, v]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: { v } })) });
  map.getSource('resorts')?.setData({ type: 'FeatureCollection', features: vis.map(r => {
    const m = windowMetrics(r, SNOW, WIN, TYPICAL);
    const v = DS === current ? m.windowCm : accum(DS.sf[r.id], T);
    const lbl = r.id === 'eagle-point' && DS === current ? 'Closed 26/27' : `${fmtIn(v)}″${m.usedTypical && DS === current ? ' typ' : ''}`;
    return { type: 'Feature', geometry: { type: 'Point', coordinates: r.center }, properties: { id: r.id, pass: (r.passes || []).join('+'), name: r.name.replace(/ \(.*\)/, ''), v, lbl } };
  }) });
}
let playing = false, last = 0;
function tick(ts) { if (!playing) return; const dt = last ? (ts - last) / 1000 : 0; last = ts; T += dt * (nD() > 60 ? 12 : 3); if (T >= nD() - 1) { T = nD() - 1; stop(); } $('#scrub').value = T; render(); if (playing) requestAnimationFrame(tick); }
function stop() { playing = false; $('#play').classList.remove('on'); }
$('#play').onclick = () => { if (playing) return stop(); if (T >= nD() - 1.01) T = 0; playing = true; last = 0; $('#play').classList.add('on'); requestAnimationFrame(tick); };
$('#scrub').addEventListener('input', e => { stop(); T = +e.target.value; render(); });

const sheet = $('#sheet');
function sparkSVG(r) {
  const m = Math.max(...(r.sf || [1]), 1), w = 70, h = 28, bw = w / D;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}">${(r.sf || []).map((v, i) => `<rect x="${i * bw}" y="${h - Math.max(1, v / m * h)}" width="${bw - .5}" height="${Math.max(1, v / m * h)}" rx=".6" fill="${i > TODAY ? '#c48cff' : i === TODAY ? '#fff' : '#7cc4ff'}" opacity="${i > TODAY ? .7 : 1}"/>`).join('')}</svg>`;
}
function ranked() {
  const rows = VIS().map(r => ({ r, m: windowMetrics(r, SNOW, WIN, TYPICAL) }));
  rows.sort((a, b) => b.m.outlookCm - a.m.outlookCm || b.m.recent - a.m.recent || b.r.d7 - a.r.d7);
  const watch = new Set(watchlist());
  const top = rows.filter(x => watch.has(x.r.id));
  const rest = rows.filter(x => !watch.has(x.r.id));
  return [...top, ...rest];
}
function tempLabel(m) {
  if (m.tmax == null && m.tmin == null) return '';
  const t = m.tmax ?? m.tmin;
  return `${Math.round(C2F(t))}°`;
}
function tripBits(r) {
  const { start, end } = tripDates(TRIP, WIN);
  const { adults, kids } = partyOf(TRIP);
  const fl = flightLinks({ home: TRIP.home, iata: r.iata, start, end, adults, kids });
  const ld = lodgingLinks({ name: r.name, lat: r.center[1], lon: r.center[0], start, end, adults, kids });
  return { start, end, adults, kids, fl, ld };
}
function listRow({ r, m }, i, watched) {
  const outlook = m.usedTypical && !m.usedForecast ? `<span class="typical-tag">Typical</span> ${fmtIn(m.typicalCm)}″` : `${fmtIn(m.outlookCm)}″`;
  const wx = weatherGlyph(m);
  const t = tripBits(r);
  const g = t.fl.find(x => x.primary) || t.fl[0];
  const b = t.ld.find(x => x.primary) || t.ld[0];
  return `<div class="row ${watched ? 'watch' : ''}" data-id="${r.id}">
    <button class="star ${watched ? 'on' : ''}" data-watch="${r.id}" aria-label="Watch">${watched ? '★' : '☆'}</button>
    <div class="nm"><b>${esc(r.name)}</b><span class="meta">${passTags(r) || ''} ${esc(r.region || r.state)}${r.iata ? ` · ${r.iata}` : ''}</span></div>
    <span class="wx" title="Weather">${wx}</span>
    ${sparkSVG(r)}
    <div class="val"><b>${fmtIn(m.recent || r.d7)}″</b><div class="sub">recent</div><span class="fc">${outlook}${tempLabel(m) ? ` · ${tempLabel(m)}` : ''}</span></div>
    <div class="row-trip">${fmtShort(t.start)}–${fmtShort(t.end)} · ${esc(peopleLabel(TRIP))}${r.iata ? ` · ${TRIP.home}→${r.iata}` : ''}</div>
    <div class="trip-mini">${g ? outboundHTML(g, 'mini') : '<span class="sub">No airport</span>'}${b ? outboundHTML(b, 'mini') : ''}</div>
    <div class="row-actions">
      <button type="button" data-explore="${r.id}">Explore resort</button>
      <button type="button" class="plan" data-plan="${r.id}">Plan trip</button>
    </div>
  </div>`;
}
function listTitle() {
  if (activeRegion) return activeRegion.name;
  if (WIN.usedTypicalOnly) return `Typical · ${WIN.label}`;
  return `Most snow · ${WIN.label}`;
}
function renderList() {
  const rows = ranked();
  const watch = new Set(watchlist());
  $('#countPill').textContent = `${rows.length} areas`;
  $('#sheetTitle').textContent = selected && !$('#detailView').classList.contains('hidden') ? selected.name : listTitle();
  const watchedRows = rows.filter(x => watch.has(x.r.id));
  const rest = rows.filter(x => !watch.has(x.r.id));
  let html = '';
  if (watchedRows.length) html += `<div class="sec">Watchlist</div>` + watchedRows.map((x, i) => listRow(x, i, true)).join('');
  if (rest.length) html += (watchedRows.length ? `<div class="sec">Most snow</div>` : '') + rest.map((x, i) => listRow(x, i, false)).join('');
  $('#list').innerHTML = html || '<p class="sub" style="padding:16px 0">No matching resorts. Try Both passes or another region.</p>';
  $('#whenBtn').textContent = `When · ${WIN.label}`;
}
function setPass(p, save = true) {
  if (!PASSES.includes(p)) return; PASS = p;
  if (save) localStorage.setItem('ss_pass', p);
  document.querySelectorAll('.passchips').forEach(el => { el.innerHTML = chipsHTML(); });
  writeURL({ resort: selected?.id });
  renderList(); buildTimeline(); render();
  if (!$('#seasonsView').classList.contains('hidden')) renderSeasons();
}
document.querySelectorAll('.passchips').forEach(el => { el.innerHTML = chipsHTML(); el.onclick = e => { const b = e.target.closest('button[data-pass]'); if (b) { e.stopPropagation(); setPass(b.dataset.pass); } }; });
renderList();
$('#list').onclick = e => {
  if (e.target.closest('a')) return;
  const st = e.target.closest('[data-watch]');
  if (st) { e.stopPropagation(); toggleWatch(st.dataset.watch); renderList(); if (selected) { $('#detailView').innerHTML = detailHTML(selected); wireDetail(selected); } return; }
  const plan = e.target.closest('[data-plan]');
  if (plan) { e.stopPropagation(); select(plan.dataset.plan, true, 'plan'); return; }
  const ex = e.target.closest('[data-explore]');
  if (ex) { select(ex.dataset.explore, true, 'explore'); return; }
  const row = e.target.closest('.row'); if (row) select(row.dataset.id, true, 'explore');
};
$('#credits').innerHTML = `Snow: Open-Meteo forecast API (NOAA GFS/HRRR + ECMWF), updated ${new Date(SNOW.generated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Typical snowfall: ERA5 season archive average — not a forecast. Runs/lifts: OpenSkiMap / OSM (ODbL). Lodging pins: OSM Overpass. Terrain: AWS Terrarium. Imagery: Esri. Fire: NIFC WFIGS. Destinations: ikonpass.com + epicpass.com 26/27 lists. ${EMAIL_ALERTS_ENABLED ? '<a href="/alerts">Email alerts</a> · ' : ''}<a href="https://github.com/baileybusch/ski-explorer">Source</a>${affiliateConfigured() ? ' · We may earn a commission from booking links.' : ''}`;

const sbpx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sbpx')) || 0;
const SNAPS = { collapsed: () => 64 + sbpx(), peek: () => 210 + sbpx(), half: () => Math.round(innerHeight * 0.5), full: () => sheet.offsetHeight };
const ORDER = ['collapsed', 'peek', 'half', 'full'];
function setSnap(s) {
  if (isDesk()) return;
  sheet.dataset.snap = s; const h = SNAPS[s]();
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
  sheet.style.transform = `translateY(${sheet.offsetHeight - h}px)`;
  document.body.classList.toggle('sheet-full', s === 'full');
}
const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden'; document.body.appendChild(probe);
document.documentElement.style.setProperty('--sbpx', probe.offsetHeight);
let drag = null;
sheet.addEventListener('pointerdown', e => {
  if (isDesk() || e.target.closest('button,a,input,select,label,.bars-chart,textarea')) return;
  const inHead = !!e.target.closest('#sheetHead');
  if (!inHead && sheet.dataset.snap === 'full' && $('#sheetBody').scrollTop > 0) return;
  drag = { y: e.clientY, h: SNAPS[sheet.dataset.snap](), moved: false, t: performance.now(), inHead };
});
addEventListener('pointermove', e => {
  if (!drag) return; const dy = e.clientY - drag.y;
  if (!drag.moved) { if (Math.abs(dy) < 6) return; if (!drag.inHead && sheet.dataset.snap === 'full' && dy < 0) { drag = null; return; } drag.moved = true; sheet.classList.add('drag'); }
  const h = Math.min(sheet.offsetHeight, Math.max(SNAPS.collapsed() * 0.8, drag.h - dy)); drag.cur = h;
  sheet.style.transform = `translateY(${sheet.offsetHeight - h}px)`;
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
});
addEventListener('pointerup', e => {
  if (!drag) return; const d = drag; drag = null; sheet.classList.remove('drag');
  if (!d.moved) { if (d.inHead) setSnap(sheet.dataset.snap === 'collapsed' || sheet.dataset.snap === 'peek' ? 'half' : 'collapsed'); return; }
  const v = (e.clientY - d.y) / (performance.now() - d.t);
  let target = ORDER.map(k => [k, SNAPS[k]()]).reduce((a, b) => Math.abs(b[1] - d.cur) < Math.abs(a[1] - d.cur) ? b : a)[0];
  if (Math.abs(v) > 0.5) { const hs = ORDER.map(k => [k, SNAPS[k]()]); target = v > 0 ? ([...hs].reverse().find(([, h]) => h < d.cur - 4) || hs[0])[0] : (hs.find(([, h]) => h > d.cur + 4) || hs[3])[0]; }
  setSnap(target);
});
addEventListener('resize', () => setSnap(sheet.dataset.snap || 'peek'));

function showView(v) {
  for (const id of ['listView', 'detailView', 'seasonsView']) $('#' + id).classList.toggle('hidden', id !== v);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v || (v === 'detailView' && b.dataset.v === 'listView')));
  $('#sheetTitle').textContent = v === 'seasonsView' ? 'Season snowfall' : v === 'detailView' ? selected?.name : listTitle();
  $('#sheetBody').scrollTop = 0;
}
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v === 'seasonsView') renderSeasons(); if (b.dataset.v === 'listView' && selected) return showView('detailView'); showView(b.dataset.v); if (sheet.dataset.snap === 'collapsed' || sheet.dataset.snap === 'peek') setSnap('half'); };
$('#seasonChip').onclick = () => { renderSeasons(); showView('seasonsView'); if (!isDesk() && sheet.dataset.snap !== 'full') setSnap('half'); };

function seasonTotals(rid) {
  const ys = [...SUMMARY.seasons];
  const vis = VIS().filter(r => r.id !== 'eagle-point' || PASS === 'all'), withY = y => vis.filter(r => SUMMARY.totals[r.id]?.[y] != null);
  const val = y => rid ? (SUMMARY.totals[rid]?.[y] ?? 0) : withY(y).reduce((a, r) => a + SUMMARY.totals[r.id][y], 0) / Math.max(1, withY(y).length);
  const out = ys.map(y => ({ y, v: val(y) }));
  out.push({ y: CUR_SEASON, v: rid ? accum(current.sf[rid], TODAY) : vis.reduce((a, r) => a + accum(current.sf[r.id], TODAY), 0) / Math.max(1, vis.length), cur: true });
  return out;
}
let seasonScope = 'resort';
function barsHTML(rows) {
  const mx = Math.max(...rows.map(r => r.v), 1), best = rows.filter(r => !r.cur).reduce((a, b) => b.v > a.v ? b : a, { v: -1 });
  return `<div class="bars-chart">${rows.map(r => `<button class="sbar ${r.y === best.y ? 'best' : ''} ${r.cur ? 'cur' : ''} ${DS.key === (r.cur ? 'cur' : r.y) ? 'sel' : ''}" data-y="${r.y}">
    <span class="sv">${Math.round(IN(r.v))}″</span><span class="st"><i style="height:${Math.max(2, r.v / mx * 100)}%"></i></span><span class="sy">${String(r.y).slice(2)}–${String(r.y + 1).slice(2)}</span></button>`).join('')}</div>`;
}
function renderSeasons() {
  const rid = seasonScope === 'resort' && selected ? selected.id : null;
  const rows = seasonTotals(rid).filter(r => r.cur || !rid || SUMMARY.totals[rid]?.[r.y] != null), past = rows.filter(r => !r.cur);
  const best = past.reduce((a, b) => b.v > a.v ? b : a, { v: -1 }), avg = past.reduce((a, b) => a + b.v, 0) / Math.max(1, past.length);
  $('#seasonsView').innerHTML = `
    <div class="seg"><button data-s="resort" class="${rid ? 'on' : ''}" ${selected ? '' : 'disabled'}>${selected ? selected.name.split(' (')[0] : 'Pick a resort'}</button><button data-s="all" class="${rid ? '' : 'on'}">${PASS === 'all' ? 'All resorts' : PASS === 'ikon' ? 'Ikon' : 'Epic'} (avg)</button></div>
    ${past.length ? `<div class="grid"><div class="stat"><b>${Math.round(IN(best.v))}<small>″</small></b><span>Best · ${best.y}–${String(best.y + 1).slice(2)}</span></div><div class="stat"><b>${Math.round(IN(avg))}<small>″</small></b><span>Avg season</span></div><div class="stat"><b>${past.length}</b><span>Seasons</span></div></div>` : '<p class="sub">Historical seasons are still being generated for some new destinations.</p>'}
    <div class="sec">Total snowfall · Nov 1 – Apr 30</div>${barsHTML(rows)}
    <p class="sub">Tap a season to load it into the timeline and play it back. Modeled snowfall at mid-mountain from the Open-Meteo historical archive (ERA5 reanalysis); 2026–27 is season-to-date plus forecast. Southern-hemisphere typical seasons are not in this archive yet.</p>`;
  $('#seasonsView .seg').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) { seasonScope = b.dataset.s; renderSeasons(); } };
  $('#seasonsView .bars-chart').onclick = e => { const b = e.target.closest('.sbar'); if (b) loadSeason(+b.dataset.y).then(renderSeasons); };
}

const osmCache = {};
async function loadOSM(id) {
  if (!osmCache[id]) osmCache[id] = fetch(`data/resorts/${id}.json`).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }));
  const loaded = await Promise.all(Object.values(osmCache));
  map.getSource('osm').setData({ type: 'FeatureCollection', features: loaded.flatMap(f => f.features) });
}
function chartSVG(r) {
  const w = 340, h = 80, m = Math.max(...(r.sf || [1]), 1), bw = w / D;
  let acc = 0; const pts = (r.sf || []).map((v, i) => (acc += v, [i * bw + bw / 2, acc]));
  const am = Math.max(acc, 1);
  const line = pts.map(([x, a]) => `${x.toFixed(1)},${(h - 4 - a / am * (h - 14)).toFixed(1)}`).join(' ');
  const fd = i => new Date(SNOW.dates[i] + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
  ${(r.sf || []).map((v, i) => `<rect x="${i * bw + .5}" y="${h - Math.max(1, v / m * (h - 20))}" width="${bw - 1.5}" height="${Math.max(1, v / m * (h - 20))}" rx="1" fill="${i > TODAY ? '#c48cff' : '#7cc4ff'}" opacity=".85"/>`).join('')}
  <polyline points="${line}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9" vector-effect="non-scaling-stroke"/></svg>
  <div class="sub" style="display:flex;justify-content:space-between"><span>${fd(0)}</span><span>Today</span><span>${fd(D - 1)}</span></div>`;
}
const FIREHTML = `<div class="firecard"><h3>🔥 2026 Cottonwood Fire</h3><div class="sub">Burn perimeter shown on map (NIFC WFIGS). Toggle under Layers.</div>
<div class="grid"><div class="stat"><b>97,464</b><span>acres burned</span></div><div class="stat"><b>~300</b><span>of 600 skiable ac</span></div><div class="stat"><b>4<small>/5</small></b><span>lifts affected</span></div></div>
<ul><li>Started <b>June 22, 2026</b>; 100% contained <b>Sept 1</b></li><li>Canyonside Lodge destroyed</li><li>Resort <b>closed for 2026–27</b>; targeting reopening <b>Nov 2027</b></li></ul>
<div class="links"><a href="https://www.eaglepointresort.com/eagle-point-resort-announces-2026-27-winter-season-closure-following-cottonwood-fire/" target="_blank" rel="noopener">Resort announcement ↗</a><a href="https://inciweb.wildfire.gov/incident-information/utfif-cottonwood-fire" target="_blank" rel="noopener">InciWeb ↗</a></div></div>`;
const follows = () => JSON.parse(localStorage.getItem('ss_follows') || '[]');
function followHTML(r) {
  if (!EMAIL_ALERTS_ENABLED) return '';
  const on = follows().includes(r.id), email = localStorage.getItem('ss_email') || '';
  return `<div class="follow" id="follow">
    <button class="fbtn ${on ? 'on' : ''}" id="fbtn">${on ? '🔔 Following' : '🔔 Follow for snow alerts'}</button>
    <form id="fform" class="${on ? 'hidden' : 'hidden'}"><div class="freq"><label><input type="radio" name="ffreq" value="weekly" checked><span>Weekly · Sat</span></label><label><input type="radio" name="ffreq" value="daily"><span>Daily</span></label></div><input type="email" id="femail" placeholder="you@email.com" value="${email}" required autocomplete="email" inputmode="email"><button type="submit">Subscribe</button></form>
    <div class="sub" id="fmsg"></div></div>`;
}
function wireFollow(r) {
  if (!EMAIL_ALERTS_ENABLED || !$('#fbtn')) return;
  $('#fbtn').onclick = () => { if (follows().includes(r.id)) { location.href = '/alerts' + (localStorage.getItem('ss_token') ? `?token=${localStorage.getItem('ss_token')}` : ''); return; } $('#fform').classList.toggle('hidden'); $('#femail').focus(); };
  $('#fform').onsubmit = async e => {
    e.preventDefault(); const email = $('#femail').value.trim(); $('#fmsg').textContent = 'Saving…';
    try {
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, resorts: [r.id], freq: document.querySelector('input[name=ffreq]:checked')?.value || 'weekly' }) }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      localStorage.setItem('ss_email', email); localStorage.setItem('ss_follows', JSON.stringify([...new Set([...follows(), r.id])]));
      $('#fmsg').innerHTML = res.message; $('#fform').classList.add('hidden'); $('#fbtn').classList.add('on'); $('#fbtn').textContent = '🔔 Following';
    } catch (err) { $('#fmsg').textContent = 'Could not subscribe: ' + err.message; }
  };
}

function tripLinkRow(r) {
  const t = tripBits(r);
  const flights = t.fl.map(x => outboundHTML(x, x.primary ? 'primary' : '')).join('');
  const stays = t.ld.map(x => outboundHTML(x, x.primary ? 'primary' : '')).join('');
  return `<div class="sec">Trip</div>
    <p class="sub">${esc(r.name)} · ${fmtShort(t.start)}–${fmtShort(t.end)} · ${esc(peopleLabel(TRIP))}${r.iata ? ` · ${TRIP.home} → ${r.iata}` : ''}. Google Flights is first; other sites are backups. Search links only — a live “from $X” appears only if a price provider is configured.</p>
    <div class="trip-links" id="priceRow">${flights}${stays}</div>
    <div id="livePrices" class="sub"></div>`;
}

function detailHTML(r) {
  const fc = (r.sf || []).slice(TODAY + 1), fm = Math.max(...fc, 1);
  const vert = r.summit && r.base ? r.summit - r.base : null;
  const ys = SUMMARY.seasons.filter(y => SUMMARY.totals[r.id]?.[y] != null), best = ys.length ? ys.reduce((a, y) => SUMMARY.totals[r.id][y] > SUMMARY.totals[r.id][a] ? y : a) : null;
  const m = windowMetrics(r, SNOW, WIN, TYPICAL);
  const blurb = interestingBlurb(r);
  const watched = isWatched(r.id);
  return `<button class="back" id="back"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>All resorts</button>
  <div class="dh"><div><h2>${esc(r.name)}</h2><div class="sub" style="margin-top:4px">${esc(r.region || r.state)}${r.town ? ` · ${esc(r.town)}` : ''} · ${r.id === 'eagle-point' ? '<span class="tag fire">CLOSED 26/27</span> Not on Ikon or Epic' : [r.ikon && `<span class="tag ikon">IKON</span> ${esc(r.ikon)}`, r.epic && `<span class="tag epic">EPIC</span> ${esc(r.epic)}`].filter(Boolean).join(' · ')}</div></div>
  <button class="star ${watched ? 'on' : ''}" id="watchBtn" aria-label="Watchlist">${watched ? '★' : '☆'}</button></div>
  ${followHTML(r)}
  ${blurb ? `<p class="sub" style="margin:10px 0 0;line-height:1.45">${esc(blurb)} Stats are OpenSkiMap / listed location only — we do not invent acres or snowfall averages.</p>` : ''}
  <div class="grid">
    <div class="stat"><b>${fmtIn(r.d24)}<small>″</small></b><span>Last 24h</span></div>
    <div class="stat"><b>${fmtIn(r.d7)}<small>″</small></b><span>Last 7 days</span></div>
    <div class="stat"><b>${fmtIn(r.d30)}<small>″</small></b><span>Last 30 days</span></div>
    <div class="stat"><b>${r.base_depth == null ? '—' : fmtIn(r.base_depth)}<small>″</small></b><span>Snow depth*</span></div>
    <div class="stat"><b>${fmtIn(r.fc)}<small>″</small></b><span>Next 7 days</span></div>
    <div class="stat"><b>${vert ? fmtFt(vert) : '—'}<small>ft</small></b><span>Vertical</span></div>
  </div>
  ${m.usedTypical ? `<p class="typical-tag">Window includes typical (past-season average), not a forecast</p>` : ''}
  <div class="sec">7-day forecast</div>
  <div class="fc">${fc.map((v, i) => `<div><span>${new Date(SNOW.dates[TODAY + 1 + i] + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })}</span><div class="bar"><i style="height:${Math.max(4, v / fm * 100)}%"></i></div><b>${fmtIn(v)}″</b></div>`).join('') || '<p class="sub">No forecast snapshot for this resort yet.</p>'}</div>
  <div class="sec">Snowfall · 30 days + forecast</div>${(r.sf || []).length ? chartSVG(r) : '<p class="sub">Snow model not fetched yet for this destination.</p>'}
  ${best ? `<button class="seasonlink" id="seasonLink"><span><b>Past seasons</b><span class="sub">Best: ${best}–${String(best + 1).slice(2)} · ${Math.round(IN(SUMMARY.totals[r.id][best]))}″</span></span><span>›</span></button>` : ''}
  ${r.id === 'eagle-point' ? FIREHTML : ''}
  ${tripLinkRow(r)}
  <div class="row-actions detail-actions">
    <button class="fbtn ghost" id="shareTrip" type="button">Share link</button>
    <button class="fbtn" id="planThis" type="button">Plan trip</button>
  </div>
  <p class="sub" id="shareMsg"></p>
  <div class="sec">Mountain</div>
  <div class="grid">
    <div class="stat"><b>${r.summit ? fmtFt(r.summit) : '—'}<small>ft</small></b><span>Summit</span></div>
    <div class="stat"><b>${r.base ? fmtFt(r.base) : '—'}<small>ft</small></b><span>Base</span></div>
    <div class="stat"><b>${r.lifts ?? '—'}</b><span>Lifts</span></div>
    <div class="stat"><b>${r.runs ?? '—'}</b><span>Runs (OSM)</span></div>
    <div class="stat"><b>${SNOW.resorts[r.id]?.elev ? fmtFt(SNOW.resorts[r.id].elev) : '—'}<small>ft</small></b><span>Snow model elev</span></div>
    <div class="stat"><b>${r.iata || '—'}</b><span>Airport</span></div>
  </div>
  <div class="sub" style="line-height:1.5">*Modeled snow depth at mid-mountain from Open-Meteo, not a resort-reported base. Elevations, lift and run counts from OpenSkiMap/OSM when we have a match. Empty counts mean we have not processed OSM for this destination yet.</div>
  <div class="links" style="margin-top:12px">${r.web ? `<a href="${r.web}" target="_blank" rel="noopener">Resort site ↗</a>` : ''}<a href="https://openskimap.org/#13/${r.center[1]}/${r.center[0]}" target="_blank" rel="noopener">OpenSkiMap ↗</a></div>`;
}
const EXAG = 1.35;
function setElev(e) {
  const old = map.getCenterElevation?.() ?? 0, dz = e - old; if (Math.abs(dz) < 50) return;
  const z = map.getZoom(), lat = map.getCenter().lat, pitch = map.getPitch() * Math.PI / 180;
  const mpp = 40075016 * Math.cos(lat * Math.PI / 180) / (512 * 2 ** z);
  const d = (map.getCanvas().clientHeight / 2) / Math.tan(0.3217) * mpp;
  const d2 = Math.max(800, d - dz / Math.max(0.3, Math.cos(pitch)));
  try { map.jumpTo({ elevation: e, zoom: z - Math.log2(d2 / d) }); } catch { /* globe may ignore elevation */ }
}
function writeURL({ resort = selected?.id, mode } = {}) {
  const { start, end } = tripDates(TRIP, WIN);
  const { adults, kids } = partyOf(TRIP);
  history.replaceState(null, '', location.pathname + shareSearch({
    resort, from: start, to: end, adults, kids, home: TRIP.home, mode,
    pass: PASS, region: !resort && activeRegion ? activeRegion.id : null,
  }));
}
function wireDetail(r) {
  wireFollow(r);
  $('#back').onclick = () => { selected = null; showView('listView'); syncSearchLabel(); writeURL({ resort: null }); render(); };
  const sl = $('#seasonLink'); if (sl) sl.onclick = () => { renderSeasons(); showView('seasonsView'); };
  $('#watchBtn')?.addEventListener('click', () => { toggleWatch(r.id); $('#detailView').innerHTML = detailHTML(r); wireDetail(r); renderList(); });
  $('#planThis')?.addEventListener('click', () => { writeURL({ resort: r.id, mode: 'plan' }); openPlan([r]); });
  $('#shareTrip')?.addEventListener('click', async () => {
    const { start, end } = tripDates(TRIP, WIN);
    const { adults, kids } = partyOf(TRIP);
    const url = shareURL({ resort: r.id, from: start, to: end, adults, kids, home: TRIP.home, mode: 'explore', pass: PASS });
    try { await navigator.clipboard.writeText(url); $('#shareMsg').textContent = 'Link copied.'; }
    catch { $('#shareMsg').textContent = url; }
  });
}
function select(id, fly = true, mode = 'explore') {
  const r = byId[id]; if (!r) return; selected = r; seasonScope = 'resort';
  $('#detailView').innerHTML = detailHTML(r); wireDetail(r);
  showView('detailView');
  syncSearchLabel();
  writeURL({ resort: id, mode });
  loadOSM(id);
  if (lodgingOn) loadLodging(r);
  fillLivePrices(r);
  if (mode === 'plan') openPlan([r]);
  if (fly) {
    const [x0, y0, x1, y1] = r.bbox;
    const pad = isDesk() ? { top: 60, bottom: 110, left: 420, right: 40 } : { top: 80, bottom: Math.round(innerHeight * 0.46) + 90, left: 16, right: 16 };
    const cam = map.cameraForBounds([[x0, y0], [x1, y1]], { padding: pad });
    const z = r.id === 'eagle-point' ? 11.9 : Math.min(13.6, Math.max(11.2, (cam?.zoom ?? 12) - 0.2));
    syncTerrain();
    if (r.summit && r.base) setElev((r.summit * 0.4 + r.base * 0.6) * EXAG);
    map.flyTo({ center: [(x0 + x1) / 2, (y0 + y1) / 2], zoom: z, pitch: isDesk() ? 64 : 58, bearing: r.bearing || 0, duration: 2800, essential: true, curve: 1.4, padding: pad });
  }
  if (sheet.dataset.snap !== 'half') setSnap('half');
  render();
}
async function fillLivePrices(r) {
  const { start, end } = tripDates(TRIP, WIN);
  const { adults, kids } = partyOf(TRIP);
  const [f, l] = await Promise.all([
    flightQuote({ home: TRIP.home, iata: r.iata, start, end, adults, kids }),
    lodgingQuote({ name: r.name, lat: r.center[1], lon: r.center[0], start, end, adults, kids }),
  ]);
  const el = $('#livePrices'); if (!el) return;
  const bits = [];
  if (f?.price) bits.push(`Flights from $${Math.round(f.price)} (${f.provider})`);
  if (l?.price) bits.push(`Lodging from $${Math.round(l.price)} (${l.provider})`);
  el.textContent = bits.join(' · ');
}

map.on('click', e => {
  const P = 24, { x, y } = e.point;
  const f = map.queryRenderedFeatures([[x - P, y - P], [x + P, y + P]], { layers: ['resort-hit', 'resort-dot', 'resort-label'] });
  if (!f.length) return;
  f.sort((a, b) => { const pa = map.project(a.geometry.coordinates), pb = map.project(b.geometry.coordinates); return Math.hypot(pa.x - x, pa.y - y) - Math.hypot(pb.x - x, pb.y - y); });
  select(f[0].properties.id);
});
map.on('mousemove', e => { const P = 16, { x, y } = e.point; map.getCanvas().style.cursor = map.queryRenderedFeatures([[x - P, y - P], [x + P, y + P]], { layers: ['resort-hit', 'resort-label'] }).length ? 'pointer' : ''; });
map.on('zoomend', syncTerrain);
map.on('moveend', syncTerrain);

function queryTail() {
  const { start, end } = tripDates(TRIP, WIN);
  const { adults, kids } = partyOf(TRIP);
  return shareSearch({
    resort: selected?.id, from: start, to: end, adults, kids, home: TRIP.home,
    pass: PASS, region: !selected && activeRegion ? activeRegion.id : null,
  });
}
function syncSearchLabel() {
  if (selected) { $('#searchLabel').textContent = selected.name; $('#searchLabel').style.color = '#fff'; }
  else if (activeRegion) { $('#searchLabel').textContent = activeRegion.name; $('#searchLabel').style.color = '#fff'; }
  else { $('#searchLabel').textContent = 'Japan, Dolomites, Utah…'; $('#searchLabel').style.color = ''; }
}

function flyRegion(g) {
  activeRegion = g;
  const matches = resortsForRegion(g, IDX, passOK);
  activeIds = new Set(matches.map(r => r.id));
  selected = null;
  showView('listView');
  renderList(); buildTimeline(); render();
  syncSearchLabel();
  writeURL({ resort: null });
  const pad = isDesk() ? { top: 80, bottom: 80, left: 420, right: 40 } : { top: 90, bottom: Math.round(innerHeight * 0.42), left: 16, right: 16 };
  map.flyTo({ center: g.center, zoom: g.zoom, pitch: g.pitch || 28, bearing: 0, duration: 2400, essential: true, curve: 1.5, padding: pad });
  if (!isDesk()) setSnap(matches.length ? 'half' : 'peek');
}

function clearRegion() {
  activeRegion = null; activeIds = null; selected = null;
  showView('listView'); renderList(); buildTimeline(); render(); syncSearchLabel();
}

function goGlobe() {
  clearRegion();
  writeURL({ resort: null });
  try { map.setTerrain(null); } catch { /* */ }
  terrainOn = false;
  document.body.classList.add('globe-home');
  map.flyTo({ center: [-30, 28], zoom: 1.55, pitch: 0, bearing: 0, duration: 1800, essential: true });
  if (!isDesk()) setSnap('peek');
}

const openSearch = () => { $('#search').classList.remove('hidden'); $('#q').value = activeRegion?.name || ''; doSearch(); setTimeout(() => $('#q').focus(), 30); };
const closeSearch = () => { $('#search').classList.add('hidden'); $('#q').blur(); };
function doSearch() {
  const q = $('#q').value;
  const { regions, resorts } = searchAll(q, { regions: REGIONS, resorts: IDX, passOK });
  const rh = regions.map(g => `<div class="qr region" data-region="${g.id}"><span><b>${esc(g.name)}</b> <span class="sub">Region · fly the globe</span></span><span class="sub">${resortsForRegion(g, IDX, passOK).length}</span></div>`).join('');
  const rs = resorts.map(r => `<div class="qr" data-id="${r.id}"><span><b>${esc(r.name)}</b> <span class="sub">${esc(r.region || r.state)} ${passTags(r)}</span></span><span class="sub">${fmtIn(r.d7)}″ 7d</span></div>`).join('');
  $('#qResults').innerHTML = rh + rs || '<div class="qr"><span class="sub">No matches. Try Japan, Dolomites, Alps, Utah, Hokkaido, Colorado.</span></div>';
}
$('#searchBtn').onclick = openSearch; $('#qClose').onclick = closeSearch; $('#q').oninput = doSearch;
$('#search').onclick = e => {
  const reg = e.target.closest('[data-region]');
  if (reg) { closeSearch(); flyRegion(REGIONS.find(g => g.id === reg.dataset.region)); return; }
  const it = e.target.closest('.qr[data-id]');
  if (it) { closeSearch(); select(it.dataset.id); }
  else if (e.target.id === 'search') closeSearch();
};
$('#q').onkeydown = e => {
  if (e.key === 'Enter') {
    const r = $('#qResults [data-region]') || $('#qResults .qr[data-id]');
    if (r?.dataset.region) { closeSearch(); flyRegion(REGIONS.find(g => g.id === r.dataset.region)); }
    else if (r?.dataset.id) { closeSearch(); select(r.dataset.id); }
  }
  if (e.key === 'Escape') closeSearch();
};
$('#globeBtn').onclick = goGlobe;

function hideFloats(except) {
  for (const id of ['layers', 'whenPanel', 'tripPanel', 'planPanel']) if (id !== except) $('#' + id).classList.add('hidden');
}
$('#layersBtn').onclick = e => { e.stopPropagation(); hideFloats('layers'); $('#layers').classList.toggle('hidden'); };
$('#whenBtn').onclick = e => { e.stopPropagation(); hideFloats('whenPanel'); $('#whenPanel').classList.toggle('hidden'); };
$('#tripBtn').onclick = e => { e.stopPropagation(); hideFloats('tripPanel'); $('#homeAirport').value = TRIP.home; $('#adultsN').value = TRIP.adults; $('#kidsN').value = TRIP.kids; $('#tripPanel').classList.toggle('hidden'); };
document.addEventListener('click', e => {
  if (!e.target.closest('#layers,#layersBtn')) $('#layers').classList.add('hidden');
  if (!e.target.closest('#whenPanel,#whenChip')) $('#whenPanel').classList.add('hidden');
  if (!e.target.closest('#tripPanel,#tripBtn')) $('#tripPanel').classList.add('hidden');
});

const LAYERS = { snow: ['snow'], runs: ['runs-case', 'runs', 'lifts', 'run-labels'], burn: ['fire-fill', 'fire-line'], contours: ['contours', 'contour-labels'], sat: ['sat'], lodging: ['lodge-dot', 'lodge-label'] };
document.querySelectorAll('#layers input').forEach(inp => inp.onchange = () => {
  const vis = inp.checked ? 'visible' : 'none';
  LAYERS[inp.dataset.layer].forEach(l => map.setLayoutProperty(l, 'visibility', vis));
  if (inp.dataset.layer === 'sat') map.setLayoutProperty('dark', 'visibility', inp.checked ? 'none' : 'visible');
  if (inp.dataset.layer === 'lodging') {
    lodgingOn = inp.checked;
    if (lodgingOn && selected) loadLodging(selected);
    if (!lodgingOn) map.getSource('lodging')?.setData({ type: 'FeatureCollection', features: [] });
  }
});
map.on('load', () => {
  try { map.setLayoutProperty('lodge-dot', 'visibility', 'none'); map.setLayoutProperty('lodge-label', 'visibility', 'none'); } catch { /* */ }
});

async function loadLodging(r) {
  const key = r.id;
  if (lodgingCache[key]) {
    map.getSource('lodging')?.setData(lodgingCache[key]);
    return;
  }
  const [lon, lat] = r.center;
  const q = `[out:json][timeout:20];(nwr["tourism"~"hotel|chalet|guest_house|apartment"](around:7000,${lat},${lon}););out center 30;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();
    const features = (json.elements || []).map(el => {
      const c = el.center || (el.lat != null ? { lat: el.lat, lon: el.lon } : null);
      if (!c) return null;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { name: el.tags?.name || 'Lodging (OSM)' } };
    }).filter(Boolean);
    const fc = { type: 'FeatureCollection', features };
    lodgingCache[key] = fc;
    map.getSource('lodging')?.setData(fc);
  } catch {
    map.getSource('lodging')?.setData({ type: 'FeatureCollection', features: [] });
  }
}

function setWindow(next) {
  WIN = next;
  TRIP = { ...TRIP, start: next.start, end: next.end };
  saveTrip(TRIP);
  renderList(); buildTimeline(); render();
  if (selected) { $('#detailView').innerHTML = detailHTML(selected); wireDetail(selected); }
  writeURL({ resort: selected?.id });
}
$('#whenSeg').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  $('#whenSeg button').forEach(x => x.classList.toggle('on', x === b));
  const today = SNOW.dates[TODAY];
  const last = forecastEnd(SNOW);
  if (b.dataset.w === 'forecast7') {
    $('#whenCustom').classList.add('hidden');
    setWindow({ mode: 'forecast7', start: today, end: last, label: 'next 7 days' });
  } else if (b.dataset.w === 'forecast3') {
    $('#whenCustom').classList.add('hidden');
    setWindow({ mode: 'forecast3', start: today, end: addDays(today, 3), label: 'next 3 days' });
  } else {
    $('#whenCustom').classList.remove('hidden');
    $('#whenStart').value = WIN.start;
    $('#whenEnd').value = WIN.end;
  }
};
function applyCustomWhen() {
  const a = $('#whenStart').value, b = $('#whenEnd').value || a;
  if (!a) return;
  const start = a <= b ? a : b, end = a <= b ? b : a;
  const last = forecastEnd(SNOW);
  const typicalOnly = start > last;
  setWindow({ mode: 'custom', start, end, label: typicalOnly ? `typical ${fmtShort(start)}–${fmtShort(end)}` : `${fmtShort(start)}–${fmtShort(end)}`, usedTypicalOnly: typicalOnly });
}
$('#whenStart').onchange = applyCustomWhen;
$('#whenEnd').onchange = applyCustomWhen;
$('#whenDone').onclick = () => { if (!$('#whenCustom').classList.contains('hidden')) applyCustomWhen(); $('#whenPanel').classList.add('hidden'); };

$('#tripDone').onclick = () => {
  TRIP = {
    ...TRIP,
    home: ($('#homeAirport').value || 'SAN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'SAN',
    adults: Math.min(12, Math.max(1, +$('#adultsN').value || 2)),
    kids: Math.min(12, Math.max(0, +$('#kidsN').value || 0)),
  };
  saveTrip(TRIP);
  $('#tripPanel').classList.add('hidden');
  renderList();
  if (selected) { $('#detailView').innerHTML = detailHTML(selected); wireDetail(selected); fillLivePrices(selected); }
  writeURL({ resort: selected?.id });
};

function openPlan(resorts) {
  const snowLabel = {};
  for (const r of resorts) {
    const m = windowMetrics(r, SNOW, WIN, TYPICAL);
    const parts = [`recent ${fmtIn(m.recent)}″`, m.usedTypical && !m.usedForecast ? `typical ${fmtIn(m.typicalCm)}″ (not a forecast)` : `outlook ${fmtIn(m.outlookCm)}″`];
    snowLabel[r.id] = parts.join(', ');
  }
  const text = buildPlan({ resorts, win: WIN, trip: TRIP, snowLabel });
  const links = planHandoffLinks(text);
  $('#planText').value = text;
  $('#planGPT').href = links.chatgpt;
  $('#planGrok').href = links.grok;
  $('#planMsg').textContent = '';
  hideFloats('planPanel');
  $('#planPanel').classList.remove('hidden');
}
$('#planClose').onclick = () => $('#planPanel').classList.add('hidden');
$('#planCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('#planText').value); $('#planMsg').textContent = 'Copied.'; }
  catch { $('#planText').select(); document.execCommand('copy'); $('#planMsg').textContent = 'Copied.'; }
};
$('#planClaude').onclick = () => $('#planCopy').click();

buildTimeline();
setSnap('peek');
document.body.classList.add('globe-home');
map.on('load', () => {
  render();
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  const want = deep.resort || qs.get('r') || location.hash.slice(1);
  const qid = deep.q || qs.get('q');
  setTimeout(() => {
    if (byId[want]) select(want, true, deep.mode || 'explore');
    else if (qid) {
      const g = REGIONS.find(x => x.id === qid || x.name.toLowerCase() === qid.toLowerCase());
      if (g) flyRegion(g);
    }
    if (qs.get('view') === 'seasons') { renderSeasons(); showView('seasonsView'); }
    if (qs.get('sheet')) setSnap(qs.get('sheet'));
  }, 400);
});
window.__app = { map, select, setPass, setSnap, loadSeason, renderSeasons, showView, flyRegion, goGlobe, setT: t => { T = t; $('#scrub').value = t; render(); } };

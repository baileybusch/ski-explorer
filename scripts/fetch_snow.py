"""Fetch 7-day forecast (+ a short modeled past) from Open-Meteo.

Pass 4: the board headline is observed snow (SNOTEL), not this snapshot.
This job is FORECAST-ONLY plus a labeled model-est fallback for non-US resorts.

Sampling — stay under the free 4000 weighted-calls/hour cap:
  * 1 mid-mountain center per resort (no 2×2/4×4 grid by default)
  * daily snowfall_sum + tmax/tmin/weather_code
  * past_days=7, forecast_days=7 → ceil(14/14)=1 day-weight
  * no hourly (hourly snow_depth used to explode the budget)

A previous 4×4 + hourly-on-every-point run needed ~1649 locations ≈ 4360
weighted calls/hour and stalled. This path is ~158 locations × 1 ≈ 158 calls.

GRID_N=2 restores the heatmap grid (daily-only). --hourly restores snow_depth.
--missing: fetch only resorts absent from snow.json and merge.
--provider openmeteo|metnorway: one-line flip (this script still fetches Open-Meteo;
  MET Norway lives in lib/weather for live/compare until we have revenue).

US resorts (forecast days only):
  * NWS gridded snowfallAmount (api.weather.gov, forecaster-edited, varying snow
    ratios) for every local day it fully covers, else
  * Open-Meteo NBM (ncep_nbm_conus, native snowfall), else
  * Open-Meteo best_match (snowfall at a fixed 7:1).
  Past days stay on best_match. Per-day source lands in rec['sfSrc'].
  --no-nws skips the NWS + NBM pass (falls back to best_match everywhere).
"""
import json, urllib.request, urllib.parse, time, datetime, sys, os

provider = os.environ.get('WEATHER_PROVIDER', 'openmeteo')
if '--provider' in sys.argv:
  i = sys.argv.index('--provider')
  if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('-'):
    provider = sys.argv[i + 1]
print('provider:', provider, flush=True)
if provider == 'metnorway':
  print('MET Norway is wired in lib/weather (JS). Snapshot job stays on Open-Meteo until there is revenue.', flush=True)

idx = json.load(open('public/data/resorts-index.json'))
prev = json.load(open('public/data/snow.json')) if os.path.exists('public/data/snow.json') else None
if '--missing' in sys.argv and prev:
  idx = [r for r in idx if r['id'] not in prev['resorts']]
  print('missing resorts:', len(idx), flush=True)
  if not idx:
    raise SystemExit('nothing to fetch')

N = int(os.environ.get('GRID_N', '0'))  # 0 = no heatmap grid (forecast-only)
PAST = int(os.environ.get('PAST_DAYS', '7'))
FORECAST = int(os.environ.get('FORECAST_DAYS', '7'))
HOURLY = '--hourly' in sys.argv
grid_pts = []  # (rid, lon, lat)
centers = []   # (rid, lon, lat, elev)
for r in idx:
  x0, y0, x1, y1 = r['bbox']
  cx, cy = r['center']
  padx = max(0.025, (x1 - x0) * 0.55)
  pady = max(0.02, (y1 - y0) * 0.55)
  if N == 1:
    grid_pts.append((r['id'], cx, cy))
  elif N > 1:
    for i in range(N):
      for j in range(N):
        lon = round(cx - padx + 2 * padx * i / (N - 1), 4)
        lat = round(cy - pady + 2 * pady * j / (N - 1), 4)
        grid_pts.append((r['id'], lon, lat))
  el = None
  if r.get('summit') and r.get('base'):
    el = round(r['base'] + 0.6 * (r['summit'] - r['base']))
  centers.append((r['id'], cx, cy, el))

UA = {'User-Agent': 'ski-explorer (github.com/baileybusch/ski-explorer)'}
PER_MIN = int(os.environ.get('PER_MIN', '500'))
PER_HOUR = int(os.environ.get('PER_HOUR', '4000'))
used = []  # (ts, weight)
DAYS = PAST + FORECAST


def days_weight(nloc, days=DAYS, nvars=1):
  """Open-Meteo weights locations × ceil(days/14) and extra when >10 vars."""
  tw = max(1, (days + 13) // 14)
  vw = 1 if nvars <= 10 else (nvars + 9) // 10
  return nloc * tw * vw


def throttle(w):
  while True:
    now = time.time()
    used[:] = [u for u in used if now - u[0] < 3600]
    m = sum(x for t, x in used if now - t < 60)
    h = sum(x for t, x in used)
    if m + w <= PER_MIN and h + w <= PER_HOUR:
      used.append((now, w))
      return
    if h + w > PER_HOUR:
      oldest = min(t for t, _ in used) if used else now
      wait = max(2, oldest + 3600 - now + 1)
    else:
      oldest_m = min((t for t, _ in used if now - t < 60), default=now)
      wait = max(2, oldest_m + 60 - now + 1)
    print(f'throttle sleep {wait:.0f}s (min={m:.0f}/{PER_MIN} hour={h:.0f}/{PER_HOUR} need+{w:.0f})', flush=True)
    time.sleep(min(wait, 90))


def fetch_chunk(lats, lons, elevs=None, daily='snowfall_sum', hourly=None, batch=50):
  out = [None] * len(lats)
  for k in range(0, len(lats), batch):
    sl = slice(k, k + batch)
    n = len(lats[sl])
    q = {
      'latitude': ','.join(str(x) for x in lats[sl]),
      'longitude': ','.join(str(x) for x in lons[sl]),
      'daily': daily,
      'past_days': PAST,
      'forecast_days': FORECAST,
      'timezone': 'auto',
    }
    nvars = daily.count(',') + 1
    if hourly:
      q['hourly'] = hourly
      nvars += hourly.count(',') + 1
    if elevs is not None:
      q['elevation'] = ','.join(str(e) if e else 'nan' for e in elevs[sl])
    w = days_weight(n, DAYS, nvars)
    throttle(w)
    url = 'https://api.open-meteo.com/v1/forecast?' + urllib.parse.urlencode(q)
    print('req', k, 'of', len(lats), 'w', round(w, 1), flush=True)
    for attempt in range(8):
      try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90))
        break
      except Exception as e:
        print('retry', k, e, flush=True)
        time.sleep(20 * (attempt + 1))
    else:
      raise SystemExit('failed')
    if isinstance(d, dict):
      d = [d]
    for i, dd in enumerate(d):
      out[k + i] = dd
    time.sleep(0.4)
  return out


NWS_UA = {
  'User-Agent': 'SkiScope/1.0 (github.com/baileybusch/ski-explorer)',
  'Accept': 'application/geo+json',
}
NWS_POINTS = 'public/data/nws-points.json'
NWS_POINTS_MAX_AGE_DAYS = 30


def get_json(url, headers, tries=3):
  for attempt in range(tries):
    try:
      return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30))
    except Exception as e:
      if attempt == tries - 1:
        raise
      time.sleep(5 * (attempt + 1))


def nws_grid_urls(centers, us_ids):
    """resort id -> forecastGridData URL, cached in nws-points.json (NWS asks to re-check now and then)."""
    cache = json.load(open(NWS_POINTS)) if os.path.exists(NWS_POINTS) else {'resorts': {}}
    now = datetime.datetime.now(datetime.timezone.utc)
    out, changed = {}, False
    for rid, lon, lat, _el in centers:
      if rid not in us_ids:
        continue
      hit = cache['resorts'].get(rid)
      if hit:
        age = now - datetime.datetime.fromisoformat(hit['checked'])
        if age.days < NWS_POINTS_MAX_AGE_DAYS:
          out[rid] = hit['gridData']
          continue
      try:
        pt = get_json(f'https://api.weather.gov/points/{lat:.4f},{lon:.4f}', NWS_UA)
        url = pt['properties']['forecastGridData']
        cache['resorts'][rid] = {'gridData': url, 'checked': now.isoformat()}
        out[rid] = url
        changed = True
      except Exception as e:
        print('nws points miss', rid, e, flush=True)
      time.sleep(0.3)
    if changed:
      cache['generated'] = now.isoformat()
      cache['source'] = 'api.weather.gov/points -> forecastGridData (re-checked every 30 days)'
      json.dump(cache, open(NWS_POINTS, 'w'), separators=(',', ':'), sort_keys=True)
    return out


def _iso_duration_hours(dur):
    """PT6H, P1D, P1DT6H -> hours."""
    import re
    m = re.match(r'P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$', dur)
    if not m:
      return None
    d, h, mi = (int(x) if x else 0 for x in m.groups())
    return d * 24 + h + mi / 60


def nws_daily_snow_cm(grid, dates, utc_offset_s):
    """Sum snowfallAmount into resort-local days. Returns {date: (cm, covered_hours)}."""
    layer = (grid.get('properties') or {}).get('snowfallAmount') or {}
    uom = str(layer.get('uom') or 'wmoUnit:mm')
    to_cm = 0.1 if uom.endswith(':mm') else 100.0 if uom.endswith(':m') else 1.0
    tz = datetime.timezone(datetime.timedelta(seconds=utc_offset_s or 0))
    want = set(dates)
    acc = {}
    for v in layer.get('values') or []:
      if v.get('value') is None:
        continue
      start_s, _, dur = str(v.get('validTime', '')).partition('/')
      hours = _iso_duration_hours(dur)
      if not hours:
        continue
      start = datetime.datetime.fromisoformat(start_s).astimezone(tz)
      per_hour = v['value'] * to_cm / hours
      for k in range(int(round(hours))):
        day = (start + datetime.timedelta(hours=k)).date().isoformat()
        if day not in want:
          continue
        cm, cov = acc.get(day, (0.0, 0))
        acc[day] = (cm + per_hour, cov + 1)
    return acc


def us_forecast(centers, c_res, us_ids):
    """Per US resort: (sf list, source list) with NWS > NBM > best_match for local today onward."""
    rows = [(c, d) for c, d in zip(centers, c_res) if c[0] in us_ids]
    if not rows:
      return {}
    # NBM via Open-Meteo, same points + elevations as the main request.
    nbm = [None] * len(rows)
    try:
      lats = [c[2] for c, _ in rows]
      lons = [c[1] for c, _ in rows]
      elevs = [c[3] for c, _ in rows]
      for k in range(0, len(rows), 40):
        sl = slice(k, k + 40)
        q = {
          'latitude': ','.join(str(x) for x in lats[sl]),
          'longitude': ','.join(str(x) for x in lons[sl]),
          'elevation': ','.join(str(e) if e else 'nan' for e in elevs[sl]),
          'daily': 'snowfall_sum', 'past_days': PAST, 'forecast_days': FORECAST,
          'timezone': 'auto', 'models': 'ncep_nbm_conus',
        }
        throttle(days_weight(len(lats[sl]), DAYS, 1))
        d = get_json('https://api.open-meteo.com/v1/forecast?' + urllib.parse.urlencode(q), UA)
        d = d if isinstance(d, list) else [d]
        for i, dd in enumerate(d):
          nbm[k + i] = dd
        time.sleep(0.4)
    except Exception as e:
      print('NBM pass failed, NWS/best_match only:', e, flush=True)

    grid_urls = nws_grid_urls(centers, us_ids)
    out = {}
    n_nws = n_nbm = 0
    for j, ((rid, _lon, _lat, _el), d) in enumerate(rows):
      ddates = d['daily']['time']
      base = [round(v or 0, 1) for v in d['daily']['snowfall_sum']]
      src = ['om'] * len(base)
      sf = list(base)
      nb = nbm[j]
      if nb and nb.get('daily', {}).get('time') == ddates:
        for i, v in enumerate(nb['daily'].get('snowfall_sum') or []):
          if i >= PAST and v is not None:
            sf[i] = round(v, 1)
            src[i] = 'nbm'
      if rid in grid_urls:
        try:
          grid = get_json(grid_urls[rid], NWS_UA)
          acc = nws_daily_snow_cm(grid, ddates, d.get('utc_offset_seconds', 0))
          for i, day in enumerate(ddates):
            if i < PAST or day not in acc:
              continue
            cm, cov = acc[day]
            if cov >= 23:  # only days NWS fully covers
              sf[i] = round(cm, 1)
              src[i] = 'nws'
        except Exception as e:
          print('nws grid miss', rid, e, flush=True)
        time.sleep(0.3)
      n_nws += 'nws' in src
      n_nbm += 'nbm' in src
      out[rid] = (sf, src)
    print(f'US forecast: {len(out)} resorts, {n_nws} with NWS days, {n_nbm} with NBM days', flush=True)
    return out


print(f'grid pts {len(grid_pts)} centers {len(centers)} past={PAST} forecast={FORECAST} hourly={HOURLY}', flush=True)
est_w = days_weight(len(centers), DAYS, 4) + (days_weight(len(grid_pts), DAYS, 1) if grid_pts else 0)
print(f'estimated weighted calls {est_w:.0f} (cap {PER_HOUR}/hour)', flush=True)

g_res = fetch_chunk([p[2] for p in grid_pts], [p[1] for p in grid_pts],
                    daily='snowfall_sum', batch=50) if grid_pts else []
c_res = fetch_chunk(
  [p[2] for p in centers], [p[1] for p in centers], [p[3] for p in centers],
  daily='snowfall_sum,temperature_2m_max,temperature_2m_min,weather_code',
  hourly='snow_depth' if HOURLY else None,
  batch=40,
)

dates = (c_res[0] if c_res else g_res[0])['daily']['time']
# Open-Meteo returns PAST days before each resort's *local* today, so local
# today is always index PAST. (Matching on the UTC date flipped "today" to
# tomorrow after 4 PM Pacific.)
ti = PAST
out = {
  'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'source': f'Open-Meteo forecast API, past_days={PAST}, forecast_days={FORECAST}; 1 center/resort (forecast chip + model-est fallback); US forecast days: NWS snowfallAmount > Open-Meteo NBM > best_match (see sfSrc)',
  'dates': dates, 'today': ti, 'resorts': {}, 'grid': [],
}

for p, d in zip(grid_pts, g_res):
  sf = [round(v or 0, 1) for v in d['daily']['snowfall_sum']]
  out['grid'].append([p[1], p[2], sf])

us_ids = {r['id'] for r in idx if r.get('country') == 'US'}
us_fc = {}
if us_ids and '--no-nws' not in sys.argv:
  try:
    us_fc = us_forecast(centers, c_res, us_ids)
  except Exception as e:  # never let the US pass break the snapshot
    print('US forecast pass failed, keeping best_match:', e, flush=True)
    us_fc = {}

for p, d in zip(centers, c_res):
  daily = d['daily']
  sf = [round(v or 0, 1) for v in daily['snowfall_sum']]
  rec = {'sf': sf, 'elev': d.get('elevation')}
  if p[0] in us_fc:
    sf2, src = us_fc[p[0]]
    rec['sf'] = sf2
    rec['sfSrc'] = src
  if HOURLY:
    hd = d.get('hourly', {}).get('snow_depth') or []
    depth = []
    for di in range(len(dates)):
      v = hd[di * 24 + 12] if di * 24 + 12 < len(hd) else None
      depth.append(round(v * 100) if v is not None else None)
    rec['depth'] = depth
  elif prev and p[0] in prev.get('resorts', {}) and prev['resorts'][p[0]].get('depth'):
    rec['depth'] = prev['resorts'][p[0]]['depth']
  else:
    rec['depth'] = []
  if 'temperature_2m_max' in daily:
    rec['tmax'] = [None if v is None else round(v, 1) for v in daily['temperature_2m_max']]
    rec['tmin'] = [None if v is None else round(v, 1) for v in daily['temperature_2m_min']]
    rec['wcode'] = daily.get('weather_code')
  if prev and p[0] in prev.get('resorts', {}):
    rec['tmax'] = rec.get('tmax') or prev['resorts'][p[0]].get('tmax')
    rec['tmin'] = rec.get('tmin') or prev['resorts'][p[0]].get('tmin')
  out['resorts'][p[0]] = rec

if prev:
  if not out['grid'] and prev.get('grid'):
    out['grid'] = prev['grid']
  if '--missing' in sys.argv:
    merged = dict(prev.get('resorts') or {})
    merged.update(out['resorts'])
    out['resorts'] = merged
    out['merged'] = out['generated']

json.dump(out, open('public/data/snow.json', 'w'), separators=(',', ':'))
print('ok', len(out['grid']), 'grid', len(out['resorts']), 'resorts', dates[0], dates[-1], 'today', ti, flush=True)

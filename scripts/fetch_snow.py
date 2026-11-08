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
today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
ti = dates.index(today) if today in dates else PAST
out = {
  'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'source': f'Open-Meteo forecast API, past_days={PAST}, forecast_days={FORECAST}; 1 center/resort (forecast chip + model-est fallback)',
  'dates': dates, 'today': ti, 'resorts': {}, 'grid': [],
}

for p, d in zip(grid_pts, g_res):
  sf = [round(v or 0, 1) for v in d['daily']['snowfall_sum']]
  out['grid'].append([p[1], p[2], sf])

for p, d in zip(centers, c_res):
  daily = d['daily']
  sf = [round(v or 0, 1) for v in daily['snowfall_sum']]
  rec = {'sf': sf, 'elev': d.get('elevation')}
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

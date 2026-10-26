"""Fetch snowfall (last 30 days + 7-day forecast) from Open-Meteo.

Sampling (kept under the free hourly weighted-call budget):
  * 2×2 heatmap grid per resort — daily snowfall_sum only (no hourly)
  * 1 mid-mountain center — daily snowfall + tmax/tmin/weathercode + hourly snow_depth

A 4×4 grid + hourly-on-every-point needed ~17 pts × ~97 resorts ≈ 1650 locations
and ~4360 weighted calls, which stalled on the old 4000/hour self-throttle.
2×2 + center is 5 pts/resort; daily-only grid calls are cheaper. ~150 resorts
land around 2000 weighted calls — one hour, no stall.

--missing: fetch only resorts absent from snow.json and merge (same date window).
Does not schedule itself; leave GitHub Action / cron paused.
"""
import json, urllib.request, urllib.parse, time, datetime, sys, os

idx = json.load(open('public/data/resorts-index.json'))
prev = None
if '--missing' in sys.argv and os.path.exists('public/data/snow.json'):
  prev = json.load(open('public/data/snow.json'))
  idx = [r for r in idx if r['id'] not in prev['resorts']]
  print('missing resorts:', len(idx), flush=True)
  if not idx:
    raise SystemExit('nothing to fetch')

N = int(os.environ.get('GRID_N', '2'))  # 2×2 heatmap
grid_pts = []  # (rid, lon, lat)
centers = []   # (rid, lon, lat, elev)
for r in idx:
  x0, y0, x1, y1 = r['bbox']
  cx, cy = r['center']
  padx = max(0.025, (x1 - x0) * 0.55)
  pady = max(0.02, (y1 - y0) * 0.55)
  if N <= 1:
    grid_pts.append((r['id'], cx, cy))
  else:
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
PER_HOUR = int(os.environ.get('PER_HOUR', '4800'))
used = []  # (ts, weight)


def days_weight(nloc, days=37, nvars=1):
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
    # Sleep until the oldest blocking call ages out, not a 5s spin that looks wedged.
    if h + w > PER_HOUR:
      oldest = min(t for t, _ in used) if used else now
      wait = max(2, oldest + 3600 - now + 1)
    else:
      oldest_m = min((t for t, _ in used if now - t < 60), default=now)
      wait = max(2, oldest_m + 60 - now + 1)
    print(f'throttle sleep {wait:.0f}s (min={m:.0f}/{PER_MIN} hour={h:.0f}/{PER_HOUR} need+{w:.0f})', flush=True)
    time.sleep(min(wait, 90))


def fetch_chunk(lats, lons, elevs=None, daily='snowfall_sum', hourly=None, batch=40):
  out = [None] * len(lats)
  for k in range(0, len(lats), batch):
    sl = slice(k, k + batch)
    n = len(lats[sl])
    q = {
      'latitude': ','.join(str(x) for x in lats[sl]),
      'longitude': ','.join(str(x) for x in lons[sl]),
      'daily': daily,
      'past_days': 30,
      'forecast_days': 7,
      'timezone': 'auto',
    }
    nvars = daily.count(',') + 1
    if hourly:
      q['hourly'] = hourly
      nvars += hourly.count(',') + 1
    if elevs is not None:
      q['elevation'] = ','.join(str(e) if e else 'nan' for e in elevs[sl])
    w = days_weight(n, 37, nvars)
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


print(f'grid pts {len(grid_pts)} centers {len(centers)}', flush=True)
g_res = fetch_chunk([p[2] for p in grid_pts], [p[1] for p in grid_pts],
                    daily='snowfall_sum', batch=50) if grid_pts else []
c_res = fetch_chunk(
  [p[2] for p in centers], [p[1] for p in centers], [p[3] for p in centers],
  daily='snowfall_sum,temperature_2m_max,temperature_2m_min,weather_code',
  hourly='snow_depth', batch=20,
)

dates = (c_res[0] if c_res else g_res[0])['daily']['time']
today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
ti = dates.index(today) if today in dates else 30
out = {
  'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'source': 'Open-Meteo forecast API (NOAA GFS/HRRR + ECMWF blend), past_days=30, forecast_days=7; 2x2 grid + mid-mountain center',
  'dates': dates, 'today': ti, 'resorts': {}, 'grid': [],
}

for p, d in zip(grid_pts, g_res):
  sf = [round(v or 0, 1) for v in d['daily']['snowfall_sum']]
  out['grid'].append([p[1], p[2], sf])

for p, d in zip(centers, c_res):
  daily = d['daily']
  sf = [round(v or 0, 1) for v in daily['snowfall_sum']]
  hd = d.get('hourly', {}).get('snow_depth') or []
  depth = []
  for di in range(len(dates)):
    v = hd[di * 24 + 12] if di * 24 + 12 < len(hd) else None
    depth.append(round(v * 100) if v is not None else None)
  rec = {'sf': sf, 'depth': depth, 'elev': d.get('elevation')}
  if 'temperature_2m_max' in daily:
    rec['tmax'] = [None if v is None else round(v, 1) for v in daily['temperature_2m_max']]
    rec['tmin'] = [None if v is None else round(v, 1) for v in daily['temperature_2m_min']]
    rec['wcode'] = daily.get('weather_code')
  out['resorts'][p[0]] = rec

if prev:
  if prev['dates'] != dates:
    raise SystemExit('date window changed since last snapshot; run a full refresh instead')
  prev['resorts'].update(out['resorts'])
  prev['grid'] += out['grid']
  prev['merged'] = out['generated']
  prev['source'] = out['source']
  out = prev

json.dump(out, open('public/data/snow.json', 'w'), separators=(',', ':'))
print('ok', len(out['grid']), 'grid', len(out['resorts']), 'resorts', dates[0], dates[-1], 'today', ti, flush=True)

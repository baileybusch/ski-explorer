"""Precompute season-to-date and past-season totals from Open-Meteo archive.

Uses daily snowfall_sum only (no hourly). Batches locations and applies the same
weighted-call throttle as scripts/fetch_snow.py.

Do not run --all from a PR if it would blow the free 10k/day budget.
Default is the top ~40 destination resorts (TOP below).

  python3 scripts/fetch_history.py
  python3 scripts/fetch_history.py --ids alta,vail,mammoth
  python3 scripts/fetch_history.py --all

Archive lag is ~5 days. Totals are coarse reanalysis, not resort-reported.
"""
import json, os, sys, datetime, time, urllib.parse, urllib.request

idx = json.load(open('public/data/resorts-index.json'))
by_id = {r['id']: r for r in idx}

TOP = [
  'alta', 'snowbird', 'deer-valley', 'park-city', 'vail', 'beaver-creek',
  'breckenridge', 'keystone', 'heavenly', 'northstar', 'kirkwood', 'palisades',
  'mammoth', 'big-sky', 'jackson-hole', 'steamboat', 'winter-park', 'copper',
  'snowmass', 'aspen-mountain', 'taos', 'sun-valley', 'telluride', 'crested-butte',
  'killington', 'stowe', 'sugarbush', 'sunday-river', 'whistler-blackcomb',
  'revelstoke', 'lake-louise', 'sunshine', 'tremblant', 'bachelor', 'crystal',
  'alyeska', 'zermatt', 'verbier', 'niseko-hirafu', 'thredbo',
]

args = sys.argv[1:]
if '--all' in args:
  rows = idx
elif '--ids' in args:
  raw = args[args.index('--ids') + 1]
  rows = [by_id[i] for i in raw.split(',') if i in by_id]
else:
  rows = [by_id[i] for i in TOP if i in by_id]

today = datetime.date.today()
as_of = today - datetime.timedelta(days=5)
start = datetime.date(as_of.year - 6, 10, 1)
days = (as_of - start).days + 1
nvars = 1
tw = max(1, (days + 13) // 14)
weight_each = tw * nvars

UA = {'User-Agent': 'ski-explorer (github.com/baileybusch/ski-explorer)'}
PER_MIN = int(os.environ.get('PER_MIN', '500'))
PER_HOUR = int(os.environ.get('PER_HOUR', '4800'))
used = []
http_calls = 0
weighted = 0.0


def throttle(w):
  global weighted
  while True:
    now = time.time()
    used[:] = [u for u in used if now - u[0] < 3600]
    minute = [(t, x) for t, x in used if now - t < 60]
    m = sum(x for _, x in minute)
    h = sum(x for _, x in used)
    # A single oversize archive batch is allowed if the window is empty.
    min_ok = m + w <= PER_MIN or (m == 0 and w <= PER_MIN * 3)
    hour_ok = h + w <= PER_HOUR or h == 0
    if min_ok and hour_ok:
      used.append((now, w))
      weighted += w
      return
    if not hour_ok:
      oldest = min(t for t, _ in used)
      wait = max(2, oldest + 3600 - now + 1)
    else:
      oldest_m = min(t for t, _ in minute) if minute else now
      wait = max(2, oldest_m + 60 - now + 1)
    print(f'throttle sleep {wait:.0f}s (min={m:.0f}/{PER_MIN} hour={h:.0f}/{PER_HOUR} need+{w:.0f})', flush=True)
    time.sleep(min(wait, 90))


def season_start(hemi, d):
  y, m = d.year, d.month
  if hemi == 'S':
    return datetime.date(y if m >= 7 else y - 1, 7, 1)
  return datetime.date(y if m >= 10 else y - 1, 10, 1)


def season_end(start_d, hemi):
  if hemi == 'S':
    return datetime.date(start_d.year + 1, 6, 30)
  return datetime.date(start_d.year + 1, 9, 30)


def sum_range(dates, vals, a, b):
  total = 0.0
  for d, v in zip(dates, vals):
    if a <= d <= b:
      total += v or 0
  return round(total, 1)


def fetch_batch(batch):
  global http_calls
  lats = [r['center'][1] for r in batch]
  lons = [r['center'][0] for r in batch]
  q = {
    'latitude': ','.join(str(x) for x in lats),
    'longitude': ','.join(str(x) for x in lons),
    'start_date': start.isoformat(),
    'end_date': as_of.isoformat(),
    'daily': 'snowfall_sum',
    'timezone': 'UTC',
  }
  w = len(batch) * weight_each
  throttle(w)
  url = 'https://archive-api.open-meteo.com/v1/archive?' + urllib.parse.urlencode(q)
  print('req', [r['id'] for r in batch], 'w', w, flush=True)
  for attempt in range(6):
    try:
      raw = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90))
      http_calls += 1
      break
    except Exception as e:
      print('retry', e, flush=True)
      time.sleep(15 * (attempt + 1))
  else:
    raise SystemExit('archive fetch failed')
  if isinstance(raw, dict):
    raw = [raw]
  return raw


def row_history(r, daily):
  hemi = 'S' if r.get('hemisphere') == 'S' else 'N'
  dates = [datetime.date.fromisoformat(d) for d in daily['time']]
  vals = daily.get('snowfall_sum') or []
  this_start = season_start(hemi, as_of)
  current = sum_range(dates, vals, this_start, as_of)
  same, full = [], []
  for i in range(1, 6):
    past_asof = datetime.date(as_of.year - i, as_of.month, as_of.day)
    past_start = season_start(hemi, past_asof)
    same.append({'year': past_asof.year, 'cm': sum_range(dates, vals, past_start, past_asof)})
    end = season_end(past_start, hemi)
    label = f'{past_start.year}-{str(end.year)[2:]}'
    full.append({'label': label, 'year': past_start.year, 'cm': sum_range(dates, vals, past_start, end)})
  same.reverse()
  full.reverse()
  return {
    'hemi': hemi,
    'currentStdCm': current,
    'sameDate': same,
    'fullSeasons': full,
  }


out_path = 'public/data/history.json'
prev = {'resorts': {}}
if os.path.exists(out_path):
  try:
    prev = json.load(open(out_path))
  except Exception:
    prev = {'resorts': {}}

print(f'resorts {len(rows)} range {start} → {as_of} days {days} weight/loc {weight_each}', flush=True)
print(f'estimated weighted calls {len(rows) * weight_each}', flush=True)

BATCH = int(os.environ.get('BATCH', '3'))
resorts = dict(prev.get('resorts') or {})
for i in range(0, len(rows), BATCH):
  chunk = rows[i:i + BATCH]
  payload = fetch_batch(chunk)
  for r, d in zip(chunk, payload):
    resorts[r['id']] = row_history(r, d.get('daily') or {})
  time.sleep(0.5)

out = {
  'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'source': 'Open-Meteo historical archive API (ERA5-class reanalysis), daily snowfall_sum. Coarse modeled totals, not resort-reported.',
  'asOf': as_of.isoformat(),
  'start': start.isoformat(),
  'httpCalls': http_calls,
  'weightedCalls': round(weighted, 1),
  'resorts': resorts,
}
json.dump(out, open(out_path, 'w'), separators=(',', ':'))
print('ok', len(resorts), 'resorts http', http_calls, 'weighted', round(weighted, 1), 'wrote', out_path, flush=True)
print('extend: python3 scripts/fetch_history.py --ids id1,id2   or   --all', flush=True)

"""Build public/data/typical.json — per-day average snowfall (cm) across stored seasons.
Northern-hemisphere files are Nov 1–Apr 30; southern (when present) Jun 1–Sep 30.
Used as a clearly-labeled "typical, not forecast" fallback past the 7-day horizon.
"""
import json, os, glob

OUT = 'public/data/typical.json'
seasons = {}
for fn in sorted(glob.glob('public/data/seasons/[0-9][0-9][0-9][0-9].json')):
  y = int(os.path.basename(fn)[:4])
  seasons[y] = json.load(open(fn))

# Group by start date so NH and (future) SH windows don't mix.
by_cal = {}  # start -> {rid: list of season arrays}
for y, s in seasons.items():
  by_cal.setdefault(s['start'][5:], []).append(s)

typical = {'source': 'Average of Open-Meteo ERA5 season archives already in public/data/seasons/', 'windows': {}}
for start, lst in by_cal.items():
  days = lst[0]['days']
  acc = {}
  n = {}
  for s in lst:
    for rid, arr in s['resorts'].items():
      if len(arr) != days:
        continue
      if rid not in acc:
        acc[rid] = [0.0] * days
        n[rid] = 0
      for i, v in enumerate(arr):
        acc[rid][i] += v or 0
      n[rid] += 1
  typical['windows'][start] = {
    'days': days,
    'seasons': len(lst),
    'resorts': {rid: [round(acc[rid][i] / n[rid], 2) for i in range(days)] for rid in acc if n[rid]},
  }

json.dump(typical, open(OUT, 'w'), separators=(',', ':'))
print('typical', {k: (v['days'], v['seasons'], len(v['resorts'])) for k, v in typical['windows'].items()})

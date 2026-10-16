"""Fetch past-season daily snowfall (Nov 1 - Apr 30) per resort at the mid-mountain point
from the Open-Meteo historical archive API. Writes public/data/seasons/<startYear>.json and
public/data/seasons/summary.json. Skips seasons already on disk (pass --force to refetch).
Rate limits: archive calls are weighted (~days/14 per location), so we pace requests to stay
well under 600/min and 5000/hour."""
import json,urllib.request,urllib.parse,time,datetime,os,sys
idx=json.load(open('public/data/resorts-index.json'))
OUT='public/data/seasons'; os.makedirs(OUT,exist_ok=True)
first=int(os.environ.get('FIRST',2015)); last=int(os.environ.get('LAST',2025))
force='--force' in sys.argv
UA={'User-Agent':'ski-explorer (github.com/baileybusch/ski-explorer)'}
B=10  # locations per request -> weight ~ 10*181/14 = ~130
PER_MIN=400; used=[]  # (ts, weight)
def throttle(w):
  while True:
    now=time.time(); used[:]=[u for u in used if now-u[0]<3600]
    m=sum(x for t,x in used if now-t<60); h=sum(x for t,x in used)
    if m+w<=PER_MIN and h+w<=4500: used.append((now,w)); return
    time.sleep(5)
def elev(r): return round(r['base']+0.6*(r['summit']-r['base'])) if r['summit'] and r['base'] else 'nan'
for y in range(last,first-1,-1):
  fn=f'{OUT}/{y}.json'
  if os.path.exists(fn) and not force: continue
  s,e=f'{y}-11-01',f'{y+1}-04-30'
  days=(datetime.date(y+1,4,30)-datetime.date(y,11,1)).days+1
  res={}
  for k in range(0,len(idx),B):
    ch=idx[k:k+B]
    q={'latitude':','.join(str(r['center'][1]) for r in ch),'longitude':','.join(str(r['center'][0]) for r in ch),
       'elevation':','.join(str(elev(r)) for r in ch),'start_date':s,'end_date':e,'daily':'snowfall_sum','timezone':'America/Denver'}
    url='https://archive-api.open-meteo.com/v1/archive?'+urllib.parse.urlencode(q)
    throttle(len(ch)*days/14); print('req',y,k,round(time.time()),flush=True)
    for a in range(8):
      try: d=json.load(urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90)); break
      except Exception as ex: print('retry',y,k,ex,flush=True); time.sleep(60*(a+1))
    else: raise SystemExit('failed')
    d=d if isinstance(d,list) else [d]
    for r,dd in zip(ch,d): res[r['id']]=[round(v or 0,1) for v in dd['daily']['snowfall_sum']]
  json.dump({'season':f'{y}-{str(y+1)[2:]}','start':s,'days':days,'resorts':res},open(fn,'w'),separators=(',',':'))
  print('season',y,'done',flush=True)
# summary
summ={'seasons':[],'totals':{}}
for y in range(first,last+1):
  fn=f'{OUT}/{y}.json'
  if not os.path.exists(fn): continue
  d=json.load(open(fn)); summ['seasons'].append(y)
  for rid,v in d['resorts'].items(): summ['totals'].setdefault(rid,{})[y]=round(sum(v),1)
json.dump(summ,open(f'{OUT}/summary.json','w'),separators=(',',':'))
print('summary',summ['seasons'])

"""Fetch snowfall (last 30 days + 7-day forecast) from Open-Meteo for a grid around each resort.
Writes public/data/snow.json. Run daily (GitHub Action).
--missing: only fetch resorts absent from the existing snow.json and merge them in (same date window),
to save Open-Meteo quota when adding resorts. Requests are paced to <=400 weighted calls/min."""
import json,urllib.request,urllib.parse,time,datetime,sys,os
idx=json.load(open('public/data/resorts-index.json'))
prev=None
if '--missing' in sys.argv and os.path.exists('public/data/snow.json'):
  prev=json.load(open('public/data/snow.json'))
  idx=[r for r in idx if r['id'] not in prev['resorts']]
  print('missing resorts:',len(idx))
  if not idx: raise SystemExit('nothing to fetch')
N=4  # grid NxN
pts=[]  # (rid, kind, lon, lat, elev)
for r in idx:
  x0,y0,x1,y1=r['bbox'];cx,cy=r['center']
  padx=max(0.03,(x1-x0)*0.6);pady=max(0.025,(y1-y0)*0.6)
  for i in range(N):
    for j in range(N):
      pts.append((r['id'],'g',round(cx-padx+2*padx*i/(N-1),4),round(cy-pady+2*pady*j/(N-1),4),None))
  el=None
  if r['summit'] and r['base']: el=round(r['base']+0.6*(r['summit']-r['base']))
  pts.append((r['id'],'c',cx,cy,el))
UA={'User-Agent':'ski-explorer (github.com/baileybusch/ski-explorer)'}
res=[None]*len(pts)
B=50
used=[]  # (ts, weight); Open-Meteo weights >14 days and >10 vars as multiple calls
def throttle(w,per_min=400,per_hour=4000):
  while True:
    now=time.time(); used[:]=[u for u in used if now-u[0]<3600]
    m=sum(x for t,x in used if now-t<60); h=sum(x for t,x in used)
    if m+w<=per_min and h+w<=per_hour: used.append((now,w)); return
    time.sleep(5)
for k in range(0,len(pts),B):
  chunk=pts[k:k+B]
  q={'latitude':','.join(str(p[3]) for p in chunk),'longitude':','.join(str(p[2]) for p in chunk),
     'daily':'snowfall_sum','hourly':'snow_depth','past_days':30,'forecast_days':7,'timezone':'America/Denver'}
  if all(p[4] for p in chunk) or True:
    q['elevation']=','.join(str(p[4]) if p[4] else 'nan' for p in chunk)
  url='https://api.open-meteo.com/v1/forecast?'+urllib.parse.urlencode(q)
  throttle(len(chunk)*37/14); print('req',k,len(pts),flush=True)
  for attempt in range(6):
    try:
      d=json.load(urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60));break
    except Exception as e:
      print('retry',k,e);time.sleep(20*(attempt+1))
  else: raise SystemExit('failed')
  if isinstance(d,dict): d=[d]
  for i,dd in enumerate(d): res[k+i]=dd
  time.sleep(1.5)
dates=res[0]['daily']['time']
today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-7))).date().isoformat()
ti=dates.index(today) if today in dates else 30
out={'generated':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Open-Meteo forecast API (NOAA GFS/HRRR + ECMWF blend), past_days=30, forecast_days=7',
     'dates':dates,'today':ti,'resorts':{},'grid':[]}
for p,d in zip(pts,res):
  sf=[round(v or 0,1) for v in d['daily']['snowfall_sum']]
  if p[1]=='g': out['grid'].append([p[2],p[3],sf])
  else:
    hd=d['hourly']['snow_depth'];depth=[]
    for di in range(len(dates)):
      v=hd[di*24+12] if di*24+12<len(hd) else None
      depth.append(round(v*100) if v is not None else None)
    out['resorts'][p[0]]={'sf':sf,'depth':depth,'elev':d.get('elevation')}
if prev:
  if prev['dates']!=dates: raise SystemExit('date window changed since last snapshot; run a full refresh instead')
  prev['resorts'].update(out['resorts']); prev['grid']+=out['grid']
  prev['merged']=out['generated']; out=prev
json.dump(out,open('public/data/snow.json','w'),separators=(',',':'))
print('ok',len(out['grid']),dates[0],dates[-1],ti)

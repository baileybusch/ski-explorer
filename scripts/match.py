import json,math
areas=json.load(open('raw/ski_areas.geojson'))['features']
R=json.load(open('scripts/resorts.json'))
def dist(a,b,c,d): return math.hypot((a-c)*111,(b-d)*111*math.cos(math.radians(a)))
out=[]
for sid,name,tok,st,lat,lon,ikon in R:
  best=None
  for a in areas:
    p=a['properties']
    if 'downhill' not in (p.get('activities') or []): continue
    c=(p.get('viewportHint') or {}).get('center')
    if not c:
      g=a['geometry']
      if g['type']!='Point': continue
      c=g['coordinates']
    d=dist(lat,lon,c[1],c[0])
    if d>12: continue
    nm=(p.get('name') or '')
    runs=((p.get('statistics') or {}).get('runs') or {}).get('byActivity',{}).get('downhill',{}).get('byDifficulty',{})
    n=sum(v['count'] for v in runs.values())
    score=(tok.lower() in nm.lower())*1000+n-d*3
    if not best or score>best[0]: best=(score,a,nm,n,d)
  if not best: print('MISS',name); continue
  print(f"{name:30} -> {best[2]:40} runs={best[3]} d={best[4]:.1f}")
  out.append(dict(id=sid,name=name,state=st,ikon=ikon,osm=best[1]['properties']['id'],osmName=best[2]))
json.dump(out,open('scripts/matched.json','w'),indent=0)

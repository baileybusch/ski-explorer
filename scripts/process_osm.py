import json,math
M=json.load(open('scripts/matched.json'))
ids={m['osm']:m['id'] for m in M}
areas={a['properties']['id']:a for a in json.load(open('raw/ski_areas.geojson'))['features'] if a['properties']['id'] in ids}
feats={m['id']:{'runs':[],'lifts':[]} for m in M}
def simp(coords,tol=0.00005):
  out=[coords[0]]
  for c in coords[1:-1]:
    if abs(c[0]-out[-1][0])+abs(c[1]-out[-1][1])>tol: out.append(c)
  if len(coords)>1: out.append(coords[-1])
  return [[round(c[0],5),round(c[1],5)] for c in out]
def geom(g):
  t=g['type'];c=g['coordinates']
  if t=='LineString': return {'type':t,'coordinates':simp(c)}
  if t=='MultiLineString': return {'type':t,'coordinates':[simp(l) for l in c]}
  if t=='Polygon': return {'type':'LineString','coordinates':simp(c[0])}
  if t=='MultiPolygon': return {'type':'MultiLineString','coordinates':[simp(p[0]) for p in c]}
  return None
for kind in ('runs','lifts'):
  for line in open(f'raw/{kind}.geojson'):
    line=line.strip().rstrip(',')
    if not line.startswith('{"type":"Feature"'): continue
    if not any(i in line for i in ids): continue
    f=json.loads(line);p=f['properties']
    sa=[ (s.get('properties') or s).get('id') for s in p.get('skiAreas',[])]
    rid=next((ids[s] for s in sa if s in ids),None)
    if not rid: continue
    if kind=='runs' and 'downhill' not in (p.get('uses') or []): continue
    g=geom(f['geometry'])
    if not g: continue
    pr={'n':p.get('name') or ''}
    if kind=='runs': pr['d']=p.get('difficulty') or 'other'
    else: pr['t']=p.get('liftType') or ''
    if p.get('status') not in (None,'operating'): continue
    feats[rid][kind].append({'type':'Feature','geometry':g,'properties':pr})
idx=[]
for m in M:
  a=areas[m['osm']];p=a['properties'];st=p.get('statistics') or {}
  fs=feats[m['id']]
  xs=[];ys=[]
  for f in fs['runs']+fs['lifts']:
    g=f['geometry'];ls=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
    for l in ls:
      for c in l: xs.append(c[0]);ys.append(c[1])
  c=(p.get('viewportHint') or {}).get('center') or a['geometry']['coordinates']
  bbox=[min(xs),min(ys),max(xs),max(ys)] if xs else [c[0]-.02,c[1]-.02,c[0]+.02,c[1]+.02]
  top=st.get('maxElevation');bot=st.get('minElevation')
  passes=[k for k in ('ikon','epic') if m.get(k) and not (k=='ikon' and m['id']=='eagle-point')]
  idx.append(dict(id=m['id'],name=m['name'],state=m['state'],ikon=m['ikon'],epic=m.get('epic'),passes=passes,center=[round(c[0],5),round(c[1],5)],bbox=[round(v,4) for v in bbox],
    summit=round(top) if top else None,base=round(bot) if bot else None,
    runs=len(fs['runs']),lifts=len(fs['lifts']),bearing=round((p.get('viewportHint') or {}).get('bearing') or 0),web=(p.get('websites') or [None])[0]))
  json.dump({'type':'FeatureCollection','features':[{**f,'properties':{**f['properties'],'k':'run'}} for f in fs['runs']]+[{**f,'properties':{**f['properties'],'k':'lift'}} for f in fs['lifts']]},open(f"public/data/resorts/{m['id']}.json",'w'),separators=(',',':'))
  print(m['id'],len(fs['runs']),len(fs['lifts']))
json.dump(idx,open('scripts/index_osm.json','w'))

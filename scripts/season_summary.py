import json,os,glob
OUT='public/data/seasons'; summ={'seasons':[],'totals':{}}
for fn in sorted(glob.glob(f'{OUT}/[0-9]*.json')):
  y=int(os.path.basename(fn)[:4]); d=json.load(open(fn)); summ['seasons'].append(y)
  for rid,v in d['resorts'].items(): summ['totals'].setdefault(rid,{})[y]=round(sum(v),1)
json.dump(summ,open(f'{OUT}/summary.json','w'),separators=(',',':')); print(summ['seasons'])

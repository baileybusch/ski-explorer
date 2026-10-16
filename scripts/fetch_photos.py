"""Curate ski photos from Wikimedia Commons categories (CC BY / CC BY-SA / CC0 / PD only).
Writes public/photos/<n>.jpg (1200px) and public/photos/photos.json with credit metadata."""
import json,urllib.request,urllib.parse,re,os,subprocess,html
UA={'User-Agent':'ski-explorer/1.0 (github.com/baileybusch/ski-explorer; baileybusch@gmail.com)'}
API='https://commons.wikimedia.org/w/api.php'
def q(**p):
  p.update(format='json'); return json.load(urllib.request.urlopen(urllib.request.Request(API+'?'+urllib.parse.urlencode(p),headers=UA),timeout=60))
CATS=['Category:Freeskiing','Category:Off-piste skiing','Category:Powder skiing','Category:Ski mountaineering in Alaska','Category:Heliskiing','Category:Skiing in Alaska','Category:Alyeska Resort','Category:Jackson Hole Mountain Resort','Category:Alta Ski Area','Category:Snowbird ski resort','Category:Big Sky Resort','Category:Whistler Blackcomb','Category:Freeride','Category:Backcountry skiing','Category:Telemark skiing','Category:Mammoth Mountain Ski Area','Category:Ski touring in the United States','Category:Skiing in Utah','Category:Skiing in Colorado','Category:Revelstoke Mountain Resort']
seen=set(); cands=[]
for c in CATS:
  try: r=q(action='query',generator='categorymembers',gcmtitle=c,gcmtype='file',gcmlimit=50,prop='imageinfo',iiprop='url|size|extmetadata|mime',iiurlwidth=1200)
  except Exception as e: print('err',c,e); continue
  for p in (r.get('query',{}).get('pages',{}) or {}).values():
    ii=(p.get('imageinfo') or [{}])[0]; m=ii.get('extmetadata',{})
    if p['title'] in seen or ii.get('mime')!='image/jpeg' or ii.get('width',0)<1600 or ii.get('width',0)<ii.get('height',1)*1.2: continue
    lic=m.get('LicenseShortName',{}).get('value','')
    if not re.match(r'^(CC BY(-SA)? [0-9.]+|CC0|Public domain)',lic): continue
    seen.add(p['title'])
    strip=lambda s: re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',s or ''))).strip()
    cands.append(dict(title=p['title'],cat=c[9:],thumb=ii.get('thumburl'),page=ii.get('descriptionurl'),license=lic,licenseUrl=m.get('LicenseUrl',{}).get('value',''),
      artist=strip(m.get('Artist',{}).get('value',''))[:80],desc=strip(m.get('ImageDescription',{}).get('value',''))[:200],w=ii['width']))
json.dump(cands,open('/tmp/photo_cands.json','w'),indent=1)
print(len(cands)); 
from collections import Counter; print(Counter(c['cat'] for c in cands))

"""Merge OSM index + curated international destinations + airport/region metadata.
Writes public/data/resorts-index.json, appends new rows to scripts/resorts.json,
and creates empty OSM GeoJSON stubs for new ids.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX_PATH = os.path.join(ROOT, 'public/data/resorts-index.json')
DEST_PATH = os.path.join(ROOT, 'scripts/destinations.json')
RES_PATH = os.path.join(ROOT, 'scripts/resorts.json')
OSM_DIR = os.path.join(ROOT, 'public/data/resorts')

# Existing NA resorts: region / country / nearest commercial airport / town.
# Airports are the usual ski-week gateway, not always the closest airstrip.
META = {
  'alta': dict(country='US', region='Utah', subregion='Wasatch', town='Alta', iata='SLC'),
  'snowbird': dict(country='US', region='Utah', subregion='Wasatch', town='Snowbird', iata='SLC'),
  'brighton': dict(country='US', region='Utah', subregion='Wasatch', town='Brighton', iata='SLC'),
  'solitude': dict(country='US', region='Utah', subregion='Wasatch', town='Solitude', iata='SLC'),
  'deer-valley': dict(country='US', region='Utah', subregion='Wasatch', town='Park City', iata='SLC'),
  'snowbasin': dict(country='US', region='Utah', subregion='Ogden', town='Huntsville', iata='SLC'),
  'eagle-point': dict(country='US', region='Utah', subregion='Southern Utah', town='Beaver', iata='CDC'),
  'arapahoe-basin': dict(country='US', region='Colorado', subregion='Summit', town='Dillon', iata='DEN'),
  'copper': dict(country='US', region='Colorado', subregion='Summit', town='Copper Mountain', iata='DEN'),
  'eldora': dict(country='US', region='Colorado', subregion='Front Range', town='Nederland', iata='DEN'),
  'steamboat': dict(country='US', region='Colorado', subregion='Yampa', town='Steamboat Springs', iata='HDN'),
  'winter-park': dict(country='US', region='Colorado', subregion='Fraser Valley', town='Winter Park', iata='DEN'),
  'aspen-mountain': dict(country='US', region='Colorado', subregion='Roaring Fork', town='Aspen', iata='ASE'),
  'snowmass': dict(country='US', region='Colorado', subregion='Roaring Fork', town='Snowmass Village', iata='ASE'),
  'aspen-highlands': dict(country='US', region='Colorado', subregion='Roaring Fork', town='Aspen', iata='ASE'),
  'buttermilk': dict(country='US', region='Colorado', subregion='Roaring Fork', town='Aspen', iata='ASE'),
  'taos': dict(country='US', region='New Mexico', subregion='Sangre de Cristo', town='Taos Ski Valley', iata='ABQ'),
  'jackson-hole': dict(country='US', region='Wyoming', subregion='Tetons', town='Teton Village', iata='JAC'),
  'big-sky': dict(country='US', region='Montana', subregion='Madison', town='Big Sky', iata='BZN'),
  'sun-valley': dict(country='US', region='Idaho', subregion='Wood River', town='Ketchum', iata='SUN'),
  'schweitzer': dict(country='US', region='Idaho', subregion='Panhandle', town='Sandpoint', iata='GEG'),
  'mammoth': dict(country='US', region='California', subregion='Eastern Sierra', town='Mammoth Lakes', iata='MMH'),
  'june': dict(country='US', region='California', subregion='Eastern Sierra', town='June Lake', iata='MMH'),
  'palisades': dict(country='US', region='Tahoe', subregion='North Tahoe', town='Olympic Valley', iata='RNO'),
  'alpine-meadows': dict(country='US', region='Tahoe', subregion='North Tahoe', town='Alpine Meadows', iata='RNO'),
  'sierra-at-tahoe': dict(country='US', region='Tahoe', subregion='South Tahoe', town='Twin Bridges', iata='RNO'),
  'big-bear': dict(country='US', region='Southern California', subregion='San Bernardino', town='Big Bear Lake', iata='ONT'),
  'snow-summit': dict(country='US', region='Southern California', subregion='San Bernardino', town='Big Bear Lake', iata='ONT'),
  'snow-valley': dict(country='US', region='Southern California', subregion='San Bernardino', town='Running Springs', iata='ONT'),
  'crystal': dict(country='US', region='Washington', subregion='Cascades', town='Enumclaw', iata='SEA'),
  'snoqualmie': dict(country='US', region='Washington', subregion='Cascades', town='Snoqualmie Pass', iata='SEA'),
  'bachelor': dict(country='US', region='Oregon', subregion='Cascades', town='Bend', iata='RDM'),
  'alyeska': dict(country='US', region='Alaska', subregion='Kenai', town='Girdwood', iata='ANC'),
  'killington': dict(country='US', region='Vermont', subregion='Green Mountains', town='Killington', iata='BOS'),
  'pico': dict(country='US', region='Vermont', subregion='Green Mountains', town='Killington', iata='BOS'),
  'stratton': dict(country='US', region='Vermont', subregion='Green Mountains', town='Stratton', iata='ALB'),
  'sugarbush': dict(country='US', region='Vermont', subregion='Mad River', town='Warren', iata='BTV'),
  'sugarloaf': dict(country='US', region='Maine', subregion='Carrabassett', town='Carrabassett Valley', iata='PWM'),
  'sunday-river': dict(country='US', region='Maine', subregion='Western Maine', town='Newry', iata='PWM'),
  'loon': dict(country='US', region='New Hampshire', subregion='White Mountains', town='Lincoln', iata='BOS'),
  'snowshoe': dict(country='US', region='West Virginia', subregion='Alleghenies', town='Snowshoe', iata='CRW'),
  'blue-mountain-pa': dict(country='US', region='Pennsylvania', subregion='Poconos', town='Palmerton', iata='ABE'),
  'camelback': dict(country='US', region='Pennsylvania', subregion='Poconos', town='Tannersville', iata='AVP'),
  'boyne': dict(country='US', region='Michigan', subregion='Northwest Michigan', town='Boyne Falls', iata='TVC'),
  'highlands-mi': dict(country='US', region='Michigan', subregion='Northwest Michigan', town='Harbor Springs', iata='PLN'),
  'snowriver': dict(country='US', region='Michigan', subregion='UP', town='Wakefield', iata='IWD'),
  'lutsen': dict(country='US', region='Minnesota', subregion='North Shore', town='Lutsen', iata='DLH'),
  'granite-peak': dict(country='US', region='Wisconsin', subregion='Central Wisconsin', town='Wausau', iata='CWA'),
  'tremblant': dict(country='CA', region='Quebec', subregion='Laurentians', town='Mont-Tremblant', iata='YUL'),
  'le-massif': dict(country='CA', region='Quebec', subregion='Charlevoix', town='Petite-Rivière-Saint-François', iata='YQB'),
  'blue-mountain-on': dict(country='CA', region='Ontario', subregion='Georgian Bay', town='Blue Mountains', iata='YYZ'),
  'revelstoke': dict(country='CA', region='British Columbia', subregion='Columbia', town='Revelstoke', iata='YLW'),
  'red': dict(country='CA', region='British Columbia', subregion='Kootenays', town='Rossland', iata='GEG'),
  'panorama': dict(country='CA', region='British Columbia', subregion='Kootenays', town='Panorama', iata='YXC'),
  'sun-peaks': dict(country='CA', region='British Columbia', subregion='Thompson', town='Sun Peaks', iata='YLW'),
  'silverstar': dict(country='CA', region='British Columbia', subregion='Okanagan', town='Vernon', iata='YLW'),
  'cypress': dict(country='CA', region='British Columbia', subregion='North Shore', town='West Vancouver', iata='YVR'),
  'lake-louise': dict(country='CA', region='Alberta', subregion='Banff', town='Lake Louise', iata='YYC'),
  'sunshine': dict(country='CA', region='Alberta', subregion='Banff', town='Banff', iata='YYC'),
  'norquay': dict(country='CA', region='Alberta', subregion='Banff', town='Banff', iata='YYC'),
  'vail': dict(country='US', region='Colorado', subregion='Vail Valley', town='Vail', iata='EGE'),
  'beaver-creek': dict(country='US', region='Colorado', subregion='Vail Valley', town='Avon', iata='EGE'),
  'breckenridge': dict(country='US', region='Colorado', subregion='Summit', town='Breckenridge', iata='DEN'),
  'keystone': dict(country='US', region='Colorado', subregion='Summit', town='Keystone', iata='DEN'),
  'crested-butte': dict(country='US', region='Colorado', subregion='Gunnison', town='Mt. Crested Butte', iata='GUC'),
  'park-city': dict(country='US', region='Utah', subregion='Wasatch', town='Park City', iata='SLC'),
  'heavenly': dict(country='US', region='Tahoe', subregion='South Tahoe', town='South Lake Tahoe', iata='RNO'),
  'northstar': dict(country='US', region='Tahoe', subregion='North Tahoe', town='Truckee', iata='RNO'),
  'kirkwood': dict(country='US', region='Tahoe', subregion='South Tahoe', town='Kirkwood', iata='RNO'),
  'stevens-pass': dict(country='US', region='Washington', subregion='Cascades', town='Skykomish', iata='SEA'),
  'whistler-blackcomb': dict(country='CA', region='British Columbia', subregion='Sea to Sky', town='Whistler', iata='YVR'),
  'stowe': dict(country='US', region='Vermont', subregion='Green Mountains', town='Stowe', iata='BTV'),
  'okemo': dict(country='US', region='Vermont', subregion='Green Mountains', town='Ludlow', iata='ALB'),
  'mount-snow': dict(country='US', region='Vermont', subregion='Green Mountains', town='West Dover', iata='ALB'),
  'mount-sunapee': dict(country='US', region='New Hampshire', subregion='Sunapee', town='Newbury', iata='MHT'),
  'attitash': dict(country='US', region='New Hampshire', subregion='White Mountains', town='Bartlett', iata='PWM'),
  'wildcat': dict(country='US', region='New Hampshire', subregion='White Mountains', town='Pinkham Notch', iata='PWM'),
  'crotched': dict(country='US', region='New Hampshire', subregion='Southern NH', town='Francestown', iata='MHT'),
  'hunter': dict(country='US', region='New York', subregion='Catskills', town='Hunter', iata='ALB'),
  'liberty': dict(country='US', region='Pennsylvania', subregion='South Central', town='Carroll Valley', iata='MDT'),
  'roundtop': dict(country='US', region='Pennsylvania', subregion='South Central', town='Lewisberry', iata='MDT'),
  'whitetail': dict(country='US', region='Pennsylvania', subregion='South Central', town='Mercersburg', iata='MDT'),
  'jack-frost': dict(country='US', region='Pennsylvania', subregion='Poconos', town='Blakeslee', iata='AVP'),
  'big-boulder': dict(country='US', region='Pennsylvania', subregion='Poconos', town='Lake Harmony', iata='AVP'),
  'seven-springs': dict(country='US', region='Pennsylvania', subregion='Laurel Highlands', town='Seven Springs', iata='PIT'),
  'laurel-mountain': dict(country='US', region='Pennsylvania', subregion='Laurel Highlands', town='Ligonier', iata='PIT'),
  'hidden-valley-pa': dict(country='US', region='Pennsylvania', subregion='Laurel Highlands', town='Hidden Valley', iata='PIT'),
  'afton-alps': dict(country='US', region='Minnesota', subregion='Twin Cities', town='Hastings', iata='MSP'),
  'mt-brighton': dict(country='US', region='Michigan', subregion='Southeast Michigan', town='Brighton', iata='DTW'),
  'wilmot': dict(country='US', region='Wisconsin', subregion='Southeast Wisconsin', town='Wilmot', iata='MKE'),
  'alpine-valley-oh': dict(country='US', region='Ohio', subregion='Northeast Ohio', town='Chesterland', iata='CLE'),
  'boston-mills': dict(country='US', region='Ohio', subregion='Northeast Ohio', town='Peninsula', iata='CLE'),
  'brandywine': dict(country='US', region='Ohio', subregion='Northeast Ohio', town='Sagamore Hills', iata='CLE'),
  'mad-river': dict(country='US', region='Ohio', subregion='Western Ohio', town='Zanesfield', iata='CMH'),
  'hidden-valley-mo': dict(country='US', region='Missouri', subregion='St. Louis', town='Wildwood', iata='STL'),
  'snow-creek': dict(country='US', region='Missouri', subregion='Kansas City', town='Weston', iata='MCI'),
  'paoli-peaks': dict(country='US', region='Indiana', subregion='Southern Indiana', town='Paoli', iata='SDF'),
}

def pad_bbox(lon, lat, d=0.04):
  return [round(lon - d, 4), round(lat - d, 4), round(lon + d, 4), round(lat + d, 4)]

def apply_meta(r, extra=None):
  m = dict(META.get(r['id'], {}))
  if extra:
    for k in ('country','region','subregion','town','iata','aliases','hemisphere','web'):
      if extra.get(k) is not None:
        m[k] = extra[k]
  r['country'] = m.get('country') or r.get('country')
  r['region'] = m.get('region') or r.get('region') or r.get('state')
  r['subregion'] = m.get('subregion')
  r['town'] = m.get('town')
  r['iata'] = m.get('iata')
  r['aliases'] = m.get('aliases') or []
  r['hemisphere'] = m.get('hemisphere') or ('S' if (r.get('center') or [0,0])[1] < 0 else 'N')
  if m.get('web') and not r.get('web'):
    r['web'] = m['web']
  return r

idx = json.load(open(IDX_PATH))
by = {r['id']: r for r in idx}
for r in idx:
  apply_meta(r)

dest = json.load(open(DEST_PATH))['resorts']
added = []
for d in dest:
  lon, lat = d['lon'], d['lat']
  passes = [k for k in ('ikon','epic') if d.get(k)]
  row = dict(
    id=d['id'], name=d['name'], state=d['state'],
    ikon=d.get('ikon'), epic=d.get('epic'), passes=passes,
    center=[round(lon, 5), round(lat, 5)],
    bbox=pad_bbox(lon, lat, 0.035),
    summit=d.get('summit'), base=d.get('base'),
    runs=d.get('runs'), lifts=d.get('lifts'),
    bearing=d.get('bearing') or 0, web=d.get('web'),
  )
  apply_meta(row, d)
  if d['id'] in by:
    # keep OSM geometry/stats; overlay trip fields
    apply_meta(by[d['id']], d)
    by[d['id']]['ikon'] = d.get('ikon') if d.get('ikon') is not None else by[d['id']].get('ikon')
    by[d['id']]['epic'] = d.get('epic') if d.get('epic') is not None else by[d['id']].get('epic')
    by[d['id']]['passes'] = [k for k in ('ikon','epic') if by[d['id']].get(k) and not (k=='ikon' and d['id']=='eagle-point')]
  else:
    idx.append(row)
    by[row['id']] = row
    added.append(row)
    stub = os.path.join(OSM_DIR, f"{row['id']}.json")
    if not os.path.exists(stub):
      json.dump({'type':'FeatureCollection','features':[]}, open(stub,'w'), separators=(',',':'))

# resorts.json rows for match.py / docs
rows = json.load(open(RES_PATH))
have = {r[0] for r in rows}
for d in dest:
  if d['id'] not in have:
    rows.append([d['id'], d['name'], d['token'], d['state'], d['lat'], d['lon'], d.get('ikon'), d.get('epic')])
    have.add(d['id'])

json.dump(idx, open(IDX_PATH,'w'), separators=(',',':'))
json.dump(rows, open(RES_PATH,'w'), indent=0)
print('index', len(idx), 'added', [r['id'] for r in added])
print('missing iata', [r['id'] for r in idx if not r.get('iata')])

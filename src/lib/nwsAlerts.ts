/**
 * NWS winter alerts — US only, public domain.
 * https://www.weather.gov/documentation/services-web-api
 * Label clearly in the UI. Geometry is missing on some alerts; those are dropped.
 */
const EVENTS = [
  'Winter Storm Warning',
  'Winter Storm Watch',
  'Blizzard Warning',
  'Ice Storm Warning',
  'Winter Weather Advisory',
];

const TTL = 20 * 60 * 1000;
let cache: { t: number; data: any } | null = null;

const SKI_STATES = ['UT', 'CO', 'CA', 'NV', 'WA', 'OR', 'ID', 'MT', 'WY', 'NM', 'VT', 'NH', 'ME', 'NY', 'PA', 'AK'];

export async function fetchNwsWinterAlerts(states: string[] = SKI_STATES) {
  if (cache && Date.now() - cache.t < TTL) return cache.data;
  const features: any[] = [];
  // One area per request. Only when the layer is on; cached 20 min.
  const areas = states.slice(0, 8);
  await Promise.all(areas.map(async area => {
    try {
      const url = `https://api.weather.gov/alerts/active?area=${area}&status=actual`;
      const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
      if (!res.ok) return;
      const json = await res.json();
      for (const f of json.features || []) {
        const ev = f.properties?.event || '';
        if (!EVENTS.some(e => ev.includes(e.replace(' Warning', '').split(' ')[0]) || ev === e || EVENTS.includes(ev))) {
          if (!/winter|blizzard|ice storm/i.test(ev)) continue;
        }
        if (!f.geometry) continue;
        features.push({
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            event: ev,
            headline: f.properties?.headline || ev,
            severity: f.properties?.severity,
            area: f.properties?.areaDesc,
          },
        });
      }
    } catch { /* fail soft */ }
  }));
  const data = { type: 'FeatureCollection', features, source: 'NWS', usOnly: true };
  cache = { t: Date.now(), data };
  return data;
}

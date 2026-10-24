import { defaultWindow } from '../../lib/snowWindow.js';

export function attachSnow(resorts: any[], snow: any) {
  const D = snow.dates.length;
  const TODAY = snow.today;
  for (const r of resorts) {
    const s = snow.resorts[r.id] || { sf: Array(D).fill(0), depth: [], tmax: null };
    r.sf = s.sf; r.depth = s.depth; r.tmax = s.tmax; r.tmin = s.tmin; r.wcode = s.wcode;
    const sum = (a: number, b: number) => (r.sf || []).slice(a, b).reduce((x: number, y: number) => x + y, 0);
    r.d1 = sum(TODAY, TODAY + 1);
    r.d24 = r.sf[TODAY - 1] ?? 0;
    r.d7 = sum(TODAY - 6, TODAY + 1);
    r.d30 = sum(0, TODAY + 1);
    r.fc = sum(TODAY + 1, D);
    r.base_depth = r.depth?.[TODAY];
  }
  return resorts;
}

export async function loadCatalog() {
  const [resorts, snow, gaz, typical, fire] = await Promise.all([
    fetch('/data/resorts-index.json').then(r => r.json()),
    fetch('/data/snow.json').then(r => r.json()),
    fetch('/data/gazetteer.json').then(r => r.ok ? r.json() : { regions: [] }),
    fetch('/data/typical.json').then(r => r.ok ? r.json() : { windows: {} }).catch(() => ({ windows: {} })),
    fetch('/data/cottonwood-fire.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  attachSnow(resorts, snow);
  return {
    resorts,
    snow,
    typical,
    regions: gaz.regions || [],
    fire,
    today: snow.dates[snow.today],
    win: defaultWindow(snow),
  };
}

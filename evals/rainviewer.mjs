import { readFileSync } from 'node:fs';

export function runRainviewerEvals() {
  const lines = [];
  let fail = 0;
  const check = (id, ok, detail = '') => {
    if (ok) lines.push(`ok    ${id}`);
    else { fail++; lines.push(`FAIL  ${id}${detail ? `  ${detail}` : ''}`); }
  };

  const src = readFileSync(new URL('../src/lib/rainviewer.ts', import.meta.url), 'utf8');
  check('maxzoom-7', /RADAR_MAXZOOM = 7/.test(src));
  check('nexrad-color-6', /RADAR_COLOR = 6/.test(src));
  check('smooth-snow-options', /RADAR_OPTIONS = '1_1'/.test(src));
  check('empty-tile-threshold', /RADAR_EMPTY_BYTES = 500/.test(src));
  check('clear-vs-unavailable', /kind: 'unavailable'/.test(src) && /kind: 'clear'/.test(src) && /kind: 'precip'/.test(src) && /kind: 'error'/.test(src));
  check('personal-edu-terms', /rainviewer.com\/api\.html/.test(src) && /Personal\/educational/.test(src));

  const overlay = readFileSync(new URL('../src/lib/mapStyle.ts', import.meta.url), 'utf8');
  const radarIdx = overlay.indexOf("id: 'radar'");
  const hillIdx = overlay.indexOf("id: 'hillshade'");
  const heatIdx = overlay.indexOf("id: 'snow'");
  check('radar-layer-after-terrain', radarIdx > hillIdx && radarIdx > heatIdx);

  return { fail, total: lines.length, lines };
}

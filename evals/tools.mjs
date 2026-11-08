/**
 * Shared tool layer: every named tool runs, unknown tools fail, units in/cm.
 */
import { executeTool, TOOL_NAMES, loadCatalog } from '../lib/skiscope-tools/index.js';

export function runToolEvals() {
  const cat = loadCatalog();
  let fail = 0;
  const lines = [];
  const expectOk = [
    ['list_regions', {}],
    ['search_resorts', { query: 'Japan', limit: 5 }],
    ['get_leaderboard', { region: 'utah', metric: 'past72', limit: 5 }],
    ['get_resort_snow', { resort: 'alta' }],
    ['get_resort_forecast', { resort: 'alta', days: 5 }],
    ['get_storm_status', { resort: 'alta' }],
    ['get_snow_history', { resort: 'alta' }],
    ['compare_resorts', { ids: ['alta', 'snowbird'] }],
    ['plan_trip_snapshot', { resort: 'mammoth', start: '2027-03-07', end: '2027-03-14' }],
  ];
  for (const [name, args] of expectOk) {
    const out = executeTool(name, args, cat);
    if (!out.ok || !out.meta?.attribution) {
      fail++;
      lines.push(`FAIL  ${name}  ${out.error || 'no attribution'}`);
    } else {
      lines.push(`ok    ${name}`);
    }
  }
  const cm = executeTool('get_resort_snow', { resort: 'alta', units: 'cm' }, cat);
  if (!cm.ok || !String(cm.data?.past72Label || '').includes('cm')) {
    fail++;
    lines.push('FAIL  units-cm');
  } else lines.push('ok    units-cm');

  const bad = executeTool('not_a_tool', {}, cat);
  if (bad.ok) { fail++; lines.push('FAIL  unknown-tool'); }
  else lines.push('ok    unknown-tool');

  const missing = executeTool('get_resort_snow', {}, cat);
  if (missing.ok) { fail++; lines.push('FAIL  missing-resort-arg'); }
  else lines.push('ok    missing-resort-arg');

  if (!TOOL_NAMES.includes('get_leaderboard') || TOOL_NAMES.length < 8) {
    fail++;
    lines.push('FAIL  catalog-size');
  } else lines.push('ok    catalog-size');

  return { fail, total: expectOk.length + 4, lines };
}

import { handleMcpMessage, mcpTools, PROTOCOL } from '../lib/mcp.js';
import { loadCatalog } from '../lib/skiscope-tools/index.js';

export function runMcpEvals() {
  const cat = loadCatalog();
  let fail = 0;
  const lines = [];

  const init = handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, cat);
  if (init.result?.protocolVersion !== PROTOCOL || init.result?.serverInfo?.name !== 'skiscope') {
    fail++;
    lines.push('FAIL  initialize');
  } else lines.push('ok    initialize');

  const listed = handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, cat);
  const names = (listed.result?.tools || []).map(t => t.name);
  if (!names.includes('search_resorts') || !names.includes('plan_trip_snapshot')) {
    fail++;
    lines.push(`FAIL  tools/list  ${names.join(',')}`);
  } else lines.push('ok    tools/list');

  const call = handleMcpMessage({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'get_resort_snow', arguments: { resort: 'alta', units: 'in' } },
  }, cat);
  const text = call.result?.content?.[0]?.text || '';
  if (!call.result || call.result.isError || !/Alta/.test(text)) {
    fail++;
    lines.push(`FAIL  tools/call  ${text}`);
  } else lines.push('ok    tools/call');

  const unknown = handleMcpMessage({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'get_subscribers', arguments: {} },
  }, cat);
  if (!unknown.result?.isError) {
    fail++;
    lines.push('FAIL  no-subscriber-tool');
  } else lines.push('ok    no-subscriber-tool');

  const ping = handleMcpMessage({ jsonrpc: '2.0', id: 5, method: 'ping' }, cat);
  if (!ping.result) { fail++; lines.push('FAIL  ping'); }
  else lines.push('ok    ping');

  if (mcpTools().length < 8) { fail++; lines.push('FAIL  schema-count'); }
  else lines.push('ok    schema-count');

  return { fail, total: 6, lines };
}

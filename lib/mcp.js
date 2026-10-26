/**
 * Read-only MCP JSON-RPC (Streamable HTTP). Same executeTool as search + alerts.
 * No subscriber, email, or alert data.
 */
import { z } from 'zod';
import { executeTool, listTools, catalogOf } from './skiscope-tools/index.js';

export const PROTOCOL = '2025-03-26';
export const SERVER = { name: 'skiscope', version: '3.0.0' };

function jsonSchema(schema) {
  try {
    if (typeof z.toJSONSchema === 'function') {
      const j = z.toJSONSchema(schema);
      const { $schema, ...rest } = j;
      return rest;
    }
  } catch { /* fall through */ }
  return { type: 'object', additionalProperties: true };
}

export function mcpTools() {
  return listTools().map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: jsonSchema(t.inputSchema),
  }));
}

function ok(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function fail(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function handleMcpMessage(msg, catalog) {
  if (!msg || typeof msg !== 'object') return fail(null, -32600, 'invalid request');
  const { id, method, params } = msg;
  if (!method) return fail(id, -32600, 'missing method');

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER,
      instructions: 'Read-only SkiScope snow tools. Snapshot + attribution on every result. No subscriber data.',
    });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return { notification: true };
  }
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: mcpTools() });
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};
    const out = executeTool(name, args, catalogOf(catalog));
    if (!out.ok) {
      return ok(id, {
        isError: true,
        content: [{ type: 'text', text: out.text || out.error || 'tool error' }],
      });
    }
    return ok(id, {
      content: [
        { type: 'text', text: out.text },
        { type: 'text', text: JSON.stringify({ data: out.data, meta: out.meta }) },
      ],
      structuredContent: { data: out.data, meta: out.meta, text: out.text },
    });
  }
  return fail(id, -32601, `unknown method ${method}`);
}

export function handleMcpBody(body, catalog) {
  if (Array.isArray(body)) return body.map(msg => handleMcpMessage(msg, catalog));
  return handleMcpMessage(body, catalog);
}

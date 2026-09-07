/**
 * MCP server wiring for kettle-mcp-dte.
 *
 * KETTLE_ROOT: default scope for list/search/validate and the write boundary
 * for edit tools. Relative tool paths resolve against it.
 * KETTLE_KNOWLEDGE_DIR: optional override for the embedded knowledge base.
 *
 * Every result is `text` content containing {ok, data|error} JSON, so tool
 * failures are payloads the model can read, not protocol-level errors.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { buildTools } from './tools/registry.js';
import { createWorkspaceBoundary } from './workspace/boundary.js';

export function makeContext({ root = process.env.KETTLE_ROOT ?? process.cwd() } = {}) {
  return createWorkspaceBoundary(root);
}

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

export function createServer() {
  const ctx = makeContext();
  const tools = buildTools(ctx);
  const byName = new Map(tools.map(t => [t.name, t]));
  const listing = tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

  const server = new Server(
    { name: 'kettle-mcp-dte', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listing }));

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;
    const tool = byName.get(name);
    if (!tool) return textResult({ ok: false, error: `Unknown tool: ${name}` });
    try {
      return textResult({ ok: true, data: await tool.handler(args ?? {}) });
    } catch (err) {
      return textResult({ ok: false, error: err?.message ?? String(err) });
    }
  });

  server.onerror = err => console.error('[kettle-mcp-dte]', err);
  return { server, ctx, tools };
}

export async function startServer() {
  const { server, ctx } = createServer();
  process.on('SIGINT', () => { void server.close(); process.exit(0); });
  await server.connect(new StdioServerTransport());
  console.error(`kettle-mcp-dte running on stdio (KETTLE_ROOT=${ctx.root})`);
}

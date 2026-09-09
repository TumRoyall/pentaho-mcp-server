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
import { validateToolArguments } from './tools/schema.js';
import { createWorkspaceBoundary } from './workspace/boundary.js';
import { SERVER_VERSION } from './version.js';

export function makeContext({
  root = process.env.KETTLE_ROOT ?? process.cwd(),
  pentahoHome = process.env.PENTAHO_HOME,
} = {}) {
  return {
    ...createWorkspaceBoundary(root),
    pentahoHome: typeof pentahoHome === 'string' && pentahoHome.trim()
      ? pentahoHome.trim()
      : null,
    executeEnabled: process.env.PENTAHO_ENABLE_EXECUTE === '1',
  };
}

/**
 * Wrap a payload as MCP text content. Failed tool calls set `isError: true` so
 * a compliant client can distinguish success from failure, while the readable
 * `{ok, data|error}` JSON stays in the text for clients that only render text.
 */
function textResult(payload, { isError = false } = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function createServer({ version = SERVER_VERSION } = {}) {
  const ctx = makeContext();
  const tools = buildTools(ctx);
  const byName = new Map(tools.map(t => [t.name, t]));
  const listing = tools.map(({ name, title, description, inputSchema, annotations }) => ({
    name, title, description, inputSchema, annotations,
  }));

  const server = new Server(
    { name: 'kettle-mcp-dte', version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listing }));

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;
    const tool = byName.get(name);
    if (!tool) return textResult({ ok: false, error: `Unknown tool: ${name}` }, { isError: true });
    const argError = validateToolArguments(tool, args ?? {});
    if (argError) return textResult({ ok: false, error: argError }, { isError: true });
    try {
      return textResult({ ok: true, data: await tool.handler(args ?? {}) });
    } catch (err) {
      return textResult({ ok: false, error: err?.message ?? String(err) }, { isError: true });
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

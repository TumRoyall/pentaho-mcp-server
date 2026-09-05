#!/usr/bin/env node
/**
 * pentaho-mcp-server entry point.
 *
 * MCP stdio server for Pentaho Kettle .kjb/.ktr files with an embedded
 * PDI knowledge base. Read, summarize, search, validate, edit, scaffold — no
 * PDI install and no execution. See src/server.js for wiring and src/tools for
 * the tool surface.
 */
import { startServer } from './server.js';

startServer().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

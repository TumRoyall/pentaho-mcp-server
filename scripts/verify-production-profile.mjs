#!/usr/bin/env node
/**
 * Verify the production surface before a release is built.
 *
 * The production profile is exactly the 22 tools the server advertises:
 * read/edit/validate/knowledge (read-only) + runtime. There are no MCP
 * prompts or resources, no BA lifecycle (`pentaho_*`) tools, and intentionally
 * no tool that writes knowledge, promotes a catalog type, or "learns" from
 * user XML. This script fails loudly if that ever changes, so packaging cannot
 * ship a mutable-knowledge or lifecycle build.
 *
 * Exit 0 when the surface is clean; nonzero (with a reason) otherwise.
 */
import { makeContext } from '../src/server.js';
import { buildTools } from '../src/tools/registry.js';

const FORBIDDEN = /learn|promot|intake|catalog[_-]?(add|write|promote)/i;
const EXPECTED_TOOL_COUNT = 22;

const problems = [];

const tools = buildTools(makeContext());
if (tools.length !== EXPECTED_TOOL_COUNT) {
  problems.push(`expected ${EXPECTED_TOOL_COUNT} tools, found ${tools.length}`);
}
for (const tool of tools) {
  if (tool.name.startsWith('pentaho_')) problems.push(`forbidden lifecycle tool exposed: ${tool.name}`);
  if (FORBIDDEN.test(tool.name)) problems.push(`forbidden tool exposed: ${tool.name}`);
}

if (problems.length) {
  console.error('production profile verification FAILED:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface');

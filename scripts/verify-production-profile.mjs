#!/usr/bin/env node
/**
 * Verify the production surface before a release is built.
 *
 * The production profile is exactly the 26 tools the server advertises:
 * read/edit/validate/knowledge (read-only) + runtime + artifact-level
 * parameter/connection editing + reference-safe removal. There are no MCP
 * prompts or resources, no BA lifecycle (`pentaho_*`) tools, and intentionally
 * no tool that writes knowledge, promotes a catalog type, or "learns" from
 * user XML. This script fails loudly if that ever changes, so packaging cannot
 * ship a mutable-knowledge or lifecycle build.
 *
 * The check is an exact SET-EQUALITY comparison against EXPECTED_TOOL_NAMES —
 * not just a count — so an accidental rename or swap is caught even when the
 * total happens to stay the same.
 *
 * Exit 0 when the surface is clean; nonzero (with a reason) otherwise.
 */
import { makeContext } from '../src/server.js';
import { buildTools } from '../src/tools/registry.js';

const FORBIDDEN = /learn|promot|intake|catalog[_-]?(add|write|promote)/i;

// The exact, sorted production tool surface. Keep this list authoritative:
// adding or removing a tool must update it deliberately.
const EXPECTED_TOOL_NAMES = [
  'kettle_add_element',
  'kettle_add_error_hop',
  'kettle_clone',
  'kettle_copy_connection',
  'kettle_create_file',
  'kettle_edit_error_hop',
  'kettle_edit_hops',
  'kettle_get_element',
  'kettle_knowledge_analyze_xml',
  'kettle_knowledge_coverage',
  'kettle_knowledge_get',
  'kettle_knowledge_list',
  'kettle_list',
  'kettle_remove_element',
  'kettle_rename_element',
  'kettle_runtime_detect',
  'kettle_runtime_execute',
  'kettle_runtime_loadcheck',
  'kettle_runtime_logs',
  'kettle_search',
  'kettle_set_field',
  'kettle_set_field_path',
  'kettle_set_fields',
  'kettle_set_parameters',
  'kettle_summary',
  'kettle_validate',
];

const problems = [];

const tools = buildTools(makeContext());
const actual = tools.map(t => t.name).sort();
const expected = [...EXPECTED_TOOL_NAMES].sort();

const expectedSet = new Set(expected);
const actualSet = new Set(actual);
for (const name of actual) {
  if (!expectedSet.has(name)) problems.push(`unexpected tool exposed: ${name}`);
}
for (const name of expected) {
  if (!actualSet.has(name)) problems.push(`expected tool missing: ${name}`);
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

console.log(`production profile OK: ${expected.length} tools (exact set), no lifecycle prompt/resource surface, no learning/promotion surface`);

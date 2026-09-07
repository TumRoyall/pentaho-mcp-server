#!/usr/bin/env node
/**
 * Verify the production surface excludes any learning or catalog-promotion
 * capability before a release is built.
 *
 * The production profile is the same tool/prompt/resource surface the server
 * advertises: read/edit/validate/knowledge (read-only) + lifecycle + runtime.
 * There is intentionally no tool or resource that writes knowledge, promotes a
 * catalog type, or "learns" from user XML. This script fails loudly if that
 * ever changes, so packaging cannot ship a mutable-knowledge build.
 *
 * Exit 0 when the surface is clean; nonzero (with a reason) otherwise.
 */
import { makeContext } from '../src/server.js';
import { buildTools } from '../src/tools/registry.js';
import { listLifecyclePrompts } from '../src/lifecycle/prompts.js';
import { listLifecycleResources } from '../src/lifecycle/resources.js';

const FORBIDDEN = /learn|promot|intake|catalog[_-]?(add|write|promote)/i;
const EXPECTED_TOOL_COUNT = 31;

const problems = [];

const tools = buildTools(makeContext());
if (tools.length !== EXPECTED_TOOL_COUNT) {
  problems.push(`expected ${EXPECTED_TOOL_COUNT} tools, found ${tools.length}`);
}
for (const tool of tools) {
  if (FORBIDDEN.test(tool.name)) problems.push(`forbidden tool exposed: ${tool.name}`);
}

for (const resource of listLifecycleResources()) {
  if (FORBIDDEN.test(resource.uri) || FORBIDDEN.test(resource.name ?? '')) {
    problems.push(`forbidden resource exposed: ${resource.uri}`);
  }
}

const prompts = listLifecyclePrompts();
if (!prompts.some(p => p.name === 'develop-pentaho-job')) {
  problems.push('required prompt develop-pentaho-job is missing');
}
for (const prompt of prompts) {
  if (FORBIDDEN.test(prompt.name)) problems.push(`forbidden prompt exposed: ${prompt.name}`);
}

if (problems.length) {
  console.error('production profile verification FAILED:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`production profile OK: ${tools.length} tools, ${listLifecycleResources().length} resources, ${prompts.length} prompt(s), no learning/promotion surface`);

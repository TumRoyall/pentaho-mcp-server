import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { lifecycleTools } from '../src/tools/lifecycle.tools.js';
import { writeArtifactSet } from '../src/lifecycle/artifact-write.js';

const sha = value => createHash('sha256').update(value).digest('hex');

function workspace() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lifecycle-tools-'));
  mkdirSync(path.join(root, 'docs', 'REQ_001_SAMPLE', 'input'), { recursive: true });
  mkdirSync(path.join(root, 'etl'));
  writeFileSync(path.join(root, '.pentaho-mcp.yaml'), `schema_version: 1
project: { code: SAMPLE }
paths: { requirements: docs, pentaho: etl }
environment: { name: DEV }
`);
  writeFileSync(path.join(root, 'docs', 'REQ_001_SAMPLE', 'input', 'request.md'), '# Request\nLoad rates.');
  return root;
}

test('registry exposes lifecycle tools with project scope arguments', () => {
  const tools = lifecycleTools({});
  assert.deepEqual(tools.map(tool => tool.name), [
    'pentaho_project_inspect', 'pentaho_workflow_start', 'pentaho_workflow_status',
    'pentaho_requirement_write', 'pentaho_design_write', 'pentaho_generate', 'pentaho_sync_changes',
    'pentaho_validate_project', 'pentaho_finalize',
  ]);
  for (const tool of tools) {
    assert.ok(tool.inputSchema.required.includes('workspaceRoot'));
    assert.ok(tool.inputSchema.required.includes('requirementFolder'));
  }
});

test('artifact writes use compare-and-swap and never accept stale bytes', () => {
  const root = workspace();
  const file = path.join(root, 'docs', 'REQ_001_SAMPLE', 'requirement.md');
  writeFileSync(file, 'old');
  assert.throws(() => writeArtifactSet([{ path: file, content: 'new' }], { [file]: sha('stale') }), /CONCURRENT_CHANGE/);
  assert.equal(readFileSync(file, 'utf8'), 'old');
  const result = writeArtifactSet([{ path: file, content: 'new' }], { [file]: sha('old') });
  assert.equal(readFileSync(file, 'utf8'), 'new');
  assert.match(result.files[0].diff, /^--- /);
  assert.equal(result.files[0].hash, sha('new'));
});

test('inspect/status reconstruct from current workspace even if saved state is invalid', async () => {
  const root = workspace();
  const req = path.join(root, 'docs', 'REQ_001_SAMPLE');
  writeFileSync(path.join(req, 'workflow-state.yaml'), 'schema_version: nope\n');
  const tools = new Map(lifecycleTools({}).map(tool => [tool.name, tool]));
  const result = await tools.get('pentaho_workflow_status').handler({ workspaceRoot: root, requirementFolder: 'REQ_001_SAMPLE' });
  assert.equal(result.decision.stage, 'REQUIREMENT');
  assert.match(result.inspection.stateError, /schema_version/);
});

test('requirement write validates before promotion and refuses unsupported BA input', async () => {
  const root = workspace();
  const req = path.join(root, 'docs', 'REQ_001_SAMPLE');
  writeFileSync(path.join(req, 'input', 'mapping.xlsx'), 'not supported');
  const tool = lifecycleTools({}).find(item => item.name === 'pentaho_requirement_write');
  await assert.rejects(() => tool.handler({
    workspaceRoot: root,
    requirementFolder: 'REQ_001_SAMPLE',
    content: 'invalid',
    expectedHashes: {},
  }), /unsupported input/i);
  assert.equal(readFileSync(path.join(req, 'input', 'mapping.xlsx'), 'utf8'), 'not supported');
});

test('requirement and design writers reject invalid supplied artifacts without touching targets', async () => {
  const root = workspace();
  const tools = new Map(lifecycleTools({}).map(tool => [tool.name, tool]));
  await assert.rejects(() => tools.get('pentaho_requirement_write').handler({
    workspaceRoot: root, requirementFolder: 'REQ_001_SAMPLE', content: '# invalid', expectedHashes: {},
  }), /requirement validation failed/i);
  await assert.rejects(() => tools.get('pentaho_design_write').handler({
    workspaceRoot: root, requirementFolder: 'REQ_001_SAMPLE', files: { 'manifest.yaml': 'components: {}' }, expectedHashes: {},
  }), /design validation failed/i);
});

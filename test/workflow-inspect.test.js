import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjectConfig } from '../src/project/config.js';
import { inspectWorkflow, decideNextStage } from '../src/workflow/inspect.js';
import { writeWorkflowState } from '../src/workflow/state.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pentaho-workflow-inspect-'));
  roots.push(root);
  writeFileSync(path.join(root, '.pentaho-mcp.yaml'), [
    'schema_version: 1',
    'project: { code: abc }',
    'paths:',
    '  requirements: abc-docs',
    '  pentaho: abc-etl-pentaho',
    'environment: { name: DEV }',
    '',
  ].join('\n'));
  const req = path.join(root, 'abc-docs', 'REQ_001_SAMPLE');
  mkdirSync(path.join(req, 'input'), { recursive: true });
  mkdirSync(path.join(root, 'abc-etl-pentaho'), { recursive: true });
  writeFileSync(path.join(req, 'input', 'request.md'), '# Request\n');
  return { root, req, config: loadProjectConfig(root) };
}

test('new BA folder starts at requirement stage', () => {
  const { config, req } = fixture();
  const inspection = inspectWorkflow(config, req);

  assert.equal(inspection.input.files.length, 1);
  assert.equal(inspection.input.unsupported.length, 0);
  assert.deepEqual(decideNextStage(inspection), {
    stage: 'REQUIREMENT',
    reason: 'REQUIREMENT_MISSING',
    blockers: [],
    staleArtifacts: [],
  });
});

test('unsupported input blocks instead of being ignored', () => {
  const { config, req } = fixture();
  writeFileSync(path.join(req, 'input', 'mapping.xlsx'), 'bytes');

  const decision = decideNextStage(inspectWorkflow(config, req));

  assert.equal(decision.stage, 'BLOCKED');
  assert.equal(decision.reason, 'UNSUPPORTED_INPUT');
  assert.match(decision.blockers[0], /mapping\.xlsx/);
});

test('requirement without design resumes at design stage', () => {
  const { config, req } = fixture();
  writeFileSync(path.join(req, 'requirement.md'), '# Requirement\n');

  const decision = decideNextStage(inspectWorkflow(config, req));

  assert.equal(decision.stage, 'DESIGN');
  assert.equal(decision.reason, 'DESIGN_MISSING');
});

test('changed input invalidates requirement, design, and runtime', () => {
  const { config, req, root } = fixture();
  writeFileSync(path.join(req, 'requirement.md'), '# Requirement\n');
  mkdirSync(path.join(req, 'design'));
  writeFileSync(path.join(req, 'design', 'manifest.yaml'), 'pentaho:\n  project_path: sample\ncomponents: {}\n');
  mkdirSync(path.join(root, 'abc-etl-pentaho', 'sample'));
  writeFileSync(path.join(root, 'abc-etl-pentaho', 'sample', 'job.kjb'), '<job/>');
  const before = inspectWorkflow(config, req);
  writeWorkflowState(req, {
    schema_version: 1,
    workflow_id: 'REQ_001_SAMPLE',
    input_hash: before.input.hash,
    artifact_hashes: before.artifactHashes,
    current_stage: 'COMPLETE',
  });
  writeFileSync(path.join(req, 'input', 'request.md'), '# Changed request\n');

  const decision = decideNextStage(inspectWorkflow(config, req));

  assert.deepEqual(decision, {
    stage: 'REQUIREMENT',
    reason: 'INPUT_CHANGED',
    blockers: [],
    staleArtifacts: ['requirement', 'design', 'runtime'],
  });
});

test('unchanged completed workflow does not regenerate artifacts', () => {
  const { config, req, root } = fixture();
  writeFileSync(path.join(req, 'requirement.md'), '# Requirement\n');
  mkdirSync(path.join(req, 'design'));
  writeFileSync(path.join(req, 'design', 'manifest.yaml'), 'pentaho:\n  project_path: sample\ncomponents: {}\n');
  mkdirSync(path.join(root, 'abc-etl-pentaho', 'sample'));
  writeFileSync(path.join(root, 'abc-etl-pentaho', 'sample', 'job.kjb'), '<job/>');
  const before = inspectWorkflow(config, req);
  writeWorkflowState(req, {
    schema_version: 1,
    workflow_id: 'REQ_001_SAMPLE',
    input_hash: before.input.hash,
    artifact_hashes: before.artifactHashes,
    current_stage: 'COMPLETE',
  });

  const decision = decideNextStage(inspectWorkflow(config, req));

  assert.equal(decision.stage, 'COMPLETE');
  assert.equal(decision.reason, 'UNCHANGED_COMPLETE');
});

test('manual runtime edit resumes in modification stage', () => {
  const { config, req, root } = fixture();
  writeFileSync(path.join(req, 'requirement.md'), '# Requirement\n');
  mkdirSync(path.join(req, 'design'));
  writeFileSync(path.join(req, 'design', 'manifest.yaml'), 'pentaho:\n  project_path: sample\ncomponents: {}\n');
  const runtime = path.join(root, 'abc-etl-pentaho', 'sample');
  mkdirSync(runtime);
  const job = path.join(runtime, 'job.kjb');
  writeFileSync(job, '<job/>');
  const before = inspectWorkflow(config, req);
  writeWorkflowState(req, {
    schema_version: 1,
    workflow_id: 'REQ_001_SAMPLE',
    input_hash: before.input.hash,
    artifact_hashes: before.artifactHashes,
    current_stage: 'COMPLETE',
  });
  writeFileSync(job, '<job><name>manually changed</name></job>');

  const decision = decideNextStage(inspectWorkflow(config, req));

  assert.equal(decision.stage, 'MODIFYING');
  assert.equal(decision.reason, 'RUNTIME_CHANGED');
  assert.deepEqual(decision.staleArtifacts, ['design']);
});


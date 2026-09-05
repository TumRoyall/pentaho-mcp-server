import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

import { loadProjectConfig } from '../src/project/config.js';
import { loadDesignPackage } from '../src/lifecycle/design-loader.js';
import { writeDesignDiagrams } from '../src/lifecycle/diagram-renderer.js';
import { planGeneration, generateProject } from '../src/generation/generate.js';
import { finalizeWorkflow } from '../src/lifecycle/finalize.js';

const requirement = `---
artifact_type: etl-requirement
requirement_id: REQ_001_E2E
status: READY_FOR_DESIGN
revision: 1
open_questions: 0
---
# E2E
## Objective and scope
Load one row (SRC-001).
## Source contract
| ID | Object | Evidence |
|---|---|---|
| R01 | SRC.T | SRC-001 |
## Target contract
Target DST.T for R01.
## Mapping and transformation rules
Copy ID for R01.
## Load and operating behaviour
Run on demand for R01.
## Controls, error handling and security
Fail on error for R01.
## Acceptance criteria
| ID | Then | Requirement | Evidence |
|---|---|---|---|
| AC01 | Row loaded | R01 | SRC-001 |
## Decisions
None.
## Open questions
| ID | Blocking | Question | Owner |
|---|---|---|---|
## Evidence
| ID | File | Locator | Status |
|---|---|---|---|
| SRC-001 | input/request.md | line 1 | SUPPORTED |
`;

function setup({ complete = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lifecycle-e2e-'));
  const req = path.join(root, 'docs', 'REQ_001_E2E');
  const design = path.join(req, 'design');
  mkdirSync(path.join(req, 'input'), { recursive: true });
  mkdirSync(path.join(root, 'etl'));
  writeFileSync(path.join(root, '.pentaho-mcp.yaml'), 'schema_version: 1\nproject: { code: E2E }\npaths: { requirements: docs, pentaho: etl }\nenvironment: { name: DEV }\n');
  writeFileSync(path.join(req, 'input/request.md'), '# Load one row');
  if (!complete) return { root, req };
  mkdirSync(path.join(design, 'jobs'), { recursive: true }); mkdirSync(path.join(design, 'transformations'));
  writeFileSync(path.join(req, 'requirement.md'), requirement);
  writeFileSync(path.join(design, 'design.md'), '# Design\n<!-- BEGIN GENERATED DIAGRAMS -->\n<!-- END GENERATED DIAGRAMS -->\n');
  const manifest = {
    schema_version: 1, artifact_type: 'pentaho-design-package', design: { id: 'DES-001', version: 1, status: 'READY' },
    requirement: { id: 'REQ_001_E2E', version: 1 }, pentaho: { project_path: 'e2e', entrypoint_job: 'JOB-001' },
    components: { jobs: [{ id: 'JOB-001', spec: 'jobs/main.yaml', artifact_name: 'main.kjb' }], transformations: [{ id: 'TRN-001', spec: 'transformations/load.yaml', artifact_name: 'load.ktr' }] },
    connections: [{ name: 'CONN', technology: 'ORACLE', variables: { host: 'DB_HOST', password: 'DB_PASS' } }], technical_decisions: [],
  };
  const job = { schema_version: 1, artifact_type: 'pentaho-job-design', design_id: 'DES-001', design_version: 1, job: {
    id: 'JOB-001', name: 'main', artifact_name: 'main.kjb', requirement_refs: ['R01'],
    entries: [
      { id: 'JOB-001-E01', pentaho_entry_type: 'SPECIAL', display_name: 'START', requirement_refs: ['R01'] },
      { id: 'JOB-001-E02', pentaho_entry_type: 'TRANS', display_name: 'LOAD', component_ref: 'TRN-001', requirement_refs: ['R01'] },
      { id: 'JOB-001-E03', pentaho_entry_type: 'SUCCESS', display_name: 'SUCCESS', requirement_refs: ['AC01'] },
    ], hops: [
      { id: 'H1', from: 'JOB-001-E01', to: 'JOB-001-E02', type: 'unconditional', enabled: true },
      { id: 'H2', from: 'JOB-001-E02', to: 'JOB-001-E03', type: 'success', enabled: true },
    ],
  } };
  const trans = { schema_version: 1, artifact_type: 'pentaho-transformation-design', design_id: 'DES-001', design_version: 1, transformation: {
    id: 'TRN-001', name: 'load', artifact_name: 'load.ktr', requirement_refs: ['R01'],
    inputs: [{ id: 'IN-01', object: 'SRC.T', requirement_refs: ['R01'] }], outputs: [{ id: 'OUT-01', object: 'DST.T', fields: [{ name: 'ID', type: 'INTEGER' }], requirement_refs: ['R01'] }],
    steps: [
      { id: 'TRN-001-S01', pentaho_step_type: 'TableInput', display_name: 'READ', configuration: { connection: 'CONN', query_contract: 'SELECT ID FROM SRC.T' }, reads_inputs: ['IN-01'], writes_outputs: [], requirement_refs: ['R01'] },
      { id: 'TRN-001-S02', pentaho_step_type: 'TableOutput', display_name: 'WRITE', configuration: { connection: 'CONN', target_object: 'DST.T', field_mapping: [{ stream_field: 'ID', target_field: 'ID' }] }, reads_inputs: [], writes_outputs: ['OUT-01'], requirement_refs: ['R01'] },
    ], hops: [{ id: 'H1', from: 'TRN-001-S01', to: 'TRN-001-S02', type: 'normal', enabled: true }],
  } };
  writeFileSync(path.join(design, 'manifest.yaml'), YAML.stringify(manifest));
  writeFileSync(path.join(design, 'jobs/main.yaml'), YAML.stringify(job));
  writeFileSync(path.join(design, 'transformations/load.yaml'), YAML.stringify(trans));
  writeDesignDiagrams(design);
  const config = loadProjectConfig(root);
  generateProject(planGeneration(config, loadDesignPackage(design)), {});
  return { root, req, config };
}

test('finalization distinguishes incomplete workflow and optional absent PDI', () => {
  const { root, req } = setup();
  const report = finalizeWorkflow(loadProjectConfig(root), req);
  assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.checks.pdi.status, 'UNAVAILABLE');
  assert.ok(report.blockers.length);
});

test('complete generated workflow finalizes from current bytes without requiring PDI', () => {
  const { config, req } = setup({ complete: true });
  const report = finalizeWorkflow(config, req);
  assert.equal(report.status, 'COMPLETE', JSON.stringify(report.blockers));
  assert.equal(report.checks.requirement.status, 'PASS');
  assert.equal(report.checks.design.status, 'PASS');
  assert.equal(report.checks.kettleStatic.status, 'PASS');
  assert.equal(report.checks.pdi.status, 'UNAVAILABLE');
  assert.equal(report.checks.execution.status, 'NOT_RUN');
  assert.ok(report.artifacts.some(file => file.endsWith('main.kjb')));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadDesignPackage } from '../src/lifecycle/design-loader.js';
import { validateDesign } from '../src/lifecycle/design-validator.js';
import { writeDesignDiagrams } from '../src/lifecycle/diagram-renderer.js';

function makeDesign({ missingHopTarget = false, type = 'TableInput', placeholder = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'design-validator-'));
  const design = path.join(root, 'design');
  mkdirSync(path.join(design, 'jobs'), { recursive: true });
  mkdirSync(path.join(design, 'transformations'));
  writeFileSync(path.join(design, 'design.md'), `# Design
<!-- BEGIN GENERATED DIAGRAMS -->
stale
<!-- END GENERATED DIAGRAMS -->`, 'utf8');
  writeFileSync(path.join(design, 'manifest.yaml'), `schema_version: 1
artifact_type: pentaho-design-package
design: { id: DES-001, version: 1, status: READY }
requirement: { id: REQ_001_SAMPLE, version: 1 }
pentaho: { project_path: sample, entrypoint_job: JOB-001 }
components:
  jobs: [{ id: JOB-001, spec: jobs/main.yaml, artifact_name: main.kjb }]
  transformations: [{ id: TRN-001, spec: transformations/load.yaml, artifact_name: load.ktr }]
technical_decisions: []
`, 'utf8');
  writeFileSync(path.join(design, 'jobs', 'main.yaml'), `schema_version: 1
artifact_type: pentaho-job-design
design_id: DES-001
design_version: 1
job:
  id: JOB-001
  artifact_name: main.kjb
  requirement_refs: [R01]
  entries:
    - { id: JOB-001-E01, pentaho_entry_type: SPECIAL, display_name: START, requirement_refs: [R01] }
    - { id: JOB-001-E02, pentaho_entry_type: TRANS, display_name: LOAD, component_ref: TRN-001, requirement_refs: [R01] }
  hops:
    - { id: JOB-001-H01, from: JOB-001-E01, to: ${missingHopTarget ? 'JOB-001-E99' : 'JOB-001-E02'}, type: unconditional, enabled: true }
`, 'utf8');
  writeFileSync(path.join(design, 'transformations', 'load.yaml'), `schema_version: 1
artifact_type: pentaho-transformation-design
design_id: DES-001
design_version: 1
transformation:
  id: TRN-001
  artifact_name: load.ktr
  requirement_refs: [R01, AC01]
  inputs: [{ id: IN-01, object: ODS.RATE, requirement_refs: [R01] }]
  outputs: [{ id: OUT-01, object: RPT.RATE, requirement_refs: [R01] }]
  steps:
    - id: TRN-001-S01
      pentaho_step_type: ${placeholder ? '<STEP_TYPE>' : type}
      display_name: READ
      reads_inputs: [IN-01]
      writes_outputs: []
      requirement_refs: [R01]
    - { id: TRN-001-S02, pentaho_step_type: TableOutput, display_name: WRITE, reads_inputs: [], writes_outputs: [OUT-01], requirement_refs: [R01] }
  hops:
    - { id: TRN-001-H01, from: TRN-001-S01, to: TRN-001-S02, type: normal, enabled: true }
`, 'utf8');
  writeDesignDiagrams(design);
  return design;
}

test('design loader accepts one mapping per declared component and rejects escapes', () => {
  const design = makeDesign();
  const pkg = loadDesignPackage(design);
  assert.equal(pkg.manifest.design.id, 'DES-001');
  assert.equal(pkg.jobs.get('JOB-001').job.id, 'JOB-001');

  writeFileSync(path.join(design, 'manifest.yaml'), `components:\n  jobs: [{ id: X, spec: ../outside.yaml }]\n`, 'utf8');
  assert.throws(() => loadDesignPackage(design), /outside design directory/i);
});

test('design validator checks identities, graph, references, catalog types, traceability, and placeholders', () => {
  const clean = validateDesign(makeDesign());
  assert.equal(clean.ok, true, JSON.stringify(clean.errors));

  const graph = validateDesign(makeDesign({ missingHopTarget: true }));
  assert.ok(graph.errors.some(error => error.code === 'DANGLING_HOP'));

  const catalog = validateDesign(makeDesign({ type: 'DefinitelyUnknown' }));
  assert.ok(catalog.errors.some(error => error.code === 'CATALOG_GAP'));

  const placeholders = validateDesign(makeDesign({ placeholder: true }));
  assert.ok(placeholders.errors.some(error => error.code === 'PLACEHOLDER_LEFT'));
});

test('multi-document component YAML is rejected', () => {
  const design = makeDesign();
  writeFileSync(path.join(design, 'jobs', 'main.yaml'), 'job: {}\n---\nextra: true\n');
  assert.throws(() => loadDesignPackage(design), /exactly one YAML mapping/i);
});

test('design validator detects diagrams made stale by a YAML edit', () => {
  const design = makeDesign();
  const jobFile = path.join(design, 'jobs', 'main.yaml');
  const content = String.raw`${readFileSync(jobFile, 'utf8')}`.replace('display_name: LOAD', 'display_name: LOAD_V2');
  writeFileSync(jobFile, content);
  const report = validateDesign(design);
  assert.ok(report.errors.some(error => error.code === 'DIAGRAM_STALE'));
});

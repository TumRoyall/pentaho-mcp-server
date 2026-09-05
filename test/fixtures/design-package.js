import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeDesignFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'diagram-fixture-'));
  const design = path.join(root, 'design');
  mkdirSync(path.join(design, 'jobs'), { recursive: true });
  mkdirSync(path.join(design, 'transformations'));
  writeFileSync(path.join(design, 'design.md'), '# Design\nBefore diagrams\n<!-- BEGIN GENERATED DIAGRAMS -->\nold\n<!-- END GENERATED DIAGRAMS -->\nAfter diagrams\n');
  writeFileSync(path.join(design, 'manifest.yaml'), `design: { id: DES-001, version: 1 }
components:
  jobs: [{ id: JOB-001, spec: jobs/main.yaml }]
  transformations: [{ id: TRN-001, spec: transformations/load.yaml }]
`);
  writeFileSync(path.join(design, 'jobs/main.yaml'), `design_id: DES-001
job:
  id: JOB-001
  entries:
    - { id: JOB-001-E01, display_name: START, pentaho_entry_type: SPECIAL }
    - { id: JOB-001-E02, display_name: LOAD, pentaho_entry_type: TRANS, component_ref: TRN-001 }
  hops: [{ from: JOB-001-E01, to: JOB-001-E02, enabled: true }]
`);
  writeFileSync(path.join(design, 'transformations/load.yaml'), `design_id: DES-001
transformation:
  id: TRN-001
  inputs: [{ id: IN-01, object: ODS.RATE }]
  outputs: [{ id: OUT-01, object: RPT.RATE }]
  steps:
    - { id: TRN-001-S01, display_name: READ, pentaho_step_type: TableInput, reads_inputs: [IN-01] }
    - { id: TRN-001-S02, display_name: WRITE, pentaho_step_type: TableOutput, writes_outputs: [OUT-01] }
  hops: [{ from: TRN-001-S01, to: TRN-001-S02, enabled: true }]
`);
  return design;
}

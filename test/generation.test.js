import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadProjectConfig } from '../src/project/config.js';
import { loadDesignPackage } from '../src/lifecycle/design-loader.js';
import { writeDesignDiagrams } from '../src/lifecycle/diagram-renderer.js';
import { planGeneration, generateProject } from '../src/generation/generate.js';
import { validateFile } from '../src/core/validate.js';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'generation-'));
  const req = path.join(root, 'docs', 'REQ_001_RATES');
  const design = path.join(req, 'design');
  mkdirSync(path.join(design, 'jobs'), { recursive: true });
  mkdirSync(path.join(design, 'transformations'));
  mkdirSync(path.join(req, 'input'));
  mkdirSync(path.join(root, 'etl'));
  writeFileSync(path.join(root, '.pentaho-mcp.yaml'), `schema_version: 1
project: { code: DTE }
paths: { requirements: docs, pentaho: etl }
environment: { name: DEV }
`);
  writeFileSync(path.join(req, 'input/request.md'), '# rate request');
  writeFileSync(path.join(design, 'design.md'), '# Design\n<!-- BEGIN GENERATED DIAGRAMS -->\n<!-- END GENERATED DIAGRAMS -->\n');
  writeFileSync(path.join(design, 'manifest.yaml'), `schema_version: 1
artifact_type: pentaho-design-package
design: { id: DES-001, version: 1, status: READY }
requirement: { id: REQ_001_RATES, version: 1 }
pentaho: { project_path: rates, entrypoint_job: JOB-001, runtime_layout: flat }
components:
  jobs: [{ id: JOB-001, spec: jobs/main.yaml, artifact_name: load_rates.kjb }]
  transformations: [{ id: TRN-001, spec: transformations/load.yaml, artifact_name: load_rates.ktr }]
connections:
  - name: CONN_ODS
    technology: ORACLE
    variables: { host: DB_HOST, port: DB_PORT, database: DB_SID, username: DB_USER, password: DB_PASS }
parameters: [{ name: INPUT_DATE, type: String, required: true }]
technical_decisions: []
`);
  writeFileSync(path.join(design, 'jobs/main.yaml'), `schema_version: 1
artifact_type: pentaho-job-design
design_id: DES-001
design_version: 1
job:
  id: JOB-001
  name: load_rates
  artifact_name: load_rates.kjb
  requirement_refs: [R01]
  parameters: [{ name: INPUT_DATE, type: String, required: true }]
  entries:
    - { id: JOB-001-E01, pentaho_entry_type: SPECIAL, display_name: START, requirement_refs: [R01] }
    - { id: JOB-001-E02, pentaho_entry_type: TRANS, display_name: LOAD, component_ref: TRN-001, requirement_refs: [R01] }
    - { id: JOB-001-E03, pentaho_entry_type: SUCCESS, display_name: SUCCESS, requirement_refs: [AC01] }
  hops:
    - { id: JOB-001-H01, from: JOB-001-E01, to: JOB-001-E02, type: unconditional, enabled: true }
    - { id: JOB-001-H02, from: JOB-001-E02, to: JOB-001-E03, type: success, enabled: true }
`);
  writeFileSync(path.join(design, 'transformations/load.yaml'), `schema_version: 1
artifact_type: pentaho-transformation-design
design_id: DES-001
design_version: 1
transformation:
  id: TRN-001
  name: load_rates
  artifact_name: load_rates.ktr
  requirement_refs: [R01, AC01]
  inputs:
    - { id: IN-01, object: ODS.RATE, fields: [{ name: RATE_ID, type: Integer }], requirement_refs: [R01] }
  outputs:
    - { id: OUT-01, object: RPT.RATE, key_fields: [RATE_ID], fields: [{ name: RATE_ID, type: INTEGER, nullable: false }], requirement_refs: [R01] }
  steps:
    - id: TRN-001-S01
      pentaho_step_type: TableInput
      display_name: READ_RATE
      configuration: { connection: CONN_ODS, query_contract: "SELECT RATE_ID FROM ODS.RATE WHERE RATE_ID < 10 AND 'A&B' = 'A&B'" }
      reads_inputs: [IN-01]
      writes_outputs: []
      requirement_refs: [R01]
    - id: TRN-001-S02
      pentaho_step_type: TableOutput
      display_name: WRITE_RATE
      configuration:
        connection: CONN_ODS
        target_object: RPT.RATE
        truncate_table: false
        commit_size: "\${ETL_COMMIT_SIZE}"
        field_mapping: [{ stream_field: RATE_ID, target_field: RATE_ID }]
      reads_inputs: []
      writes_outputs: [OUT-01]
      requirement_refs: [R01]
  hops: [{ id: TRN-001-H01, from: TRN-001-S01, to: TRN-001-S02, type: normal, enabled: true }]
`);
  writeDesignDiagrams(design);
  return { root, req, design };
}

test('validated design generates a complete deterministic runnable project', () => {
  const { root, req, design } = fixture();
  const config = loadProjectConfig(root);
  const plan = planGeneration(config, loadDesignPackage(design));
  assert.deepEqual(plan.inventory.map(file => path.basename(file)).sort(), [
    '.pentaho-mcp-generated.json', 'RPT.RATE.sql', 'ddl_advisory.md', 'kettle.properties',
    'load_rates.kjb', 'load_rates.ktr', 'runjob.bat', 'shared.xml', 'spoon.bat', 'spoon.sh',
  ].sort());
  const result = generateProject(plan, {});
  assert.equal(result.validation.ok, true, JSON.stringify(result.validation));
  assert.equal(result.files.length, plan.inventory.length + 1); // project files + changelog
  assert.ok(existsSync(path.join(req, 'changelog.md')));

  const ktr = readFileSync(path.join(root, 'etl', 'rates', 'load_rates.ktr'), 'utf8');
  assert.match(ktr, /RATE_ID &lt; 10/);
  assert.match(ktr, /A&amp;B/);
  assert.match(ktr, /<column_name>RATE_ID<\/column_name>/);
  assert.match(ktr, /<stream_name>RATE_ID<\/stream_name>/);
  assert.equal(validateFile(path.join(root, 'etl', 'rates', 'load_rates.ktr')).summary.errors, 0);
  assert.equal(validateFile(path.join(root, 'etl', 'rates', 'load_rates.kjb')).summary.errors, 0);

  const shared = readFileSync(path.join(root, 'etl', 'rates', '.kettle', 'shared.xml'), 'utf8');
  assert.match(shared, /\$\{DB_HOST\}/);
  assert.doesNotMatch(shared, /password>[^<$]/i);
  assert.doesNotMatch(ktr, /\{\{|&lt;[A-Z][A-Z0-9_]{2,}&gt;/);
});

test('generation refuses a non-empty unmanaged target', () => {
  const { root, design } = fixture();
  mkdirSync(path.join(root, 'etl', 'rates'));
  writeFileSync(path.join(root, 'etl', 'rates', 'manual.txt'), 'owned by developer');
  assert.throws(() => planGeneration(loadProjectConfig(root), loadDesignPackage(design)), /non-empty unmanaged/i);
  assert.deepEqual(readdirSync(path.join(root, 'etl', 'rates')), ['manual.txt']);
});

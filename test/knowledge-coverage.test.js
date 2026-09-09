import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { knowledgeCoverage } from '../src/core/knowledge-coverage.js';

function tmpTree() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-coverage-'));
  // Canonical Dummy step. The nested <type>String</type> inside <fields> must
  // NOT be counted as a step type usage.
  writeFileSync(
    path.join(root, 'canonical.ktr'),
    [
      '<transformation><info><name>canonical</name></info>',
      '<step><name>Pass</name><type>Dummy</type>',
      '<fields><field><name>a</name><type>String</type></field></fields>',
      '</step>',
      '<order/></transformation>',
    ].join('\n'),
  );
  // Observed step: SetSessionVariableStep is the one catalog type still marked
  // observed (its PDI source could not be located), so it exercises the
  // observed bucket without depending on a type that may later be promoted.
  writeFileSync(
    path.join(root, 'observed.ktr'),
    '<transformation><info><name>observed</name></info><step><name>SetSess</name><type>SetSessionVariableStep</type></step><order/></transformation>',
  );
  // Missing CustomStep type.
  writeFileSync(
    path.join(root, 'missing.ktr'),
    '<transformation><info><name>missing</name></info><step><name>Weird</name><type>CustomStep</type></step><order/></transformation>',
  );
  // Canonical job entry (SUCCESS).
  mkdirSync(path.join(root, 'nested'), { recursive: true });
  writeFileSync(
    path.join(root, 'nested', 'flow.kjb'),
    '<job><name>flow</name><entries><entry><name>Done</name><type>SUCCESS</type></entry></entries><hops/></job>',
  );
  // Malformed file: wrong root means parseModel throws, so it becomes a scan
  // issue rather than aborting the whole run.
  writeFileSync(path.join(root, 'broken.ktr'), '<not-a-transformation><oops/></not-a-transformation>');
  return root;
}

test('knowledgeCoverage aggregates canonical, observed, and missing usage', () => {
  const root = tmpTree();
  try {
    const report = knowledgeCoverage(root);
    assert.deepEqual(report.summary, {
      files: 5,
      parsedFiles: 4,
      scanIssues: 1,
      typeUsages: 4,
      distinctTypes: 4,
      canonical: 2,
      observed: 1,
      missing: 1,
    });
    assert.equal(report.types.find(x => x.xmlType === 'CustomStep').uses, 1);
    assert.equal(report.issues.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('knowledgeCoverage sorts missing first, then observed, then canonical', () => {
  const root = tmpTree();
  try {
    const report = knowledgeCoverage(root);
    const statuses = report.types.map(t => t.status);
    const rank = { missing: 0, observed: 1, canonical: 2 };
    for (let i = 1; i < statuses.length; i += 1) {
      assert.ok(rank[statuses[i - 1]] <= rank[statuses[i]], `unsorted at ${i}: ${statuses}`);
    }
    assert.equal(report.types[0].status, 'missing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('knowledgeCoverage exposes target-version evidence on catalogued rows', () => {
  const root = tmpTree();
  try {
    const report = knowledgeCoverage(root);
    const dummy = report.types.find(x => x.xmlType === 'Dummy');
    assert.ok(dummy, 'Dummy row present');
    assert.equal(dummy.sourceVersion, '9.4');
    assert.deepEqual(dummy.verifiedVersions, ['9.4']);
    assert.equal(dummy.verification, 'source_reviewed');

    // Observed row with no established target evidence carries none.
    const observed = report.types.find(x => x.xmlType === 'SetSessionVariableStep');
    assert.ok(observed, 'observed row present');
    assert.deepEqual(observed.verifiedVersions, []);

    // Uncatalogued (missing) rows have no evidence fields to report.
    const missing = report.types.find(x => x.xmlType === 'CustomStep');
    assert.deepEqual(missing.verifiedVersions, []);
    assert.equal(missing.sourceVersion, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('knowledgeCoverage does not count nested field <type> values', () => {
  const root = tmpTree();
  try {
    const report = knowledgeCoverage(root);
    assert.equal(report.types.find(x => x.xmlType === 'String'), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { loadDesignPackage } from '../src/lifecycle/design-loader.js';
import { makeDesignFixture } from './fixtures/design-package.js';
import { diffRuntimeDesign } from '../src/sync/diff-runtime-design.js';
import { applyDesignDelta } from '../src/sync/apply-design-delta.js';

const sha = value => createHash('sha256').update(value).digest('hex');

function models({ sql = 'SELECT 1', connection = 'CONN_NEW', xloc = '999' } = {}) {
  return [{
    kind: 'trans', name: 'TRN-001', path: 'load.ktr',
    elements: [
      { name: 'READ', type: 'TableInput', raw: { connection, sql, GUI: { xloc } } },
      { name: 'WRITE', type: 'TableOutput', raw: {} },
    ],
    hops: [{ from: 'READ', to: 'WRITE', enabled: 'Y' }],
  }];
}

test('runtime comparison ignores coordinates but reports stable config and semantic deltas', () => {
  const pkg = loadDesignPackage(makeDesignFixture());
  pkg.transformations.get('TRN-001').transformation.steps[0].configuration = { connection: 'CONN_OLD', query_contract: 'SELECT 1' };
  const deltas = diffRuntimeDesign(pkg, models());
  assert.deepEqual(deltas.map(delta => delta.path), ['steps.TRN-001-S01.configuration.connection']);
  assert.equal(deltas[0].classification, 'TECHNICAL');

  const sql = diffRuntimeDesign(pkg, models({ connection: 'CONN_OLD', sql: 'SELECT 2' }));
  assert.equal(sql[0].path, 'steps.TRN-001-S01.configuration.query_contract');
  assert.equal(sql[0].classification, 'BUSINESS_SEMANTIC');
});

test('technical delta patches YAML, refreshes diagrams, increments revision, and prepends changelog', () => {
  const design = makeDesignFixture();
  const pkg = loadDesignPackage(design);
  pkg.manifest.design.version = 1;
  pkg.transformations.get('TRN-001').transformation.steps[0].configuration = { connection: 'CONN_OLD' };
  const spec = path.join(design, 'transformations', 'load.yaml');
  const before = readFileSync(spec, 'utf8');
  const manifest = path.join(design, 'manifest.yaml');
  const designMd = path.join(design, 'design.md');
  const expected = {
    [spec]: sha(before),
    [manifest]: sha(readFileSync(manifest)),
    [designMd]: sha(readFileSync(designMd)),
  };
  const result = applyDesignDelta(design, [{
    componentId: 'TRN-001', elementId: 'TRN-001-S01', path: 'steps.TRN-001-S01.configuration.connection',
    kind: 'configuration', oldValue: 'CONN_OLD', newValue: 'CONN_NEW', classification: 'TECHNICAL',
  }], expected);
  assert.equal(result.status, 'SYNCED');
  assert.match(readFileSync(spec, 'utf8'), /connection: CONN_NEW/);
  assert.match(readFileSync(manifest, 'utf8'), /version: 2/);
  assert.match(readFileSync(path.join(design, '..', 'changelog.md'), 'utf8'), /CHG-001/);
});

test('business-semantic changes require a user decision and do not write', () => {
  const design = makeDesignFixture();
  const spec = path.join(design, 'transformations', 'load.yaml');
  const before = readFileSync(spec, 'utf8');
  const result = applyDesignDelta(design, [{
    componentId: 'TRN-001', elementId: 'TRN-001-S01', path: 'steps.TRN-001-S01.configuration.query_contract',
    oldValue: 'SELECT 1', newValue: 'SELECT 2', classification: 'BUSINESS_SEMANTIC',
  }], { [spec]: sha(before) });
  assert.equal(result.status, 'USER_DECISION_REQUIRED');
  assert.equal(readFileSync(spec, 'utf8'), before);
});

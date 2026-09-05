import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjectConfig } from '../src/project/config.js';
import { assertInsideRoots, resolveProjectPath } from '../src/project/paths.js';

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace(config = '') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pentaho-project-config-'));
  roots.push(root);
  writeFileSync(path.join(root, '.pentaho-mcp.yaml'), config || [
    'schema_version: 1',
    'project:',
    '  code: abc',
    'paths:',
    '  requirements: abc-docs',
    '  pentaho: abc-etl-pentaho',
    'environment:',
    '  name: DEV',
    'pentaho:',
    '  home: null',
    '',
  ].join('\n'));
  mkdirSync(path.join(root, 'abc-docs', 'REQ_001_SAMPLE', 'input'), { recursive: true });
  mkdirSync(path.join(root, 'abc-etl-pentaho'), { recursive: true });
  return root;
}

test('loads project-specific roots without assuming dte directory names', () => {
  const root = workspace();

  const config = loadProjectConfig(root);

  assert.equal(config.schemaVersion, 1);
  assert.equal(config.projectCode, 'abc');
  assert.equal(config.environment, 'DEV');
  assert.equal(config.pentahoHome, null);
  assert.equal(config.paths.requirements, path.join(root, 'abc-docs'));
  assert.equal(config.paths.pentaho, path.join(root, 'abc-etl-pentaho'));
  assert.equal(resolveProjectPath(config, 'requirements', 'REQ_001_SAMPLE'), path.join(root, 'abc-docs', 'REQ_001_SAMPLE'));
});

test('rejects missing, malformed, and unsupported project configuration', () => {
  const missing = mkdtempSync(path.join(os.tmpdir(), 'pentaho-project-config-missing-'));
  roots.push(missing);
  assert.throws(() => loadProjectConfig(missing), /missing .*\.pentaho-mcp\.yaml/i);

  assert.throws(() => loadProjectConfig(workspace('schema_version: 2\nproject: { code: abc }\npaths: { requirements: docs, pentaho: etl }\n')), /schema_version.*1/i);
  assert.throws(() => loadProjectConfig(workspace('schema_version: 1\nproject: { code: abc }\npaths: { requirements: docs, pentaho: etl }\nextra: true\n')), /unknown.*extra/i);
  assert.throws(() => loadProjectConfig(workspace('schema_version: 1\nproject: {}\npaths: { requirements: docs, pentaho: etl }\n')), /project\.code/i);
});

test('rejects absolute and escaping configured roots', () => {
  const absolute = path.resolve(os.tmpdir()).replaceAll('\\', '/');
  assert.throws(() => loadProjectConfig(workspace(`schema_version: 1\nproject: { code: abc }\npaths: { requirements: "${absolute}", pentaho: etl }\n`)), /workspace-relative/i);
  assert.throws(() => loadProjectConfig(workspace('schema_version: 1\nproject: { code: abc }\npaths: { requirements: ../docs, pentaho: etl }\n')), /outside the workspace/i);
});

test('enforces configured write roots and keeps BA input read-only', () => {
  const root = workspace();
  const config = loadProjectConfig(root);
  const req = path.join(config.paths.requirements, 'REQ_001_SAMPLE');

  assert.equal(assertInsideRoots(config, path.join(req, 'requirement.md'), { write: true }), path.join(req, 'requirement.md'));
  assert.equal(assertInsideRoots(config, path.join(config.paths.pentaho, 'sample', 'job.kjb'), { write: true }), path.join(config.paths.pentaho, 'sample', 'job.kjb'));
  assert.throws(() => assertInsideRoots(config, path.join(req, 'input', 'request.md'), { write: true }), /input.*read-only/i);
  assert.throws(() => assertInsideRoots(config, path.join(root, 'other', 'file.txt'), { write: true }), /outside configured project roots/i);
});

test('rejects path traversal supplied after a configured root', () => {
  const config = loadProjectConfig(workspace());

  assert.throws(() => resolveProjectPath(config, 'requirements', '..', 'escape.md'), /outside.*requirements/i);
  assert.throws(() => resolveProjectPath(config, 'unknown', 'file.md'), /unknown project path key/i);
});

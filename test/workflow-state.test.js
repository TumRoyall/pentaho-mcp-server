import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashTree } from '../src/workflow/hash.js';
import { readWorkflowState, writeWorkflowState } from '../src/workflow/state.js';
import { withWorkflowLock } from '../src/workflow/lock.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pentaho-workflow-state-'));
  roots.push(root);
  return root;
}

test('hashTree is stable by relative path and changes with file bytes', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'input'));
  const a = path.join(root, 'input', 'a.md');
  const b = path.join(root, 'input', 'b.md');
  writeFileSync(a, 'A');
  writeFileSync(b, 'B');

  const first = hashTree([b, a], { root });
  assert.equal(first, hashTree([a, b], { root }));
  writeFileSync(b, 'changed');
  assert.notEqual(first, hashTree([a, b], { root }));
});

test('workflow state round-trips through an atomic YAML file', () => {
  const req = tempRoot();
  const state = {
    schema_version: 1,
    workflow_id: 'REQ_001_SAMPLE',
    mcp_version: '0.1.0',
    input_hash: 'abc',
    current_stage: 'DESIGN',
    artifacts: { requirement: 'requirement.md' },
  };

  const result = writeWorkflowState(req, state);

  assert.equal(result.path, path.join(req, 'workflow-state.yaml'));
  assert.equal(existsSync(`${result.path}.tmp`), false);
  assert.deepEqual(readWorkflowState(req), state);
});

test('missing state returns null and invalid state fails closed', () => {
  const req = tempRoot();
  assert.equal(readWorkflowState(req), null);
  writeFileSync(path.join(req, 'workflow-state.yaml'), 'schema_version: 2\n');
  assert.throws(() => readWorkflowState(req), /schema_version.*1/i);
});

test('workflow lock excludes a second writer and releases after completion', async () => {
  const req = tempRoot();
  let nestedError;

  await withWorkflowLock(req, async () => {
    try {
      await withWorkflowLock(req, async () => {});
    } catch (error) {
      nestedError = error;
    }
  });

  assert.match(nestedError.message, /already locked/i);
  assert.equal(existsSync(path.join(req, '.pentaho-workflow.lock')), false);
  await withWorkflowLock(req, async () => {});
});

test('stale workflow lock can be recovered explicitly', async () => {
  const req = tempRoot();
  writeFileSync(path.join(req, '.pentaho-workflow.lock'), JSON.stringify({ pid: 999999, updated_at: '2000-01-01T00:00:00.000Z' }));

  await withWorkflowLock(req, async () => {}, { staleAfterMs: 1, recoverStale: true });

  assert.equal(existsSync(path.join(req, '.pentaho-workflow.lock')), false);
});


import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-boundary-'));
  roots.push(root);
  mkdirSync(path.join(root, 'etl'));
  return root;
}

test('resolves relative and absolute paths inside the canonical workspace', () => {
  const root = workspace();
  const boundary = createWorkspaceBoundary(root);
  assert.equal(boundary.root, realpathSync(root));
  assert.equal(boundary.resolveRead(), realpathSync(root));
  assert.equal(boundary.resolveRead('etl'), realpathSync(path.join(root, 'etl')));
  assert.equal(
    boundary.resolveWrite(path.join(root, 'etl', 'new.ktr')),
    path.join(realpathSync(root), 'etl', 'new.ktr'),
  );
});

test('resolves a create destination whose deepest existing ancestor is in root', () => {
  const root = workspace();
  const boundary = createWorkspaceBoundary(root);
  assert.equal(
    boundary.resolveWrite(path.join('etl', 'nested', 'deep', 'new.ktr')),
    path.join(realpathSync(root), 'etl', 'nested', 'deep', 'new.ktr'),
  );
});

test('rejects traversal and sibling-prefix paths', () => {
  const root = workspace();
  const outside = `${root}-outside`;
  mkdirSync(outside);
  roots.push(outside);
  const boundary = createWorkspaceBoundary(root);
  assert.throws(
    () => boundary.resolveRead(path.join(root, '..', path.basename(root) + '-outside')),
    /outside KETTLE_ROOT/i,
  );
  assert.throws(() => boundary.resolveWrite(path.join(root, '..', 'escape.ktr')), /outside KETTLE_ROOT/i);
  assert.throws(() => boundary.resolveRead(path.resolve(root, '..', 'outside.kjb')), /outside KETTLE_ROOT/i);
});

test('rejects non-string and empty inputs; undefined requests the root', () => {
  const root = workspace();
  const boundary = createWorkspaceBoundary(root);
  assert.throws(() => boundary.resolveRead(42), /path must be/i);
  assert.throws(() => boundary.resolveRead(''), /path must be/i);
  assert.throws(() => boundary.resolveWrite('   '), /path must be/i);
  assert.equal(boundary.resolveRead(undefined), realpathSync(root));
  assert.equal(boundary.resolveWrite(undefined), realpathSync(root));
});

test('rejects a non-existent or non-directory root', () => {
  assert.throws(() => createWorkspaceBoundary(''), /KETTLE_ROOT must be/i);
  assert.throws(() => createWorkspaceBoundary(42), /KETTLE_ROOT must be/i);
  const root = workspace();
  assert.throws(
    () => createWorkspaceBoundary(path.join(root, 'does-not-exist')),
    /KETTLE_ROOT must be an existing directory/i,
  );
});

test('rejects a link inside the workspace that resolves outside it', t => {
  const root = workspace();
  const outside = `${root}-link-target`;
  mkdirSync(outside);
  roots.push(outside);
  const link = path.join(root, 'external');
  try {
    symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (err) {
    if (['EPERM', 'EACCES', 'UNKNOWN'].includes(err.code)) {
      t.skip(`cannot create link on this platform: ${err.code}`);
      return;
    }
    throw err;
  }
  const boundary = createWorkspaceBoundary(root);
  assert.throws(() => boundary.resolveRead(path.join('external', 'file.ktr')), /outside KETTLE_ROOT/i);
  assert.throws(() => boundary.resolveWrite(path.join('external', 'new.ktr')), /outside KETTLE_ROOT/i);
});

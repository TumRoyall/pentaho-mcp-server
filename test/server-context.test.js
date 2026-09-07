import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeContext } from '../src/server.js';

test('server context carries an optional PDI home without changing its root', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pentaho-context-'));
  try {
    const ctx = makeContext({ root, pentahoHome: ' C:/Pentaho/data-integration ' });
    assert.equal(ctx.root, path.resolve(root));
    assert.equal(ctx.pentahoHome, 'C:/Pentaho/data-integration');
    assert.equal(makeContext({ root, pentahoHome: '   ' }).pentahoHome, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

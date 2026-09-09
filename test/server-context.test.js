import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from '../src/server.js';

test('makeContext gates execution on PENTAHO_ENABLE_EXECUTE', () => {
  const previous = process.env.PENTAHO_ENABLE_EXECUTE;
  try {
    process.env.PENTAHO_ENABLE_EXECUTE = '1';
    assert.equal(makeContext({ root: process.cwd() }).executeEnabled, true);

    process.env.PENTAHO_ENABLE_EXECUTE = '0';
    assert.equal(makeContext({ root: process.cwd() }).executeEnabled, false);

    delete process.env.PENTAHO_ENABLE_EXECUTE;
    assert.equal(makeContext({ root: process.cwd() }).executeEnabled, false);

    process.env.PENTAHO_ENABLE_EXECUTE = 'true';
    assert.equal(makeContext({ root: process.cwd() }).executeEnabled, false);
  } finally {
    if (previous === undefined) delete process.env.PENTAHO_ENABLE_EXECUTE;
    else process.env.PENTAHO_ENABLE_EXECUTE = previous;
  }
});

test('runtime context carries executeEnabled through to runtime tools', () => {
  const previous = process.env.PENTAHO_ENABLE_EXECUTE;
  try {
    process.env.PENTAHO_ENABLE_EXECUTE = '1';
    const ctx = makeContext({ root: process.cwd() });
    assert.equal(ctx.executeEnabled, true);
  } finally {
    if (previous === undefined) delete process.env.PENTAHO_ENABLE_EXECUTE;
    else process.env.PENTAHO_ENABLE_EXECUTE = previous;
  }
});

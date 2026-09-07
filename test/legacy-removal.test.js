import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const forbidden = [
  'src/lifecycle',
  'src/generation',
  'src/sync',
  'src/workflow',
  'src/tools/lifecycle.tools.js',
  'src/knowledge/pentaho/ddl-from-design.md',
  'src/knowledge/pentaho/lessons-learned.md',
];

test('unregistered BA lifecycle implementation is absent from distributable source', () => {
  const present = forbidden.filter(relative => existsSync(path.join(root, relative)));
  assert.deepEqual(present, []);
});

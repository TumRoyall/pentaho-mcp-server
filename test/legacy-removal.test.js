import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(abs));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

test('unregistered BA lifecycle implementation is absent from distributable source', () => {
  const present = forbidden.filter(relative => existsSync(path.join(root, relative)));
  assert.deepEqual(present, []);
});

test('legacy pentaho project configuration is fully removed from source', () => {
  for (const relative of [
    'src/project/config.js',
    'src/project/paths.js',
    'packaging/config.example.yaml',
  ]) {
    assert.equal(existsSync(path.join(root, relative)), false, `${relative} must be removed`);
  }

  for (const file of walkFiles(path.join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /\.pentaho-mcp\.yaml|loadProjectConfig|resolveProjectPath|assertInsideRoots|requirementFolder|PENTAHO_ENV/,
    );
  }
});

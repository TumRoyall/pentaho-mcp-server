import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  setField, unifiedDiff, commitEdit,
} from '../src/core/edit.js';
import { loadModel, text } from '../src/core/model.js';
import { assertMinimalDiff } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);
let tmp;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `kettle-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });
  copyFileSync(fx('mini.ktr'), path.join(tmp, 'mini.ktr'));
  copyFileSync(fx('mini.kjb'), path.join(tmp, 'mini.kjb'));
});

test('setField updates an existing SQL block', () => {
  const file = path.join(tmp, 'mini.ktr');
  const before = readFileSync(file, 'utf8');
  const diff = setField(file, 'in', 'sql', "SELECT id FROM t WHERE a < 'x' AND b > 1");
  const after = readFileSync(file, 'utf8');
  assertMinimalDiff(before, after, ['&lt;']);
  assert.match(after, /SELECT id FROM t WHERE a &lt; 'x' AND b &gt; 1/);
  assert.match(diff, /SELECT id FROM t/);
  const m = loadModel(file);
  assert.equal(text(m.elements[0].raw.sql), "SELECT id FROM t WHERE a < 'x' AND b > 1");
});

test('setField updates an existing child', () => {
  const file = path.join(tmp, 'mini.ktr');
  const before = readFileSync(file, 'utf8');
  setField(file, 'in', 'connection', 'conn_b');
  const after = readFileSync(file, 'utf8');
  assertMinimalDiff(before, after, ['conn_b']);
  const m = loadModel(file);
  assert.equal(text(m.elements[0].raw.connection), 'conn_b');
});

test('setField creates a missing child', () => {
  const file = path.join(tmp, 'mini.ktr');
  const before = readFileSync(file, 'utf8');
  setField(file, 'in', 'execute_each_row', 'Y');
  const after = readFileSync(file, 'utf8');
  // Only the new field's own line is inserted; the closing tag's line is
  // re-emitted with its original indent, not re-indented, so it is not part
  // of the changed region at all (a pure insertion, like git would show it).
  assertMinimalDiff(before, after, ['execute_each_row']);
  // The new field lands at the same indent depth as its siblings (<name>,
  // <type>, ...), two spaces deeper than the closing </step> it precedes.
  const normalized = after.replaceAll('\r\n', '\n');
  assert.ok(normalized.includes('\n    <execute_each_row>Y</execute_each_row>\n  </step>'));
  const m = loadModel(file);
  assert.equal(text(m.elements[0].raw.execute_each_row), 'Y');
  // still well-formed, other step untouched
  assert.equal(text(m.elements[1].raw.connection), 'conn_a');
});

test('commitEdit names the file when the result would be malformed XML', () => {
  const file = path.join(tmp, 'mini.ktr');
  assert.throws(
    () => commitEdit(file, '<a></a>', '<a><b></a>'),
    err => err.message.includes('malformed XML') && err.message.includes(file),
  );
});

test('unifiedDiff shows only the changed region', () => {
  const d = unifiedDiff('a\nb\nc\n', 'a\nB\nc\n', 'f');
  assert.match(d, /@@ -2,1 \+2,1 @@/);
  assert.match(d, /-b/);
  assert.match(d, /\+B/);
});

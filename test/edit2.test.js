import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { editHops, renameElement, cloneFile } from '../src/core/edit.js';
import { loadModel, text } from '../src/core/model.js';
import { assertMinimalDiff } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);
let tmp;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `kettle-edit2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });
  copyFileSync(fx('mini.ktr'), path.join(tmp, 'mini.ktr'));
  copyFileSync(fx('mini.kjb'), path.join(tmp, 'mini.kjb'));
});

test('add job hop with condition flags', () => {
  const file = path.join(tmp, 'mini.kjb');
  editHops(file, 'add', 'Start', 'ok', { unconditional: 'Y' });
  const m = loadModel(file);
  const h = m.hops.find(h => h.from === 'Start' && h.to === 'ok');
  assert.ok(h);
  assert.equal(h.unconditional, 'Y');
});

test('add trans hop, then disable, enable, remove', () => {
  const file = path.join(tmp, 'mini.ktr');
  const original = readFileSync(file, 'utf8');

  // Clear the pre-existing hop first so `add` genuinely exercises the
  // trans-shaped insertion branch (kind !== 'job' in editHops): just
  // <from>/<to>/<enabled>, no <from_nr>/<to_nr>/<evaluation>/
  // <unconditional> (those are job-only fields).
  editHops(file, 'remove', 'in', 'out');
  const afterRemove = readFileSync(file, 'utf8');
  assert.equal(loadModel(file).hops.length, 0);
  // Removing touches only the hop block: prove it positionally (everything
  // outside the block is byte-identical at the same index) by calling the
  // helper with before/after swapped, so its "added" lines are exactly what
  // disappeared from `original`.
  assertMinimalDiff(afterRemove, original, [
    '<hop>', '<from>in</from>', '<to>out</to>', '<enabled>Y</enabled>', '</hop>',
  ]);

  editHops(file, 'add', 'in', 'out');
  const afterAdd = readFileSync(file, 'utf8');
  // Adding it back touches only the inserted block, nothing else shifts.
  assertMinimalDiff(afterRemove, afterAdd, [
    '<hop>', '<from>in</from>', '<to>out</to>', '<enabled>Y</enabled>', '</hop>',
  ]);
  const added = loadModel(file).hops[0];
  assert.equal(added.from, 'in');
  assert.equal(added.to, 'out');
  assert.equal(added.enabled, 'Y');
  // model.js's trans hop mapping never surfaces evaluation/unconditional
  // regardless of the XML, so also check the raw text directly to prove
  // the job-shaped template was NOT used here.
  assert.ok(!afterAdd.includes('<from_nr>'));
  assert.ok(!afterAdd.includes('<evaluation>'));
  assert.ok(!afterAdd.includes('<unconditional>'));

  editHops(file, 'disable', 'in', 'out');
  assert.equal(loadModel(file).hops[0].enabled, 'N');
  editHops(file, 'enable', 'in', 'out');
  assert.equal(loadModel(file).hops[0].enabled, 'Y');
  editHops(file, 'remove', 'in', 'out');
  assert.equal(loadModel(file).hops.length, 0);
});

test('hop endpoints must exist; duplicates rejected', () => {
  const file = path.join(tmp, 'mini.ktr');
  assert.throws(() => editHops(file, 'add', 'in', 'ghost'), /Hop to "ghost" not found/);
  assert.throws(() => editHops(file, 'add', 'in', 'out'), /already exists/);
  assert.throws(() => editHops(file, 'remove', 'out', 'in'), /not found/);
});

test('renameElement updates the element and all hops', () => {
  const file = path.join(tmp, 'mini.kjb');
  const before = readFileSync(file, 'utf8');
  renameElement(file, 'run sql', 'run oracle sql');
  const after = readFileSync(file, 'utf8');
  // renameElement touches three separate, non-adjacent occurrences (the
  // entry's <name> plus two hop <from>/<to> references), so the
  // prefix/suffix-based assertMinimalDiff (built to isolate one contiguous
  // changed region) would have to enumerate every untouched line between
  // them too. Prove the same byte-identical property directly instead:
  // replacing every literal occurrence of the old name in `before` must
  // reproduce `after` exactly, character for character.
  assert.equal((before.match(/run sql/g) || []).length, 3);
  assert.equal(before.split('run sql').join('run oracle sql'), after);

  const m = loadModel(file);
  assert.ok(m.elements.some(e => e.name === 'run oracle sql'));
  assert.ok(!m.elements.some(e => e.name === 'run sql'));
  assert.deepEqual(m.hops.map(h => [h.from, h.to]), [
    ['Start', 'run oracle sql'],
    ['run oracle sql', 'ok'],
  ]);
});

test('renameElement rejects collisions and missing elements', () => {
  const file = path.join(tmp, 'mini.ktr');
  assert.throws(() => renameElement(file, 'in', 'out'), /already exists/);
  assert.throws(() => renameElement(file, 'ghost', 'x'), /No step named "ghost"/);
});

test('cloneFile creates a renamed copy with substitutions', () => {
  const src = path.join(tmp, 'mini.ktr');
  const dest = path.join(tmp, 'sub', 'clone.ktr');
  const sourceBefore = readFileSync(src, 'utf8');
  const replacements = [
    { find: 'FROM DUAL', replace: 'FROM DUAL2' },
    { find: 'conn_a', replace: 'conn_b' },
  ];
  const out = cloneFile(src, dest, 'cloned_trans', replacements);
  assert.equal(out.destPath, dest);
  // spec: kettle_clone "validates result" — the clone report carries a
  // validation report for the destination, and this clone (name change plus
  // a consistent connection rename) is structurally clean.
  assert.equal(out.validation.summary.errors, 0);

  // Destination differs from source only in the expected places: reproduce
  // the substitutions plus the name change ourselves and compare full file
  // content byte for byte, not just the parsed model.
  let expected = sourceBefore;
  for (const { find, replace } of replacements) expected = expected.split(find).join(replace);
  expected = expected.replace('<name>mini</name>', '<name>cloned_trans</name>');
  assert.equal(readFileSync(dest, 'utf8'), expected);

  const m = loadModel(dest);
  assert.equal(m.name, 'cloned_trans');
  assert.match(text(m.elements[0].raw.sql), /FROM DUAL2/);
  assert.deepEqual(m.connections, ['conn_b']);

  // source file bytes are completely unchanged after the clone
  assert.equal(readFileSync(src, 'utf8'), sourceBefore);
});

test('cloneFile validates the result and reports (without failing) a replacement that broke a reference', () => {
  const src = path.join(tmp, 'mini.ktr');
  const dest = path.join(tmp, 'broken_clone.ktr');
  // Rename only the step's <connection> reference, not the <connection><name>
  // declaration itself, so the clone is well-formed XML but structurally
  // broken: the step now references an undefined connection.
  const source = readFileSync(src, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const find = `<connection>conn_a</connection>${eol}    <sql>`;
  assert.ok(source.includes(find));
  const replacements = [{
    find,
    replace: `<connection>conn_missing</connection>${eol}    <sql>`,
  }];
  const out = cloneFile(src, dest, 'broken_clone', replacements);
  // The clone still succeeds (validation warnings/errors do not fail it) ...
  assert.ok(existsSync(dest));
  assert.equal(out.name, 'broken_clone');
  // ... but the caller can see the problem in the returned report.
  assert.ok(out.validation.summary.errors > 0);
  assert.ok(out.validation.issues.some(i => /undefined connection/.test(i.message)));
});

test('cloneFile refuses existing destination and kind mismatch', () => {
  const src = path.join(tmp, 'mini.ktr');
  assert.throws(() => cloneFile(src, path.join(tmp, 'mini.kjb'), 'x'), /same kind/);
  assert.throws(() => cloneFile(src, path.join(tmp, 'mini.ktr'), 'x'), /already exists/);
});

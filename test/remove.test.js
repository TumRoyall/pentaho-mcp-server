import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { removeElement, editErrorHop } from '../src/core/remove.js';
import { loadModel } from '../src/core/model.js';

let tmp;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `kettle-remove-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });
});

function write(name, xml, eol = '\n') {
  const file = path.join(tmp, name);
  writeFileSync(file, xml.replaceAll('\n', eol), 'utf8');
  return file;
}

// A transformation with three steps: in -> mid -> out, plus a free-standing
// "orphan" step referenced by nothing.
function transWithHops() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info>',
    '    <name>t</name>',
    '  </info>',
    '  <order>',
    '    <hop>',
    '      <from>in</from>',
    '      <to>mid</to>',
    '      <enabled>Y</enabled>',
    '    </hop>',
    '    <hop>',
    '      <from>mid</from>',
    '      <to>out</to>',
    '      <enabled>Y</enabled>',
    '    </hop>',
    '  </order>',
    '  <step>',
    '    <name>in</name>',
    '    <type>TableInput</type>',
    '  </step>',
    '  <step>',
    '    <name>mid</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '  <step>',
    '    <name>out</name>',
    '    <type>TableOutput</type>',
    '  </step>',
    '  <step>',
    '    <name>orphan</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '</transformation>',
    '',
  ].join('\n');
}

// SwitchCase with a nested <cases><case><target_step> referencing "target",
// plus a default_target_step and the required hops.
function transSwitchCase() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info>',
    '    <name>sc</name>',
    '  </info>',
    '  <order>',
    '    <hop>',
    '      <from>sw</from>',
    '      <to>target</to>',
    '      <enabled>Y</enabled>',
    '    </hop>',
    '  </order>',
    '  <step>',
    '    <name>sw</name>',
    '    <type>SwitchCase</type>',
    '    <cases>',
    '      <case>',
    '        <value>1</value>',
    '        <target_step>target</target_step>',
    '      </case>',
    '    </cases>',
    '    <default_target_step>other</default_target_step>',
    '  </step>',
    '  <step>',
    '    <name>target</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '  <step>',
    '    <name>other</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '</transformation>',
    '',
  ].join('\n');
}

// A transformation with a step_error_handling block routing src -> err, plus
// the ordinary hop src -> err that the error route needs. When `extraRoute` is
// set, src ALSO carries an explicit SwitchCase target_step pointing at err, so
// the src->err ordinary hop is needed by that explicit route and must survive
// error-hop removal.
function transWithErrorHop({ enabled = 'Y', extraRoute = false } = {}) {
  const srcType = extraRoute
    ? [
      '    <type>SwitchCase</type>',
      '    <default_target_step>err</default_target_step>',
    ]
    : ['    <type>TableInput</type>'];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info>',
    '    <name>eh</name>',
    '  </info>',
    '  <order>',
    '    <hop>',
    '      <from>src</from>',
    '      <to>err</to>',
    '      <enabled>Y</enabled>',
    '    </hop>',
    '  </order>',
    '  <step>',
    '    <name>src</name>',
    ...srcType,
    '  </step>',
    '  <step>',
    '    <name>err</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '  <step_error_handling>',
    '    <error>',
    '      <source_step>src</source_step>',
    '      <target_step>err</target_step>',
    `      <is_enabled>${enabled}</is_enabled>`,
    '      <nr_valuename/>',
    '      <descriptions_valuename/>',
    '      <fields_valuename/>',
    '      <codes_valuename/>',
    '      <max_errors/>',
    '      <max_pct_errors/>',
    '      <min_pct_rows/>',
    '    </error>',
    '  </step_error_handling>',
    '</transformation>',
    '',
  ].join('\n');
}

function jobXml() {
  return readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'mini.kjb'), 'utf8');
}

// ---------------------------------------------------------------------------
// Step 1: safe-removal tests
// ---------------------------------------------------------------------------

test('removeElement removes a free-standing element cleanly', () => {
  const file = write('t.ktr', transWithHops());
  const diff = removeElement(file, 'orphan', {});
  assert.match(diff, /orphan/);
  const m = loadModel(file);
  assert.ok(!m.elements.some(e => e.name === 'orphan'));
  assert.ok(m.elements.some(e => e.name === 'in'));
  assert.equal(m.hops.length, 2);
});

test('removeElement refuses when a normal hop references the element (default mode)', () => {
  const file = write('t.ktr', transWithHops());
  const before = readFileSync(file, 'utf8');
  assert.throws(() => removeElement(file, 'mid', {}), /hop/i);
  assert.equal(readFileSync(file, 'utf8'), before, 'file must not be altered on refusal');
});

test('removeElement cascades hops when removeReferences:true', () => {
  const file = write('t.ktr', transWithHops());
  removeElement(file, 'mid', { removeReferences: true });
  const m = loadModel(file);
  assert.ok(!m.elements.some(e => e.name === 'mid'));
  assert.ok(!m.hops.some(h => h.from === 'mid' || h.to === 'mid'));
  // The unrelated in-only endpoint hop is gone; nothing references mid now.
  assert.equal(m.hops.length, 0);
});

test('removeElement empties nested SwitchCase target content, preserving tags', () => {
  const file = write('sc.ktr', transSwitchCase());
  removeElement(file, 'target', { removeReferences: true });
  const after = readFileSync(file, 'utf8');
  const norm = after.replaceAll('\r\n', '\n');
  // Tag preserved, content emptied.
  assert.match(norm, /<target_step><\/target_step>/);
  assert.doesNotMatch(norm, /<target_step>target<\/target_step>/);
  // The default_target_step (referencing "other") is untouched.
  assert.match(norm, /<default_target_step>other<\/default_target_step>/);
  const m = loadModel(file);
  assert.ok(!m.elements.some(e => e.name === 'target'));
});

test('removeElement refuses when element is an error-hop source (default mode)', () => {
  const file = write('eh.ktr', transWithErrorHop());
  const before = readFileSync(file, 'utf8');
  assert.throws(() => removeElement(file, 'src', {}), /error/i);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('removeElement refuses when element is an error-hop target (default mode)', () => {
  const file = write('eh.ktr', transWithErrorHop());
  assert.throws(() => removeElement(file, 'err', {}), /error|hop/i);
});

test('removeElement cascades error blocks and hops when removeReferences:true', () => {
  const file = write('eh.ktr', transWithErrorHop());
  removeElement(file, 'src', { removeReferences: true });
  const after = readFileSync(file, 'utf8');
  assert.doesNotMatch(after, /<source_step>src<\/source_step>/);
  const m = loadModel(file);
  assert.ok(!m.elements.some(e => e.name === 'src'));
  assert.equal((m.errorHops ?? []).length, 0);
});

// Two error blocks in one step_error_handling container, Spoon-standard
// indentation, with a REALISTIC-LENGTH source step name on the first block.
// The second block (unrelated source/target) follows the first and must
// survive cascade removal of the first block's source byte-intact.
function transWithTwoErrorBlocks() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info>',
    '    <name>eh2</name>',
    '  </info>',
    '  <order>',
    '    <hop>',
    '      <from>Filter rows step</from>',
    '      <to>err</to>',
    '      <enabled>Y</enabled>',
    '    </hop>',
    '  </order>',
    '  <step>',
    '    <name>Filter rows step</name>',
    '    <type>TableInput</type>',
    '  </step>',
    '  <step>',
    '    <name>err</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '  <step>',
    '    <name>Second source step</name>',
    '    <type>TableInput</type>',
    '  </step>',
    '  <step>',
    '    <name>Second target step</name>',
    '    <type>Dummy</type>',
    '  </step>',
    '  <step_error_handling>',
    '    <error>',
    '      <source_step>Filter rows step</source_step>',
    '      <target_step>err</target_step>',
    '      <is_enabled>Y</is_enabled>',
    '      <max_errors/>',
    '    </error>',
    '    <error>',
    '      <source_step>Second source step</source_step>',
    '      <target_step>Second target step</target_step>',
    '      <is_enabled>Y</is_enabled>',
    '      <max_errors/>',
    '    </error>',
    '  </step_error_handling>',
    '</transformation>',
    '',
  ].join('\n');
}

test('removeElement cascade over a long-named error source keeps a trailing error block byte-intact', () => {
  const file = write('eh2.ktr', transWithTwoErrorBlocks());
  const secondBlock = [
    '    <error>',
    '      <source_step>Second source step</source_step>',
    '      <target_step>Second target step</target_step>',
    '      <is_enabled>Y</is_enabled>',
    '      <max_errors/>',
    '    </error>',
  ].join('\n');

  // Must not throw a "malformed XML" error from double-splicing nested ranges.
  removeElement(file, 'Filter rows step', { removeReferences: true });

  const after = readFileSync(file, 'utf8');
  // The removed element and its error block are gone.
  assert.ok(!after.includes('<source_step>Filter rows step</source_step>'));
  // The unrelated second error block survives, byte-for-byte.
  assert.ok(after.includes(secondBlock), 'trailing error block must survive intact');
  // Result is valid, loadable XML with the intact second error hop.
  const m = loadModel(file);
  assert.ok(!m.elements.some(e => e.name === 'Filter rows step'));
  assert.equal((m.errorHops ?? []).length, 1);
  assert.equal(m.errorHops[0].source, 'Second source step');
  assert.equal(m.errorHops[0].target, 'Second target step');
});

test('removeElement refuses on duplicate names', () => {
  const dup = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info><name>d</name></info>',
    '  <order></order>',
    '  <step><name>twin</name><type>Dummy</type></step>',
    '  <step><name>twin</name><type>Dummy</type></step>',
    '</transformation>',
    '',
  ].join('\n');
  const file = write('dup.ktr', dup);
  assert.throws(() => removeElement(file, 'twin', {}), /duplicate/i);
});

test('removeElement preserves CRLF line endings', () => {
  const file = write('t.ktr', transWithHops(), '\r\n');
  removeElement(file, 'orphan', {});
  const after = readFileSync(file, 'utf8');
  assert.ok(after.includes('\r\n'));
  assert.ok(!/([^\r])\n/.test(after), 'no bare LF should remain');
});

test('removeElement refuses to remove the sole START entry', () => {
  const file = write('j.kjb', jobXml());
  assert.throws(() => removeElement(file, 'Start', { removeReferences: true }), /START/i);
});

// ---------------------------------------------------------------------------
// Step 5: error-hop edit tests
// ---------------------------------------------------------------------------

test('editErrorHop disable sets is_enabled to N', () => {
  const file = write('eh.ktr', transWithErrorHop());
  editErrorHop(file, 'disable', 'src');
  const m = loadModel(file);
  assert.equal(m.errorHops[0].enabled, 'N');
});

test('editErrorHop enable sets is_enabled to Y', () => {
  const file = write('eh.ktr', transWithErrorHop({ enabled: 'N' }));
  editErrorHop(file, 'enable', 'src');
  const m = loadModel(file);
  assert.equal(m.errorHops[0].enabled, 'Y');
});

test('editErrorHop remove drops the error block', () => {
  const file = write('eh.ktr', transWithErrorHop());
  editErrorHop(file, 'remove', 'src');
  const m = loadModel(file);
  assert.equal((m.errorHops ?? []).length, 0);
});

test('editErrorHop errors on a missing source', () => {
  const file = write('eh.ktr', transWithErrorHop());
  assert.throws(() => editErrorHop(file, 'disable', 'nope'), /source|error/i);
});

test('editErrorHop rejects job files', () => {
  const file = write('j.kjb', jobXml());
  assert.throws(() => editErrorHop(file, 'disable', 'run sql'), /job/i);
});

test('editErrorHop remove removes the ordinary hop when it exists solely for the error route', () => {
  const file = write('eh.ktr', transWithErrorHop());
  editErrorHop(file, 'remove', 'src');
  const m = loadModel(file);
  assert.ok(!m.hops.some(h => h.from === 'src' && h.to === 'err'), 'sole-error-route hop removed');
});

test('editErrorHop remove preserves the ordinary hop when another explicit route uses it', () => {
  const file = write('eh.ktr', transWithErrorHop({ extraRoute: true }));
  editErrorHop(file, 'remove', 'src');
  const m = loadModel(file);
  // src carries a SwitchCase default_target_step -> err, an explicit route that
  // needs the ordinary src->err hop, so removing the error block must keep it.
  assert.ok(m.hops.some(h => h.from === 'src' && h.to === 'err'), 'explicit route hop preserved');
  assert.equal((m.errorHops ?? []).length, 0);
});

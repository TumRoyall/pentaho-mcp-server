import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { XMLValidator } from 'fast-xml-parser';
import * as edit from '../src/core/edit.js';
import { validateFile } from '../src/core/validate.js';

let tmp;
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-add-element-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});

afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function write(name, xml) {
  const file = path.join(tmp, name);
  writeFileSync(file, xml);
  return file;
}

function assertOnlyInserted(before, after, marker) {
  const at = before.indexOf(marker);
  assert.notEqual(at, -1, `marker not found: ${marker}`);
  assert.ok(after.startsWith(before.slice(0, at)), 'content before insertion changed');
  assert.ok(after.endsWith(before.slice(at)), 'content after insertion changed');
  assert.ok(after.length > before.length, 'no content was inserted');
}

test('addElement loads a transformation template, sets escaped name and GUI location, and inserts before the trailing blocks', () => {
  const before = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info><name>x</name></info>',
    '  <order/>',
    '  <step_error_handling>',
    '  </step_error_handling>',
    '</transformation>',
  ].join('\n');
  const file = write('x.ktr', before);

  const out = edit.addElement(file, 'Dummy', 'New & <Step>', { x: 123, y: 456 });
  const after = readFileSync(file, 'utf8');

  assertOnlyInserted(before, after, '  <step_error_handling>');
  assert.ok(after.indexOf('<order/>') < after.indexOf('<step>'));
  assert.ok(after.indexOf('</step>') < after.indexOf('<step_error_handling>'));
  assert.match(after, /<name>New &amp; &lt;Step&gt;<\/name>/);
  assert.match(after, /<type>Dummy<\/type>/);
  assert.match(after, /<xloc>123<\/xloc>/);
  assert.match(after, /<yloc>456<\/yloc>/);
  assert.equal(XMLValidator.validate(after), true);
  assert.equal(validateFile(file).summary.errors, 0);
  assert.equal(out.catalogStatus, 'canonical');
  assert.equal(out.manualReviewRequired, false);
  assert.match(out.diff, /^--- /);
  assert.match(out.diff, /\+  <step>/);
});

test('addElement inserts a direct entry template before </entries> and replaces a name placeholder', () => {
  const before = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job>',
    '  <name>x</name>',
    '  <entries>',
    '    <entry>',
    '      <name>Start</name>',
    '      <type>SPECIAL</type>',
    '      <start>Y</start>',
    '    </entry>',
    '  </entries>',
    '  <hops>',
    '  </hops>',
    '</job>',
  ].join('\n');
  const file = write('x.kjb', before);
  const templateXml = [
    '<entry>',
    '  <name>{{ENTRY_NAME}}</name>',
    '  <type>SUCCESS</type>',
    '  <draw>Y</draw>',
    '  <xloc>{{X}}</xloc>',
    '  <yloc>{{Y}}</yloc>',
    '</entry>',
  ].join('\n');

  edit.addElement(file, 'SUCCESS', 'Finish', { templateXml, x: 300, y: 400 });
  const after = readFileSync(file, 'utf8');

  assertOnlyInserted(before, after, '  </entries>');
  assert.match(after, /    <entry>\n      <name>Finish<\/name>/);
  assert.match(after, /<xloc>300<\/xloc>/);
  assert.match(after, /<yloc>400<\/yloc>/);
  assert.equal(XMLValidator.validate(after), true);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('addElement loads a job entry template from embedded knowledge', () => {
  const before = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job>',
    '  <name>x</name>',
    '  <entries>',
    '    <entry>',
    '      <name>Start</name>',
    '      <type>SPECIAL</type>',
    '      <start>Y</start>',
    '    </entry>',
    '  </entries>',
    '  <hops></hops>',
    '</job>',
  ].join('\n');
  const file = write('knowledge.kjb', before);

  edit.addElement(file, 'SUCCESS', 'Done', { x: 700, y: 250 });
  const after = readFileSync(file, 'utf8');

  assertOnlyInserted(before, after, '  </entries>');
  assert.match(after, /<name>Done<\/name>/);
  assert.match(after, /<type>SUCCESS<\/type>/);
  assert.match(after, /<xloc>700<\/xloc>/);
  assert.match(after, /<yloc>250<\/yloc>/);
  assert.equal(validateFile(file).summary.errors, 0);
});

test('addElement canonical embedded knowledge is clean: no {{tokens}}, no XML comment', () => {
  const before = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info><name>x</name></info>',
    '  <order></order>',
    '</transformation>',
  ].join('\n');
  const file = write('wtl.ktr', before);

  const after = (() => {
    edit.addElement(file, 'Dummy', 'TEE', { x: 500, y: 100 });
    return readFileSync(file, 'utf8');
  })();

  // Name/GUI resolved; and crucially NO leftover template placeholders or comment.
  assert.match(after, /<name>TEE<\/name>/);
  assert.match(after, /<type>Dummy<\/type>/);
  assert.doesNotMatch(after, /\{\{/, 'template left a {{...}} placeholder in the file');
  assert.doesNotMatch(after, /<!--/, 'template left an XML comment in the file');
  assert.equal(validateFile(file).summary.errors, 0);
});

test('addElement refuses observed knowledge unless explicitly allowed', () => {
  const before = '<transformation><info><name>x</name></info><order/></transformation>';
  const file = write('observed.ktr', before);
  assert.throws(
    () => edit.addElement(file, 'SetSessionVariableStep', 'SetSess'),
    /status="observed".*allowObserved/,
  );
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('addElement marks explicitly allowed observed knowledge', () => {
  const file = write('observed.ktr', '<transformation><info><name>x</name></info><order/></transformation>');
  const out = edit.addElement(file, 'SetSessionVariableStep', 'SetSess', { allowObserved: true });
  const xml = readFileSync(file, 'utf8');
  assert.equal(out.catalogStatus, 'observed');
  assert.equal(out.manualReviewRequired, true);
  assert.equal((xml.match(/MANUAL_REVIEW/g) || []).length, 1);
});

test('addElement normalizes a matching marker in an observed custom template', () => {
  const file = write('observed-template.ktr', '<transformation><info><name>x</name></info><order/></transformation>');
  const marker = '<!-- MANUAL_REVIEW: WriteToLog is observed-only; verify in Spoon before production -->';
  const templateXml = [
    '<step>',
    `  ${marker}`,
    '  <name>OLD</name>',
    '  <type>WriteToLog</type>',
    '</step>',
  ].join('\n');

  edit.addElement(file, 'WriteToLog', 'Log', { allowObserved: true, templateXml });
  const xml = readFileSync(file, 'utf8');

  assert.equal(xml.split(marker).length - 1, 1);
});

test('addElement preserves CRLF when inserting a direct template', () => {
  const before = [
    '<?xml version="1.0"?>',
    '<transformation>',
    '  <info><name>x</name></info>',
    '  <order/>',
    '</transformation>',
  ].join('\r\n');
  const file = write('crlf.ktr', before);
  const templateXml = '<step>\n  <name>OLD</name>\n  <type>Dummy</type>\n</step>';

  edit.addElement(file, 'Dummy', 'New', { templateXml });
  const after = readFileSync(file, 'utf8');

  assert.equal(/(^|[^\r])\n/.test(after), false, 'inserted a bare LF into a CRLF file');
  assertOnlyInserted(before, after, '</transformation>');
});

test('addElement rejects duplicate names without changing the file', () => {
  const before = [
    '<transformation>',
    '  <info><name>x</name></info>',
    '  <order/>',
    '  <step><name>Same</name><type>Dummy</type></step>',
    '</transformation>',
  ].join('\n');
  const file = write('duplicate.ktr', before);

  assert.throws(
    () => edit.addElement(file, 'Dummy', 'Same', { templateXml: '<step><name>OLD</name><type>Dummy</type></step>' }),
    /step named "Same" already exists/,
  );
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('addElement reports an unknown knowledge type without changing the file', () => {
  const before = '<transformation><info><name>x</name></info><order/></transformation>';
  const file = write('unknown.ktr', before);

  assert.throws(() => edit.addElement(file, 'NOT_A_REAL_TYPE', 'New'), /No knowledge entry for trans type "NOT_A_REAL_TYPE"/);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('addElement rejects an unknown knowledge type even with a custom template', () => {
  const before = '<transformation><info><name>x</name></info><order/></transformation>';
  const file = write('unknown-template.ktr', before);

  assert.throws(
    () => edit.addElement(file, 'NOT_A_REAL_TYPE', 'New', {
      templateXml: '<step><name>OLD</name><type>NOT_A_REAL_TYPE</type></step>',
    }),
    /No knowledge entry for trans type "NOT_A_REAL_TYPE"/,
  );
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('addElement rejects a template for the wrong artifact kind', () => {
  const before = '<job><name>x</name><entries></entries><hops></hops></job>';
  const file = write('wrong-template.kjb', before);

  assert.throws(
    () => edit.addElement(file, 'SUCCESS', 'Finish', { templateXml: '<step><name>X</name><type>Dummy</type></step>' }),
    /Template must be a single <entry> block/,
  );
  assert.equal(readFileSync(file, 'utf8'), before);
});

// The KETTLE_ROOT write boundary is now enforced by the tool-adapter layer
// (createWorkspaceBoundary), covered by test/workspace-boundary.test.js and
// test/tool-boundary.test.js. Core edit functions are pure filesystem ops.

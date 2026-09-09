import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { renameElement, addErrorHop } from '../src/core/edit.js';
import { validateXml } from '../src/core/validate.js';
import { loadModel } from '../src/core/model.js';

let tmp;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `kettle-refs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });
});

/**
 * A transformation shaped like the consumer repo's real ones: two inputs
 * feeding a MergeJoin (which names its inputs in <step1>/<step2>) and a
 * FilterRows routing to two targets by name (<send_true_to>/<send_false_to>).
 * Neither reference is a hop, so renaming a step has to rewrite them too.
 */
const REF_TRANS = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<transformation>',
  '  <info>',
  '    <name>refs</name>',
  '  </info>',
  '  <order>',
  '    <hop>',
  '      <from>left in</from>',
  '      <to>merge</to>',
  '      <enabled>Y</enabled>',
  '    </hop>',
  '    <hop>',
  '      <from>right in</from>',
  '      <to>merge</to>',
  '      <enabled>Y</enabled>',
  '    </hop>',
  '    <hop>',
  '      <from>merge</from>',
  '      <to>split</to>',
  '      <enabled>Y</enabled>',
  '    </hop>',
  '    <hop>',
  '      <from>split</from>',
  '      <to>keep</to>',
  '      <enabled>Y</enabled>',
  '    </hop>',
  '    <hop>',
  '      <from>split</from>',
  '      <to>drop</to>',
  '      <enabled>Y</enabled>',
  '    </hop>',
  '  </order>',
  '  <step>',
  '    <name>left in</name>',
  '    <type>TableInput</type>',
  '  </step>',
  '  <step>',
  '    <name>right in</name>',
  '    <type>TableInput</type>',
  '  </step>',
  '  <step>',
  '    <name>merge</name>',
  '    <type>MergeJoin</type>',
  '    <step1>left in</step1>',
  '    <step2>right in</step2>',
  '  </step>',
  '  <step>',
  '    <name>split</name>',
  '    <type>FilterRows</type>',
  '    <send_true_to>keep</send_true_to>',
  '    <send_false_to>drop</send_false_to>',
  '  </step>',
  '  <step>',
  '    <name>keep</name>',
  '    <type>TableOutput</type>',
  '  </step>',
  '  <step>',
  '    <name>drop</name>',
  '    <type>Abort</type>',
  '  </step>',
  '</transformation>',
  '',
].join('\n');

function writeRefTrans() {
  const file = path.join(tmp, 'refs.ktr');
  writeFileSync(file, REF_TRANS, 'utf8');
  return file;
}

test('renameElement rewrites MergeJoin <step1>/<step2> references', () => {
  const file = writeRefTrans();
  const before = readFileSync(file, 'utf8');

  renameElement(file, 'left in', 'left source');

  const after = readFileSync(file, 'utf8');
  assert.match(after, /<step1>left source<\/step1>/);
  assert.ok(!after.includes('<step1>left in</step1>'), 'stale <step1> reference survived');
  // <step2> names a different step and must be untouched.
  assert.match(after, /<step2>right in<\/step2>/);
  // The hop naming the renamed step moved with it.
  assert.match(after, /<from>left source<\/from>/);
  // Nothing else moved: a rename edits scattered sites, so assert the whole
  // file byte-for-byte against an independently rebuilt expectation. The
  // occurrence guard keeps that expectation honest if the fixture changes.
  assert.equal(before.match(/left in/g).length, 3, 'fixture should hold exactly 3 references');
  assert.equal(after, before.split('left in').join('left source'));
});

test('renameElement rewrites FilterRows <send_true_to>/<send_false_to> references', () => {
  const file = writeRefTrans();

  renameElement(file, 'keep', 'kept rows');

  const after = readFileSync(file, 'utf8');
  assert.match(after, /<send_true_to>kept rows<\/send_true_to>/);
  assert.ok(!after.includes('<send_true_to>keep</send_true_to>'), 'stale <send_true_to> survived');
  // The false branch names a different step and must be untouched.
  assert.match(after, /<send_false_to>drop<\/send_false_to>/);
  assert.match(after, /<to>kept rows<\/to>/);
});

test('renameElement leaves same-named text that is not a step reference alone', () => {
  const file = path.join(tmp, 'sql.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info>',
    '    <name>t</name>',
    '  </info>',
    '  <order>',
    '  </order>',
    '  <step>',
    '    <name>merge</name>',
    '    <type>TableInput</type>',
    '    <sql>SELECT 1 FROM merge</sql>',
    '  </step>',
    '</transformation>',
    '',
  ].join('\n'), 'utf8');

  renameElement(file, 'merge', 'merge step');

  const after = readFileSync(file, 'utf8');
  assert.match(after, /<name>merge step<\/name>/);
  // A table that happens to share the step's name is not a reference.
  assert.match(after, /<sql>SELECT 1 FROM merge<\/sql>/);
});

test('validate flags a step reference that names no existing step', () => {
  const broken = REF_TRANS.replace('<step1>left in</step1>', '<step1>ghost</step1>');
  const r = validateXml(broken, 'refs.ktr', { dir: tmp });
  const msgs = r.issues.map(i => i.message).join(' | ');
  assert.match(msgs, /Step reference <step1> in "merge" names missing step "ghost"/);
  assert.equal(r.summary.errors, 0, `should be a warning, not an error: ${msgs}`);
  assert.ok(r.summary.warnings >= 1);
});

test('validate accepts intact step references', () => {
  const r = validateXml(REF_TRANS, 'refs.ktr', { dir: tmp });
  const msgs = r.issues.map(i => i.message).join(' | ');
  assert.ok(!msgs.includes('Step reference'), `unexpected step-reference issue: ${msgs}`);
});

// A FilterRows routing to "keep" via <send_true_to>, but the only matching
// hop split->keep is DISABLED. A disabled hop draws no arrow in Spoon, so the
// route is unsatisfied and must warn.
const DISABLED_TARGET_TRANS = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<transformation>',
  '  <info><name>t</name></info>',
  '  <order>',
  '    <hop><from>split</from><to>keep</to><enabled>N</enabled></hop>',
  '  </order>',
  '  <step>',
  '    <name>split</name>',
  '    <type>FilterRows</type>',
  '    <send_true_to>keep</send_true_to>',
  '  </step>',
  '  <step><name>keep</name><type>TableOutput</type></step>',
  '</transformation>',
].join('\n');

test('target reference satisfied only by a disabled hop is a warning', () => {
  const r = validateXml(DISABLED_TARGET_TRANS, 'refs.ktr', { dir: tmp });
  const msgs = r.issues.map(i => i.message).join(' | ');
  assert.match(msgs, /Step "split" routes to "keep" via <send_true_to> but has no hop to it/);
  assert.equal(r.summary.errors, 0, msgs);
});

test('enabled error handling satisfied only by a disabled ordinary hop is a warning', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info><name>t</name></info>',
    '  <order>',
    '    <hop><from>src</from><to>err</to><enabled>N</enabled></hop>',
    '  </order>',
    '  <step><name>src</name><type>TableInput</type></step>',
    '  <step><name>err</name><type>TableOutput</type></step>',
    '  <step_error_handling>',
    '    <error>',
    '      <source_step>src</source_step>',
    '      <target_step>err</target_step>',
    '      <is_enabled>Y</is_enabled>',
    '    </error>',
    '  </step_error_handling>',
    '</transformation>',
  ].join('\n');
  const r = validateXml(xml, 'refs.ktr', { dir: tmp });
  const msgs = r.issues.map(i => i.message).join(' | ');
  assert.match(msgs, /Error handling on "src" routes to "err" but has no hop to it/);
  assert.equal(r.summary.errors, 0, msgs);
});

test('error handling naming a missing source step is an error', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info><name>t</name></info>',
    '  <order>',
    '    <hop><from>ghost</from><to>err</to><enabled>Y</enabled></hop>',
    '  </order>',
    '  <step><name>err</name><type>TableOutput</type></step>',
    '  <step_error_handling>',
    '    <error>',
    '      <source_step>ghost</source_step>',
    '      <target_step>err</target_step>',
    '      <is_enabled>Y</is_enabled>',
    '    </error>',
    '  </step_error_handling>',
    '</transformation>',
  ].join('\n');
  const r = validateXml(xml, 'refs.ktr', { dir: tmp });
  const msgs = r.issues.map(i => i.message).join(' | ');
  assert.match(msgs, /Error handling.*missing.*source step "ghost"/i);
  assert.ok(r.summary.errors >= 1);
});

test('addErrorHop enables an existing disabled ordinary hop instead of adding a duplicate', () => {
  const file = path.join(tmp, 'err.ktr');
  writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info><name>t</name></info>',
    '  <order>',
    '    <hop>',
    '      <from>src</from>',
    '      <to>tgt</to>',
    '      <enabled>N</enabled>',
    '    </hop>',
    '  </order>',
    '  <step><name>src</name><type>TableInput</type></step>',
    '  <step><name>tgt</name><type>TableOutput</type></step>',
    '</transformation>',
    '',
  ].join('\n'), 'utf8');

  addErrorHop(file, 'src', 'tgt');
  const after = readFileSync(file, 'utf8');
  // No duplicate hop was inserted; the existing one is now enabled.
  assert.equal((after.match(/<from>src<\/from>/g) || []).length, 1);
  const m = loadModel(file);
  const hop = m.hops.find(h => h.from === 'src' && h.to === 'tgt');
  assert.ok(hop);
  assert.equal(hop.enabled, 'Y');
  // The error block was written for the source.
  assert.ok(m.errorHops.some(e => e.source === 'src' && e.target === 'tgt'));
});

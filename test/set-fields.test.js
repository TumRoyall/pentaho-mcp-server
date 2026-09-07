import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setFields, setFieldPath } from '../src/core/edit.js';

let tmp;
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-fields-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});
afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

function writeKtr(body) {
  const file = path.join(tmp, 'x.ktr');
  writeFileSync(file,
    `<?xml version="1.0" encoding="UTF-8"?>\n<transformation>\n  <info><name>x</name></info>\n${body}\n  <order/>\n</transformation>`);
  return file;
}

// A SelectValues template with ONE <field> and ONE <meta> sample item.
const SELECT_TEMPLATE = `  <step>
    <name>FORMAT</name>
    <type>SelectValues</type>
    <fields>
      <field>
        <name>SAMPLE</name>
      </field>
      <select_unspecified>N</select_unspecified>
      <meta>
        <name>SAMPLE</name>
        <rename/>
        <type>String</type>
        <conversion_mask/>
      </meta>
    </fields>
  </step>`;

test('setFields fills the <field> list from one template item, preserving siblings', () => {
  const file = writeKtr(SELECT_TEMPLATE);
  setFields(file, 'FORMAT', 'fields', 'field',
    ['USER_ID', 'USERNAME', 'PHONE_NUMBER'].map(name => ({ name })));
  const xml = readFileSync(file, 'utf8');
  assert.equal((xml.match(/<field>/g) || []).length, 3);
  assert.match(xml, /<name>USER_ID<\/name>/);
  assert.match(xml, /<name>PHONE_NUMBER<\/name>/);
  // Sibling <select_unspecified> and the <meta> block must remain intact.
  assert.match(xml, /<select_unspecified>N<\/select_unspecified>/);
  assert.equal((xml.match(/<meta>/g) || []).length, 1);
});

test('setFields learns tag order + defaults from the template item', () => {
  const file = writeKtr(SELECT_TEMPLATE);
  setFields(file, 'FORMAT', 'fields', 'meta', [
    { name: 'CREATED_AT', type: 'String', conversion_mask: 'dd/MM/yyyy HH:mm:ss' },
    { name: 'PHONE_NUMBER' }, // type/conversion_mask fall back to template defaults
  ]);
  const xml = readFileSync(file, 'utf8');
  assert.equal((xml.match(/<meta>/g) || []).length, 2);
  // Order is name, rename, type, conversion_mask — as in the template.
  assert.match(xml, /<meta>\s*<name>CREATED_AT<\/name>\s*<rename\/>\s*<type>String<\/type>\s*<conversion_mask>dd\/MM\/yyyy HH:mm:ss<\/conversion_mask>\s*<\/meta>/);
  // Second item: omitted type defaults to template's "String"; empty mask stays self-closing.
  assert.match(xml, /<meta>\s*<name>PHONE_NUMBER<\/name>\s*<rename\/>\s*<type>String<\/type>\s*<conversion_mask\/>\s*<\/meta>/);
});

test('setFields seeds a new item type from item keys when no template item exists', () => {
  // <fields> has only <select_unspecified>, no <field> to copy. The item's
  // child-tag order is derived from the keys of the provided items.
  const file = writeKtr(`  <step>\n    <name>S</name>\n    <type>X</type>\n    <fields>\n      <select_unspecified>N</select_unspecified>\n    </fields>\n  </step>`);
  setFields(file, 'S', 'fields', 'field', [
    { name: 'A', rename: '', length: '-2', precision: '-2' },
    { name: 'B', rename: '', length: '-2', precision: '-2' },
  ]);
  const xml = readFileSync(file, 'utf8');
  assert.equal((xml.match(/<field>/g) || []).length, 2);
  assert.match(xml, /<name>A<\/name>/);
  assert.match(xml, /<name>B<\/name>/);
  // The pre-existing sibling stays intact and inside the list.
  assert.match(xml, /<fields>[\s\S]*<select_unspecified>N<\/select_unspecified>[\s\S]*<field>[\s\S]*<\/fields>/);
});

test('setFields seeds <meta> into a SelectValues that has <field> but no <meta>', () => {
  // The real gap: a fresh SelectValues from add_element has <field> entries
  // and <select_unspecified> but no <meta> block yet.
  const file = writeKtr(`  <step>
    <name>FMT</name>
    <type>SelectValues</type>
    <fields>
      <field>
        <name>CREATED_AT</name>
      </field>
      <select_unspecified>N</select_unspecified>
    </fields>
  </step>`);
  setFields(file, 'FMT', 'fields', 'meta', [
    { name: 'CREATED_AT', rename: '', type: 'String', conversion_mask: 'dd/MM/yyyy HH:mm:ss' },
  ]);
  const xml = readFileSync(file, 'utf8');
  // The existing <field> is untouched; a new <meta> is added inside <fields>.
  assert.equal((xml.match(/<field>/g) || []).length, 1);
  assert.equal((xml.match(/<meta>/g) || []).length, 1);
  assert.match(xml, /<meta>\s*<name>CREATED_AT<\/name>\s*<rename\/>\s*<type>String<\/type>\s*<conversion_mask>dd\/MM\/yyyy HH:mm:ss<\/conversion_mask>\s*<\/meta>/);
  // Result stays well-formed and the seeded block is before </fields>.
  assert.match(xml, /<meta>[\s\S]*<\/meta>\s*<\/fields>/);
});

test('setFields rejects an empty items array', () => {
  const file = writeKtr(SELECT_TEMPLATE);
  assert.throws(() => setFields(file, 'FORMAT', 'fields', 'field', []),
    /non-empty items array/);
});

test('setFieldPath updates a value nested under <file>', () => {
  const file = writeKtr(`  <step>
    <name>XLS</name>
    <type>ExcelWriter</type>
    <file>
      <name>out</name>
      <extention>xlsx</extention>
      <sheetname>OLD</sheetname>
    </file>
  </step>`);
  setFieldPath(file, 'XLS', 'file/sheetname', 'ACTIVE_USERS');
  const xml = readFileSync(file, 'utf8');
  assert.match(xml, /<sheetname>ACTIVE_USERS<\/sheetname>/);
  assert.doesNotMatch(xml, /OLD/);
});

test('setFieldPath creates a missing leaf inside the nested parent', () => {
  const file = writeKtr(`  <step>
    <name>XLS</name>
    <type>ExcelWriter</type>
    <file>
      <name>out</name>
    </file>
  </step>`);
  setFieldPath(file, 'XLS', 'file/sheetname', 'ACTIVE_USERS');
  const xml = readFileSync(file, 'utf8');
  // Leaf inserted before </file>, still inside the <file> block.
  assert.match(xml, /<file>[\s\S]*<sheetname>ACTIVE_USERS<\/sheetname>[\s\S]*<\/file>/);
});

test('setFieldPath single segment behaves like a direct child set', () => {
  const file = writeKtr(`  <step>\n    <name>T</name>\n    <type>TableInput</type>\n    <limit>0</limit>\n  </step>`);
  setFieldPath(file, 'T', 'limit', '100');
  assert.match(readFileSync(file, 'utf8'), /<limit>100<\/limit>/);
});

test('setFieldPath errors when an ancestor segment is missing', () => {
  const file = writeKtr(`  <step>\n    <name>XLS</name>\n    <type>ExcelWriter</type>\n  </step>`);
  assert.throws(() => setFieldPath(file, 'XLS', 'file/sheetname', 'X'),
    /Path segment "file" not found/);
});

// The KETTLE_ROOT write boundary is now enforced by the tool-adapter layer
// (createWorkspaceBoundary), covered by test/workspace-boundary.test.js and
// test/tool-boundary.test.js. Core edit functions are pure filesystem ops.

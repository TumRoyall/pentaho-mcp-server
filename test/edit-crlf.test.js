import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { editHops, setField } from '../src/core/edit.js';
import { loadModel, text } from '../src/core/model.js';
import { assertMinimalDiff } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', 'bcqt_kpcs', ...p);
let tmp;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `kettle-edit-crlf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });
  // Never edit fixtures in place: work only on temp copies.
  copyFileSync(fx('etl_trans_ias_tableau_period.ktr'), path.join(tmp, 'etl_trans_ias_tableau_period.ktr'));
  copyFileSync(fx('etl_job_ias_bcqt_kpcs.kjb'), path.join(tmp, 'etl_job_ias_bcqt_kpcs.kjb'));
});

/** No lone \r and no lone \n survive anywhere in the file: every newline is a \r\n pair. */
function assertPureCrlf(xml) {
  assert.equal(xml.match(/\r(?!\n)/g), null, 'found a \\r not followed by \\n');
  assert.equal(xml.match(/(?<!\r)\n/g), null, 'found a \\n not preceded by \\r');
}

test('real fixture is CRLF throughout (sanity check for this suite)', () => {
  const before = readFileSync(path.join(tmp, 'etl_trans_ias_tableau_period.ktr'), 'utf8');
  assertPureCrlf(before);
  const cr = (before.match(/\r/g) || []).length;
  const lf = (before.match(/\n/g) || []).length;
  assert.ok(cr > 0 && cr === lf);
});

test('removing a hop from a CRLF file leaves no stray CR and stays byte-identical elsewhere', () => {
  const file = path.join(tmp, 'etl_trans_ias_tableau_period.ktr');
  const before = readFileSync(file, 'utf8');
  editHops(file, 'remove', 'IAS_REMEDIATION_PERIOD', 'Sort rows');
  const after = readFileSync(file, 'utf8');

  assertPureCrlf(after);
  // Removing touches only the hop block: prove it positionally the same way
  // edit2.test.js does for the LF fixture, with before/after swapped so the
  // helper's "added" lines are exactly what disappeared from `before`.
  assertMinimalDiff(after, before, [
    '<hop>', '<from>IAS_REMEDIATION_PERIOD</from>', '<to>Sort rows</to>', '<enabled>Y</enabled>', '</hop>',
  ]);

  const m = loadModel(file);
  assert.equal(m.hops.length, 1);
  assert.deepEqual(m.hops.map(h => [h.from, h.to]), [['Sort rows', 'merge TABLEAU_REMEDIATION_PERIOD']]);
});

test('adding a hop to a CRLF file introduces no bare LF', () => {
  const file = path.join(tmp, 'etl_trans_ias_tableau_period.ktr');
  const before = readFileSync(file, 'utf8');
  editHops(file, 'add', 'IAS_REMEDIATION_PERIOD', 'merge TABLEAU_REMEDIATION_PERIOD');
  const after = readFileSync(file, 'utf8');

  assertPureCrlf(after);
  assertMinimalDiff(before, after, [
    '<hop>', '<from>IAS_REMEDIATION_PERIOD</from>', '<to>merge TABLEAU_REMEDIATION_PERIOD</to>', '<enabled>Y</enabled>', '</hop>',
  ]);

  const m = loadModel(file);
  assert.equal(m.hops.length, 3);
  assert.ok(m.hops.some(h => h.from === 'IAS_REMEDIATION_PERIOD' && h.to === 'merge TABLEAU_REMEDIATION_PERIOD'));
});

test('setField creating a missing child on a CRLF job file uses CRLF and sibling-depth indent', () => {
  const file = path.join(tmp, 'etl_job_ias_bcqt_kpcs.kjb');
  const before = readFileSync(file, 'utf8');
  setField(file, 'Start', 'zz_new_field', 'Y');
  const after = readFileSync(file, 'utf8');

  assertPureCrlf(after);
  // The "Start" entry's closing </entry> sits at 4-space indent with its
  // siblings (<name>, <type>, ...) at 6-space indent; the new field must
  // land at that same 6-space sibling depth, on its own CRLF line, and the
  // closing tag's own line must be re-emitted unchanged (not re-indented).
  assert.ok(after.includes('<attributes_kjc/>\r\n      <zz_new_field>Y</zz_new_field>\r\n    </entry>'));
  assertMinimalDiff(before, after, ['zz_new_field']);

  const m = loadModel(file);
  const start = m.elements.find(e => e.name === 'Start');
  assert.equal(text(start.raw.zz_new_field), 'Y');
});

test('removing one hop out of several leaves the rest byte-identical (finding 1 x finding 10)', () => {
  const file = path.join(tmp, 'etl_job_ias_bcqt_kpcs.kjb');
  const before = readFileSync(file, 'utf8');
  const beforeModel = loadModel(file);
  assert.equal(beforeModel.hops.length, 11);

  editHops(file, 'remove', 'Job_Sub', 'delete log running 2');
  const after = readFileSync(file, 'utf8');

  assertPureCrlf(after);
  assertMinimalDiff(after, before, [
    '<hop>', '<from>Job_Sub</from>', '<to>delete log running 2</to>',
    '<from_nr>0</from_nr>', '<to_nr>0</to_nr>', '<enabled>Y</enabled>',
    '<evaluation>N</evaluation>', '<unconditional>N</unconditional>', '</hop>',
  ]);

  const m = loadModel(file);
  assert.equal(m.hops.length, 10);
  assert.ok(!m.hops.some(h => h.from === 'Job_Sub' && h.to === 'delete log running 2'));
  // every other hop survives untouched
  assert.ok(m.hops.some(h => h.from === 'Job_Sub' && h.to === 'delete log running'));
  assert.ok(m.hops.some(h => h.from === 'check job dang chay' && h.to === 'Success 2'));
});

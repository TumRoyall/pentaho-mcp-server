import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateFile, validateXml, validateAll } from '../src/core/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);
const msgs = r => r.issues.map(i => i.message).join(' | ');

test('clean fixtures produce no errors', () => {
  for (const f of [fx('mini.ktr'), fx('mini.kjb')]) {
    const r = validateFile(f);
    assert.equal(r.summary.errors, 0, msgs(r));
  }
});

test('malformed XML is a single error', () => {
  const r = validateXml('<job><name>x</name>', 'broken.kjb', { dir: '.' });
  assert.equal(r.summary.errors, 1);
  assert.match(r.issues[0].message, /Malformed XML/);
});

test('hop referencing a missing element is an error', () => {
  const xml = readFileSync(fx('mini.ktr'), 'utf8').replace('<to>out</to>', '<to>ghost</to>');
  const r = validateXml(xml, 'mini.ktr', { dir: fx() });
  assert.match(msgs(r), /Hop to references missing element "ghost"/);
});

test('job without exactly one start entry is an error', () => {
  const xml = readFileSync(fx('mini.kjb'), 'utf8').replace('<start>Y</start>', '<start>N</start>');
  const r = validateXml(xml, 'mini.kjb', { dir: fx() });
  assert.match(msgs(r), /exactly one start entry, found 0/);
});

test('undefined connection is an error', () => {
  const xml = readFileSync(fx('mini.ktr'), 'utf8').replace('<connection>conn_a</connection>', '<connection>conn_missing</connection>');
  const r = validateXml(xml, 'mini.ktr', { dir: fx() });
  assert.match(msgs(r), /undefined connection "conn_missing"/);
});

test('duplicate element names are an error', () => {
  const xml = readFileSync(fx('mini.ktr'), 'utf8').replace('<name>out</name>', '<name>in</name>');
  const r = validateXml(xml, 'mini.ktr', { dir: fx() });
  assert.match(msgs(r), /Duplicate element name "in"/);
});

test('TRANS entry with missing file is an error, resolvable one is not', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<job>',
    '  <name>j</name>',
    '  <entries>',
    '    <entry><name>Start</name><type>SPECIAL</type><start>Y</start></entry>',
    '    <entry><name>t1</name><type>TRANS</type><filename>${Internal.Job.Filename.Directory}/etl_trans_ias_recommendation_member.ktr</filename></entry>',
    '    <entry><name>t2</name><type>TRANS</type><filename>${Internal.Job.Filename.Directory}/does_not_exist.ktr</filename></entry>',
    '  </entries>',
    '  <hops>',
    '    <hop><from>Start</from><to>t1</to><enabled>Y</enabled><unconditional>Y</unconditional></hop>',
    '    <hop><from>t1</from><to>t2</to><enabled>Y</enabled><evaluation>Y</evaluation></hop>',
    '  </hops>',
    '</job>',
  ].join('\n');
  const r = validateXml(xml, 'j.kjb', { dir: fx('bcqt_kpcs') });
  assert.match(msgs(r), /references missing file: .*does_not_exist\.ktr/);
  assert.ok(!msgs(r).includes('etl_trans_ias_recommendation_member'));
});

test('unreachable element is a warning, unknown variable is info', () => {
  const xml = readFileSync(fx('mini.kjb'), 'utf8')
    .replace('</entries>', '  <entry><name>orphan</name><type>SUCCESS</type></entry>\n  </entries>')
    .replace('DELETE FROM T', 'DELETE FROM T_${UNDECLARED}');
  const r = validateXml(xml, 'mini.kjb', { dir: fx() });
  assert.match(msgs(r), /"orphan" is not reachable/);
  assert.match(msgs(r), /\$\{UNDECLARED\} is not a declared parameter/);
  assert.equal(r.summary.errors, 0, msgs(r));
});

test('real fixture job passes structural rules', () => {
  const r = validateFile(fx('bcqt_kpcs', 'etl_job_ias_bcqt_kpcs.kjb'));
  const structural = r.issues.filter(i =>
    /Hop|Duplicate|start entry|Malformed/.test(i.message) && i.severity === 'error');
  assert.deepEqual(structural, []);
});

test('validateAll aggregates across a tree', () => {
  const all = validateAll(fx('bcqt_kpcs'));
  assert.ok(all.summary.files >= 3);
  assert.ok(typeof all.summary.errors === 'number');
});

test('well-formed XML with the wrong root is reported as an error, not thrown', () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><foo><name>x</name></foo>';
  assert.doesNotThrow(() => validateXml(xml, 'bad.kjb', { dir: '.' }));
  const r = validateXml(xml, 'bad.kjb', { dir: '.' });
  assert.equal(r.summary.errors, 1);
  assert.match(msgs(r), /Missing <job> root/);
});

test('validateAll still reports every file when one has a structurally invalid root', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-validate-'));
  try {
    cpSync(fx('mini.ktr'), path.join(tmp, 'mini.ktr'));
    writeFileSync(path.join(tmp, 'bad.kjb'), '<?xml version="1.0" encoding="UTF-8"?><foo><name>x</name></foo>');
    const all = validateAll(tmp);
    assert.equal(all.summary.files, 2);
    const bad = all.files.find(f => f.path.endsWith('bad.kjb'));
    assert.ok(bad, `expected a report for bad.kjb among: ${all.files.map(f => f.path).join(', ')}`);
    assert.match(bad.issues.map(i => i.message).join(' | '), /Missing <job> root/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize, getElement } from '../src/core/summarize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);

test('summarize a transformation', () => {
  const s = summarize(fx('mini.ktr'));
  assert.equal(s.kind, 'trans');
  assert.equal(s.name, 'mini');
  const input = s.elements.find(e => e.name === 'in');
  assert.equal(input.connection, 'conn_a');
  assert.equal(input.sqlPreview, 'SELECT 1 FROM DUAL WHERE 1 < 2');
  assert.deepEqual(s.hops, ['in -> out']);
});

test('summarize a job labels hop conditions', () => {
  const s = summarize(fx('mini.kjb'));
  assert.deepEqual(s.hops, ['Start -> run sql [always]', 'run sql -> ok [on success]']);
});

test('summarize truncates long SQL to 3 lines', () => {
  const s = summarize(fx('bcqt_kpcs', 'etl_trans_ias_recommendation_member.ktr'));
  for (const e of s.elements) {
    if (e.sqlPreview) assert.ok(e.sqlPreview.split('\n').length <= 3);
  }
});

test('getElement returns full config and raw XML', () => {
  const e = getElement(fx('mini.kjb'), 'run sql');
  assert.equal(e.type, 'SQL');
  assert.match(String(e.config.sql), /DELETE FROM T/);
  const withRaw = getElement(fx('mini.kjb'), 'run sql', true);
  assert.ok(withRaw.rawXml.startsWith('<entry>'));
  assert.ok(withRaw.rawXml.endsWith('</entry>'));
});

test('getElement error names available elements', () => {
  assert.throws(() => getElement(fx('mini.ktr'), 'nope'), /have: in, out/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, kindOf, toArray, text } from '../src/core/model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);

test('kindOf detects file kinds', () => {
  assert.equal(kindOf('a/b.kjb'), 'job');
  assert.equal(kindOf('a/B.KTR'), 'trans');
  assert.throws(() => kindOf('a/b.xml'), /Not a Kettle file/);
});

test('toArray and text helpers', () => {
  assert.deepEqual(toArray(undefined), []);
  assert.deepEqual(toArray(1), [1]);
  assert.deepEqual(toArray([1, 2]), [1, 2]);
  assert.equal(text(undefined), '');
  assert.equal(text('x'), 'x');
  assert.equal(text({ '#text': 'y' }), 'y');
});

test('parses mini transformation', () => {
  const m = loadModel(fx('mini.ktr'));
  assert.equal(m.kind, 'trans');
  assert.equal(m.name, 'mini');
  assert.deepEqual(m.connections, ['conn_a']);
  assert.deepEqual(m.elements.map(e => [e.name, e.type, e.tag]), [
    ['in', 'TableInput', 'step'],
    ['out', 'TableOutput', 'step'],
  ]);
  assert.deepEqual(m.hops, [{ from: 'in', to: 'out', enabled: 'Y' }]);
  assert.equal(text(m.elements[0].raw.sql), 'SELECT 1 FROM DUAL WHERE 1 < 2');
});

test('parses mini job', () => {
  const m = loadModel(fx('mini.kjb'));
  assert.equal(m.kind, 'job');
  assert.equal(m.name, 'minijob');
  assert.equal(m.params[0].name, 'INPUT_DATE');
  assert.equal(m.params[0].default, '20260101');
  assert.deepEqual(m.elements.map(e => e.type), ['SPECIAL', 'SQL', 'SUCCESS']);
  assert.equal(m.hops.length, 2);
  assert.equal(m.hops[0].unconditional, 'Y');
});

test('parses a real 9.4 job and transformation', () => {
  const j = loadModel(fx('bcqt_kpcs', 'etl_job_ias_bcqt_kpcs.kjb'));
  assert.equal(j.kind, 'job');
  assert.equal(j.name, 'etl_job_ias_bcqt_kpcs');
  assert.ok(j.params.some(p => p.name === 'INPUT_DATE'));
  assert.ok(j.elements.some(e => e.type === 'SPECIAL'));
  const t = loadModel(fx('bcqt_kpcs', 'etl_trans_ias_recommendation_member.ktr'));
  assert.equal(t.kind, 'trans');
  assert.ok(t.elements.some(e => e.type === 'TableInput'));
  for (const h of t.hops) {
    assert.ok(t.elements.some(e => e.name === h.from), `hop from ${h.from} exists`);
    assert.ok(t.elements.some(e => e.name === h.to), `hop to ${h.to} exists`);
  }
});

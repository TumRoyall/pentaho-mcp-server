import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAllSpans, findChildSpan, findElementSpan, innerText, escapeXml, unescapeXml } from '../src/core/span.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);

test('escape/unescape round-trip', () => {
  const s = `a < b & c > 'd' "e"`;
  assert.equal(unescapeXml(escapeXml(s)), s);
  assert.equal(escapeXml('a & b < c'), 'a &amp; b &lt; c');
  assert.equal(unescapeXml('1 &lt; 2 &#x27;x&#x27; &#39;y&#39;'), `1 < 2 'x' 'y'`);
});

test('findAllSpans finds exact tags only', () => {
  const xml = readFileSync(fx('mini.ktr'), 'utf8');
  assert.equal(findAllSpans(xml, 'step').length, 2);
  assert.equal(findAllSpans(xml, 'hop').length, 1);
  // '<step>' must not match '<step_error_handling>' etc.
  assert.equal(findAllSpans('<ab>x</ab><abc>y</abc>', 'ab').length, 1);
});

test('findElementSpan + innerText', () => {
  const xml = readFileSync(fx('mini.ktr'), 'utf8');
  const span = findElementSpan(xml, 'step', 'in');
  assert.ok(span);
  assert.equal(innerText(xml, span, 'type'), 'TableInput');
  assert.equal(unescapeXml(innerText(xml, span, 'sql')), 'SELECT 1 FROM DUAL WHERE 1 < 2');
  assert.equal(findElementSpan(xml, 'step', 'missing'), null);
  const slice = xml.slice(span.start, span.end);
  assert.ok(slice.startsWith('<step>') && slice.endsWith('</step>'));
});

test('findChildSpan handles self-closing and prefix-tags', () => {
  const xml = '<entry>\n  <name>e1</name>\n  <sql/>\n  <from_nr>0</from_nr>\n  <from>x</from>\n</entry>';
  const span = { start: 0, end: xml.length };
  const sql = findChildSpan(xml, span, 'sql');
  assert.equal(sql.selfClosing, true);
  const from = findChildSpan(xml, span, 'from');
  assert.equal(xml.slice(from.inner.start, from.inner.end), 'x'); // not '<from_nr>'
  assert.equal(findChildSpan(xml, span, 'absent'), null);
});

test('span works on a real job file', () => {
  const xml = readFileSync(fx('bcqt_kpcs', 'etl_job_ias_bcqt_kpcs.kjb'), 'utf8');
  const span = findElementSpan(xml, 'entry', 'Start');
  assert.ok(span);
  assert.equal(innerText(xml, span, 'type'), 'SPECIAL');
});

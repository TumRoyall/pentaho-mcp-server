import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setArtifactParameters, copyConnection } from '../src/core/artifact-edit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function scratch() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-artifact-edit-'));
  dirs.push(root);
  copyFileSync(fx('mini.ktr'), path.join(root, 'mini.ktr'));
  copyFileSync(fx('mini.kjb'), path.join(root, 'mini.kjb'));
  return root;
}

function write(root, name, text) {
  const p = path.join(root, name);
  writeFileSync(p, text);
  return p;
}

// --- Step 1: setArtifactParameters ------------------------------------------

test('setArtifactParameters replaces the transformation parameter list under info', () => {
  const root = scratch();
  const file = path.join(root, 'mini.ktr');
  const diff = setArtifactParameters(file, [
    { name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' },
  ]);
  assert.match(diff, /RUN_DATE/);
  const xml = readFileSync(file, 'utf8');
  assert.match(xml, /<parameter>\s*<name>RUN_DATE<\/name>\s*<default_value>2026-09-09<\/default_value>\s*<description>Business date<\/description>\s*<\/parameter>/);
  // parameters must remain under <info>, and info's <name> untouched
  assert.match(xml, /<info>[\s\S]*<name>mini<\/name>[\s\S]*<parameters>[\s\S]*RUN_DATE[\s\S]*<\/parameters>[\s\S]*<\/info>/);
  // unrelated bytes preserved
  assert.match(xml, /<step>\s*<name>in<\/name>/);
  assert.match(xml, /SELECT 1 FROM DUAL WHERE 1 &lt; 2/);
});

test('setArtifactParameters replaces the job parameter list under job root', () => {
  const root = scratch();
  const file = path.join(root, 'mini.kjb');
  setArtifactParameters(file, [
    { name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' },
  ]);
  const xml = readFileSync(file, 'utf8');
  // Old parameter declaration gone from the <parameters> list, new one present.
  assert.doesNotMatch(xml, /<name>INPUT_DATE<\/name>/);
  assert.match(xml, /<parameters>[\s\S]*<name>RUN_DATE<\/name>[\s\S]*<\/parameters>/);
  // entries preserved, including the SQL that still references ${INPUT_DATE}
  assert.match(xml, /<name>run sql<\/name>/);
  assert.match(xml, /\$\{INPUT_DATE\}/);
});

test('setArtifactParameters creates the parameters container when absent (trans)', () => {
  const root = scratch();
  const noParams = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info>
    <name>np</name>
  </info>
  <order>
  </order>
  <step>
    <name>in</name>
    <type>TableInput</type>
  </step>
</transformation>
`;
  const file = write(root, 'np.ktr', noParams);
  setArtifactParameters(file, [
    { name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' },
  ]);
  const xml = readFileSync(file, 'utf8');
  assert.match(xml, /<info>[\s\S]*<parameters>[\s\S]*<name>RUN_DATE<\/name>[\s\S]*<\/parameters>[\s\S]*<\/info>/);
  assert.match(xml, /<name>np<\/name>/);
});

test('setArtifactParameters creates the parameters container when absent (job)', () => {
  const root = scratch();
  const noParams = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>nj</name>
  <entries>
    <entry>
      <name>Start</name>
      <type>SPECIAL</type>
      <start>Y</start>
    </entry>
  </entries>
  <hops>
  </hops>
</job>
`;
  const file = write(root, 'nj.kjb', noParams);
  setArtifactParameters(file, [
    { name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' },
  ]);
  const xml = readFileSync(file, 'utf8');
  assert.match(xml, /<parameters>[\s\S]*<name>RUN_DATE<\/name>[\s\S]*<\/parameters>/);
  assert.match(xml, /<name>Start<\/name>/);
});

test('setArtifactParameters rejects duplicate names', () => {
  const root = scratch();
  const file = path.join(root, 'mini.ktr');
  assert.throws(() => setArtifactParameters(file, [
    { name: 'A', default: '1', description: '' },
    { name: 'A', default: '2', description: '' },
  ]), /duplicate/i);
});

test('setArtifactParameters rejects blank names', () => {
  const root = scratch();
  const file = path.join(root, 'mini.ktr');
  assert.throws(() => setArtifactParameters(file, [
    { name: '   ', default: '1', description: '' },
  ]), /blank|empty/i);
});

test('setArtifactParameters escapes & < > in values', () => {
  const root = scratch();
  const file = path.join(root, 'mini.ktr');
  setArtifactParameters(file, [
    { name: 'Q', default: 'a & b < c > d', description: 'x < y & z' },
  ]);
  const xml = readFileSync(file, 'utf8');
  assert.match(xml, /<default_value>a &amp; b &lt; c &gt; d<\/default_value>/);
  assert.match(xml, /<description>x &lt; y &amp; z<\/description>/);
});

test('setArtifactParameters preserves CRLF line endings', () => {
  const root = scratch();
  const crlf = readFileSync(fx('mini.ktr'), 'utf8').replace(/\r?\n/g, '\r\n');
  const file = write(root, 'crlf.ktr', crlf);
  setArtifactParameters(file, [
    { name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' },
  ]);
  const xml = readFileSync(file, 'utf8');
  assert.ok(xml.includes('\r\n'), 'CRLF should be preserved');
  assert.doesNotMatch(xml, /[^\r]\n/, 'no lone LF should be introduced');
});

// --- Step 4: copyConnection --------------------------------------------------

test('copyConnection copies a named connection by direct <connection><name>', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info>
    <name>s</name>
    <parameters>
    </parameters>
  </info>
  <order>
  </order>
  <connection>
    <name>SrcDB</name>
    <server>host</server>
    <password></password>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  const diff = copyConnection(src, dest, 'SrcDB', {});
  assert.match(diff, /SrcDB/);
  const xml = readFileSync(dest, 'utf8');
  assert.match(xml, /<name>SrcDB<\/name>/);
  assert.match(xml, /<server>host<\/server>/);
  // existing connection preserved
  assert.match(xml, /<name>conn_a<\/name>/);
});

test('copyConnection refuses a destination-name collision', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>conn_a</name>
    <server>host</server>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  assert.throws(() => copyConnection(src, dest, 'conn_a', {}), /collision|already exists|exists/i);
});

test('copyConnection renames only the direct <name> child', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>SrcDB</name>
    <server>SrcDB-host</server>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  copyConnection(src, dest, 'SrcDB', { destName: 'DestDB' });
  const xml = readFileSync(dest, 'utf8');
  assert.match(xml, /<name>DestDB<\/name>/);
  // server value that also contained the old name is untouched
  assert.match(xml, /<server>SrcDB-host<\/server>/);
  assert.doesNotMatch(xml, /<name>SrcDB<\/name>/);
});

test('copyConnection preserves CRLF in the destination', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>SrcDB</name>
    <server>host</server>
  </connection>
</transformation>
`);
  const crlf = readFileSync(fx('mini.ktr'), 'utf8').replace(/\r?\n/g, '\r\n');
  const dest = write(root, 'crlf.ktr', crlf);
  copyConnection(src, dest, 'SrcDB', {});
  const xml = readFileSync(dest, 'utf8');
  assert.ok(xml.includes('\r\n'), 'CRLF preserved');
  assert.doesNotMatch(xml, /[^\r]\n/, 'no lone LF introduced');
});

test('copyConnection is independent of source/destination kind (job into trans)', () => {
  const root = scratch();
  const jobSrc = write(root, 'src.kjb', `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>s</name>
  <entries>
    <entry><name>Start</name><type>SPECIAL</type><start>Y</start></entry>
  </entries>
  <hops></hops>
  <connection>
    <name>JobDB</name>
    <server>host</server>
  </connection>
</job>
`);
  const dest = path.join(root, 'mini.ktr');
  copyConnection(jobSrc, dest, 'JobDB', {});
  const xml = readFileSync(dest, 'utf8');
  assert.match(xml, /<name>JobDB<\/name>/);
  assert.match(xml, /<\/transformation>/);
});

test('copyConnection allows an empty/self-closing password', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>SrcDB</name>
    <password/>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  assert.doesNotThrow(() => copyConnection(src, dest, 'SrcDB', {}));
});

test('copyConnection allows a ${VARIABLE} password', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>SrcDB</name>
    <password>\${DB_PASSWORD}</password>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  assert.doesNotThrow(() => copyConnection(src, dest, 'SrcDB', {}));
  const xml = readFileSync(dest, 'utf8');
  assert.match(xml, /<password>\$\{DB_PASSWORD\}<\/password>/);
});

test('copyConnection allows an Encrypted password only with explicit opt-in', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>SrcDB</name>
    <password>Encrypted 2be98afc86aa7f2e4cb79ce10df90acde</password>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  assert.throws(() => copyConnection(src, dest, 'SrcDB', {}), /encrypt|password/i);
  assert.doesNotThrow(() => copyConnection(src, dest, 'SrcDB', { allowEncryptedPassword: true }));
  const xml = readFileSync(dest, 'utf8');
  assert.match(xml, /Encrypted 2be98afc/);
});

test('copyConnection refuses a plaintext password', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>SrcDB</name>
    <password>hunter2</password>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  assert.throws(() => copyConnection(src, dest, 'SrcDB', {}), /password|plaintext/i);
  assert.throws(
    () => copyConnection(src, dest, 'SrcDB', { allowEncryptedPassword: true }),
    /password|plaintext/i,
  );
  const xml = readFileSync(dest, 'utf8');
  assert.doesNotMatch(xml, /hunter2/);
});

test('copyConnection throws when the source connection is missing', () => {
  const root = scratch();
  const src = write(root, 'src.ktr', `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>s</name></info>
  <order></order>
  <connection>
    <name>Other</name>
  </connection>
</transformation>
`);
  const dest = path.join(root, 'mini.ktr');
  assert.throws(() => copyConnection(src, dest, 'SrcDB', {}), /SrcDB|not found|no connection/i);
});

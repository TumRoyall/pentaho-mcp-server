import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mkdtempSync, writeFileSync, rmSync, readFileSync, symlinkSync,
} from 'node:fs';
import os from 'node:os';
import { walkKettleFiles, listArtifacts, search } from '../src/core/search.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(here, 'fixtures');

function isIsoDate(s) {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

/** Windows refuses symlink creation without elevation; skip there. */
function canSymlink() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kettle-symcheck-'));
  try {
    symlinkSync(path.join(dir, 'absent'), path.join(dir, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('walkKettleFiles finds all fixtures recursively', () => {
  const files = walkKettleFiles(FX);
  assert.ok(files.some(f => f.endsWith('mini.ktr')));
  assert.ok(files.some(f => f.includes('bcqt_kpcs') && f.endsWith('.kjb')));
  assert.ok(files.every(f => /\.(ktr|kjb)$/i.test(f)));
});

test('listArtifacts returns inventory rows', () => {
  const rows = listArtifacts(FX);
  const mini = rows.find(r => r.path.endsWith('mini.kjb'));
  assert.equal(mini.kind, 'job');
  assert.equal(mini.name, 'minijob');
  assert.deepEqual(mini.params, ['INPUT_DATE']);
  assert.equal(mini.elements, 3);
  assert.ok(isIsoDate(mini.modified), `expected an ISO modified date, got ${mini.modified}`);
});

test('listArtifacts degrades to a per-file error row instead of aborting, and still carries modified', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kettle-list-'));
  try {
    // An unterminated attribute is malformed enough that even
    // fast-xml-parser's lenient XMLParser throws (unlike a merely unclosed
    // tag, which it tolerates by auto-closing).
    writeFileSync(path.join(tmpDir, 'broken.ktr'), '<transformation><step attr="unterminated></step></transformation>', 'utf8');
    writeFileSync(path.join(tmpDir, 'ok.ktr'), readFileSync(path.join(FX, 'mini.ktr')), 'utf8');
    const rows = listArtifacts(tmpDir);
    const broken = rows.find(r => r.path.endsWith('broken.ktr'));
    const ok = rows.find(r => r.path.endsWith('ok.ktr'));
    assert.ok(broken.error, 'expected an error message on the malformed file');
    assert.ok(isIsoDate(broken.modified));
    assert.equal(ok.kind, 'trans');
    assert.ok(isIsoDate(ok.modified));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test(
  'listArtifacts survives a file that cannot be stat-ed (vanished between walk and read)',
  { skip: canSymlink() ? false : 'symlink creation not permitted on this platform' },
  () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kettle-vanish-'));
    try {
      // A dangling symlink is exactly the vanished-file condition: the walk
      // lists it, then both statSync and readFileSync fail on it.
      symlinkSync(path.join(tmpDir, 'gone.ktr'), path.join(tmpDir, 'dangling.ktr'));
      writeFileSync(path.join(tmpDir, 'ok.ktr'), readFileSync(path.join(FX, 'mini.ktr')), 'utf8');

      const rows = listArtifacts(tmpDir);

      const dangling = rows.find(r => r.path.endsWith('dangling.ktr'));
      assert.ok(dangling.error, 'expected an error row, not a thrown exception');
      assert.equal(dangling.modified, undefined, 'no mtime is knowable for a vanished file');
      // The healthy sibling is still reported in full.
      const ok = rows.find(r => r.path.endsWith('ok.ktr'));
      assert.equal(ok.kind, 'trans');
      assert.ok(isIsoDate(ok.modified));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

test('search degrades to a per-file error row (naming the file) instead of aborting the whole search', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kettle-search-broken-'));
  try {
    // Unclosed <step> — findAllSpans throws for this file specifically.
    writeFileSync(path.join(tmpDir, 'broken.ktr'), '<transformation><step><name>x</name><sql>SELECT 1 FROM DUAL</sql>', 'utf8');
    writeFileSync(path.join(tmpDir, 'ok.ktr'), readFileSync(path.join(FX, 'mini.ktr')), 'utf8');
    const hits = search(tmpDir, 'FROM DUAL', 'text');
    const errorRow = hits.find(h => h.error);
    assert.ok(errorRow, 'expected an error row for the malformed file');
    assert.ok(errorRow.file.endsWith('broken.ktr'), 'error row must name the offending file');
    assert.match(errorRow.error, /Unclosed/);
    // the well-formed sibling file is still searched successfully
    assert.ok(hits.some(h => h.file.endsWith('ok.ktr') && !h.error));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('text search reports file, line, and containing element', () => {
  const hits = search(FX, 'DELETE FROM T', 'text');
  const hit = hits.find(h => h.file.endsWith('mini.kjb'));
  assert.ok(hit);
  assert.equal(hit.element, 'run sql');
  assert.equal(hit.elementType, 'SQL');
  assert.ok(hit.line > 0);
  assert.match(hit.excerpt, /DELETE FROM T/);
});

test('table search uses word boundaries', () => {
  // 'DUAL' should match in mini.ktr; 'DUA' should not (substring of DUAL)
  assert.ok(search(FX, 'DUAL', 'table').some(h => h.file.endsWith('mini.ktr')));
  assert.ok(!search(FX, 'DUA', 'table').some(h => h.file.endsWith('mini.ktr')));
});

test('connection, variable, and type searches', () => {
  assert.ok(search(FX, 'conn_a', 'connection').some(h => h.file.endsWith('mini.ktr')));
  assert.ok(search(FX, 'INPUT_DATE', 'variable').some(h => h.file.endsWith('mini.kjb')));
  const stepHits = search(FX, 'TableInput', 'step_type');
  assert.ok(stepHits.some(h => h.file.endsWith('mini.ktr')));
  assert.ok(stepHits.every(h => h.file.toLowerCase().endsWith('.ktr')));
  const entryHits = search(FX, 'SQL', 'entry_type');
  assert.ok(entryHits.every(h => h.file.toLowerCase().endsWith('.kjb')));
});

test('step_type search matches only the element\'s own <type>, not a nested field type', () => {
  // etl_trans_ias_tableau_adm_users.ktr (and several sibling fixtures) has
  // many <type>String</type> field-type children inside TableInput/Text
  // File Output <fields> blocks, alongside 3 steps total. A field type must
  // never surface as a step_type hit.
  const fieldTypeHits = search(FX, 'String', 'step_type');
  assert.deepEqual(fieldTypeHits, []);
  // A real step type must still be found.
  const realHits = search(FX, 'TableInput', 'step_type');
  assert.ok(realHits.length > 0);
  assert.ok(realHits.every(h => h.elementType === 'TableInput'));
});

test('directory parameter narrows the scope', () => {
  const hits = search(FX, 'SPECIAL', 'entry_type', path.join(FX, 'bcqt_kpcs'));
  assert.ok(hits.length > 0);
  assert.ok(hits.every(h => h.file.includes('bcqt_kpcs')));
});

test('excerpt windows around a match beyond the first 200 characters', () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kettle-search-'));
  try {
    const padding = 'X'.repeat(250);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info>
    <name>longline</name>
    <parameters>
    </parameters>
  </info>
  <order>
  </order>
  <step>
    <name>run sql</name>
    <type>SQL</type>
    <sql>${padding}DELETE FROM T</sql>
  </step>
</transformation>
`;
    writeFileSync(path.join(tmpDir, 'long.ktr'), xml, 'utf8');

    const hits = search(tmpDir, 'DELETE FROM T', 'text');
    const hit = hits.find(h => h.file.endsWith('long.ktr'));
    assert.ok(hit);
    assert.match(hit.excerpt, /DELETE FROM T/);
    assert.ok(hit.excerpt.length <= 200);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  parseCatalog, loadCatalog, listTypes, findByXmlType,
  knownXmlTypes, isGeneratorEligible, getReference, knowledgeDir, _resetCache,
} from '../src/knowledge/loader.js';
import { checkCatalogTypes } from '../src/knowledge/catalog-check.js';
import { loadModel } from '../src/core/model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);

test('parseCatalog reads scalars, policy, and component flow-maps', () => {
  const text = [
    'version: 1',
    'pdi_version: "11"',
    'policy:',
    '  generator_requires_status: canonical',
    '  generator_requires_eligible: true',
    'components:',
    '  job:',
    '    - {type: START, xml_type: SPECIAL, file: job/START.md, status: canonical, generator_eligible: true}',
    '  transformation:',
    '    - {type: TABLE_INPUT, xml_type: TableInput, file: trans/TableInput.md, status: canonical, generator_eligible: true}',
    '    - {type: FILTER_ROWS, xml_type: FilterRows, file: trans/FilterRows.md, status: observed, generator_eligible: false}',
  ].join('\n');
  const c = parseCatalog(text);
  assert.equal(c.version, 1);
  assert.equal(c.pdi_version, '11');
  assert.equal(c.policy.generator_requires_status, 'canonical');
  assert.equal(c.policy.generator_requires_eligible, true);
  assert.equal(c.components.job.length, 1);
  assert.equal(c.components.job[0].xml_type, 'SPECIAL');
  assert.equal(c.components.transformation[1].generator_eligible, false);
});

test('embedded catalog loads and exposes the expected shape', () => {
  const c = loadCatalog();
  assert.ok(c.components.job.length > 0);
  assert.ok(c.components.transformation.length > 0);
  assert.ok(listTypes('job').length > 0);
  assert.ok(listTypes('trans').length > 0);
  assert.ok(knowledgeDir().length > 0);
});

test('findByXmlType matches on xml_type and design alias', () => {
  assert.equal(findByXmlType('trans', 'TableInput')?.type, 'TABLE_INPUT');
  assert.equal(findByXmlType('trans', 'TABLE_INPUT')?.xml_type, 'TableInput');
  assert.equal(findByXmlType('trans', 'NoSuchType'), null);
});

test('isGeneratorEligible follows catalog policy', () => {
  assert.equal(isGeneratorEligible('trans', 'TableInput'), true);                // canonical + eligible
  assert.equal(isGeneratorEligible('trans', 'SetSessionVariableStep'), false);   // observed, not eligible
  assert.equal(isGeneratorEligible('trans', 'NoSuchType'), false);               // unknown
});

test('knownXmlTypes and getReference resolve embedded files', () => {
  assert.ok(knownXmlTypes('trans').has('TableOutput'));
  const ref = getReference('trans', 'TableInput');
  assert.equal(ref.file, 'trans/TableInput.md');
  assert.ok(ref.content.length > 0);
});

test('checkCatalogTypes: clean fixture has no unknown-type warnings', () => {
  // mini.ktr uses TableInput/TableOutput — both canonical in the catalog.
  const issues = checkCatalogTypes(loadModel(fx('mini.ktr')));
  const unknown = issues.filter(i => /not found in the knowledge catalog/.test(i.message));
  assert.deepEqual(unknown, []);
});

test('checkCatalogTypes flags an unknown type as a warning, never an error', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-kb-'));
  try {
    const f = path.join(tmp, 'x.ktr');
    writeFileSync(f, [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<transformation><info><name>x</name></info>',
      '  <step><name>weird</name><type>TotallyMadeUpStep</type></step>',
      '  <order/>',
      '</transformation>',
    ].join('\n'));
    const issues = checkCatalogTypes(loadModel(f));
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(issues[0].message, /TotallyMadeUpStep/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('KETTLE_KNOWLEDGE_DIR override is honored', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-kbdir-'));
  const prev = process.env.KETTLE_KNOWLEDGE_DIR;
  try {
    mkdirSync(path.join(tmp, 'trans'), { recursive: true });
    writeFileSync(path.join(tmp, 'catalog.yaml'), [
      'version: 9',
      'policy:',
      '  generator_requires_status: canonical',
      '  generator_requires_eligible: true',
      'components:',
      '  transformation:',
      '    - {type: CUSTOM, xml_type: CustomStep, file: trans/CustomStep.md, status: canonical, generator_eligible: true}',
    ].join('\n'));
    writeFileSync(path.join(tmp, 'trans', 'CustomStep.md'), '# CustomStep\n');
    process.env.KETTLE_KNOWLEDGE_DIR = tmp;
    _resetCache();
    assert.equal(loadCatalog().version, 9);
    assert.ok(knownXmlTypes('trans').has('CustomStep'));
    assert.equal(getReference('trans', 'CustomStep').content.trim(), '# CustomStep');
  } finally {
    if (prev === undefined) delete process.env.KETTLE_KNOWLEDGE_DIR;
    else process.env.KETTLE_KNOWLEDGE_DIR = prev;
    _resetCache();
    rmSync(tmp, { recursive: true, force: true });
  }
});

// --- Catalog integrity + evidence-backed observed types ---------------------

import { XMLValidator } from 'fast-xml-parser';

// Types added from evidence and later promoted to canonical against PDI 9.4
// source (see the knowledge-from-source tracker). They must all be present and
// resolve to a reference file; those with a verified source are canonical +
// generator-eligible.
const EVIDENCE_BACKED_TYPES = {
  trans: [
    'BlockUntilStepsFinish', 'CsvInput', 'PropertyInput', 'StringCut', 'RandomValue',
    'ProcessFiles', 'DataGrid', 'JobExecutor', 'XMLOutput', 'OraBulkLoader',
    'TypeExitExcelWriterStep', 'Sequence',
  ],
  job: [
    'EVAL_FILES_METRICS', 'CHECK_DB_CONNECTIONS', 'FILES_EXIST', 'DELETE_FOLDERS',
    'DELETE_FILES', 'DELAY', 'XSLT', 'EXPORT_REPOSITORY',
  ],
};

// Types documented but still observed because their PDI source could not be
// located, so they must stay non-generator-eligible.
const STILL_OBSERVED_TYPES = {
  trans: ['SetSessionVariableStep'],
  job: [],
};

function firstFencedXml(content) {
  const m = /```xml\r?\n([\s\S]*?)```/.exec(content);
  return m ? m[1].trim() : null;
}

// PDI reuses xml_type "SPECIAL" for several job entries (START/FAILURE/...),
// so xml_type is not unique among jobs by design. Aliases must still be unique.
const SHARED_XML_TYPES = new Set(['SPECIAL']);

function rootTagOf(block) {
  const m = /^\s*(?:<\?[^>]*\?>\s*)?<([A-Za-z_][\w:.-]*)(?:\s|>|\/)/.exec(block);
  return m ? m[1] : null;
}

test('catalog aliases are unique and xml types collide only on known shared types', () => {
  for (const kind of ['job', 'trans']) {
    const aliases = new Set();
    const xmlTypes = new Set();
    for (const entry of listTypes(kind)) {
      assert.ok(!aliases.has(entry.type), `duplicate alias ${entry.type} in ${kind}`);
      aliases.add(entry.type);
      if (!SHARED_XML_TYPES.has(entry.xml_type)) {
        assert.ok(!xmlTypes.has(entry.xml_type), `duplicate xml_type ${entry.xml_type} in ${kind}`);
        xmlTypes.add(entry.xml_type);
      }
    }
  }
});

test('every catalog reference resolves and its first XML block is one valid step/entry root', () => {
  for (const kind of ['job', 'trans']) {
    const rootTag = kind === 'job' ? 'entry' : 'step';
    for (const entry of listTypes(kind)) {
      const ref = getReference(kind, entry.xml_type); // throws if file missing
      const block = firstFencedXml(ref.content);
      assert.ok(block, `${ref.file}: no fenced xml block`);
      assert.equal(XMLValidator.validate(block), true, `${ref.file}: XML does not parse`);
      assert.equal(rootTagOf(block), rootTag, `${ref.file}: root should be <${rootTag}>`);
    }
  }
});

test('evidence-backed types are present, canonical, and generator-eligible', () => {
  for (const kind of ['job', 'trans']) {
    for (const xmlType of EVIDENCE_BACKED_TYPES[kind]) {
      const entry = findByXmlType(kind, xmlType);
      assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
      assert.equal(entry.status, 'canonical', `${xmlType} should be canonical`);
      assert.equal(entry.generator_eligible, true, `${xmlType} must be generator-eligible`);
      assert.equal(isGeneratorEligible(kind, xmlType), true, `${xmlType} eligibility`);
    }
  }
});

test('types without a located source stay observed and not generator-eligible', () => {
  for (const kind of ['job', 'trans']) {
    for (const xmlType of STILL_OBSERVED_TYPES[kind]) {
      const entry = findByXmlType(kind, xmlType);
      assert.ok(entry, `${kind} type ${xmlType} missing from catalog`);
      assert.equal(entry.status, 'observed', `${xmlType} should be observed`);
      assert.equal(entry.generator_eligible, false, `${xmlType} must not be generator-eligible`);
      assert.equal(isGeneratorEligible(kind, xmlType), false, `${xmlType} eligibility`);
    }
  }
});

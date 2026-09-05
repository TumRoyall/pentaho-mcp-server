import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeKnowledgeXml } from '../src/core/knowledge-intake.js';
import { knowledgeTools } from '../src/tools/knowledge.tools.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const knowledgeRoot = path.join(here, '..', 'src', 'knowledge', 'pentaho');

function snapshotTree(root) {
  const snapshot = {};
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath ?? entry.path, entry.name);
    snapshot[path.relative(root, file)] = {
      content: readFileSync(file, 'utf8'),
      mtimeMs: statSync(file).mtimeMs,
    };
  }
  return snapshot;
}

test('analyzes a component block without altering its XML and flags unsafe values', () => {
  // SetSessionVariableStep is a known-but-observed catalog type, so it drives
  // the alreadyKnown/observed branch without relying on a type that may later
  // be promoted to canonical.
  const xml = '<step><name>Set session</name><type>SetSessionVariableStep</type><connection>warehouse</connection><filename>C:\\drop\\x.csv</filename><password>secret</password><endpoint>https://etl.example.test/load</endpoint><host>10.20.30.40:8080</host></step>';

  const report = analyzeKnowledgeXml({
    kind: 'trans',
    xml,
    sourceArtifact: 'samples/set-session.ktr',
    pdiVersion: '9.4',
    verification: 'spoon_loaded',
  });

  assert.deepEqual(report.candidate, {
    kind: 'trans',
    name: 'Set session',
    xmlType: 'SetSessionVariableStep',
    suggestedAlias: 'SET_SESSION_VARIABLE_STEP',
    status: 'observed',
    generatorEligible: false,
    alreadyKnown: true,
    xml,
    templateXml: xml,
  });
  assert.deepEqual(report.provenance, {
    sourceArtifact: 'samples/set-session.ktr',
    pdiVersion: '9.4',
    plugin: null,
    verification: 'spoon_loaded',
  });
  assert.equal(report.requiresElementName, false);
  assert.deepEqual(report.missingInformation, []);
  assert.ok(report.findings.some(x => x.code === 'ABSOLUTE_PATH' && x.tag === 'filename'));
  assert.ok(report.findings.some(x => x.code === 'URL_VALUE' && x.tag === 'endpoint'));
  assert.ok(report.findings.some(x => x.code === 'IPV4_VALUE' && x.tag === 'host'));
  assert.ok(report.findings.some(x => x.code === 'UNRESOLVED_CONNECTION_REFERENCE' && x.value === 'warehouse'));
  const secret = report.findings.find(x => x.code === 'POSSIBLE_SECRET');
  assert.equal(secret.tag, 'password');
  assert.equal(secret.value, '***');
  assert.doesNotMatch(JSON.stringify(secret), /secret/);
});

test('selects the sole unknown type from a complete transformation and preserves original bytes', () => {
  const target = [
    '  <step>',
    '    <type>NovelWidget</type>',
    '    <name>Novel &amp; exact</name>',
    '    <custom>B</custom>',
    '    <custom>A</custom>',
    '  </step>',
  ].join('\n');
  const xml = [
    '<transformation>',
    '  <info><name>intake</name></info>',
    '  <step><name>Known</name><type>TableInput</type></step>',
    target,
    '  <order/>',
    '</transformation>',
  ].join('\n');

  const report = analyzeKnowledgeXml({ kind: 'trans', xml, pdiVersion: '11', sourceArtifact: 'flows/intake.ktr' });

  assert.equal(report.candidate.name, 'Novel & exact');
  assert.equal(report.candidate.xmlType, 'NovelWidget');
  assert.equal(report.candidate.xml, target.trimStart());
  assert.equal(report.requiresElementName, false);
});

test('returns candidate names when a complete artifact has multiple unknown types', () => {
  const xml = '<transformation><info><name>x</name></info><step><name>First</name><type>UnknownOne</type></step><step><name>Second</name><type>UnknownTwo</type></step><order/></transformation>';

  const report = analyzeKnowledgeXml({ kind: 'trans', xml });

  assert.equal(report.candidate, null);
  assert.equal(report.requiresElementName, true);
  assert.deepEqual(report.candidateNames, ['First', 'Second']);
  assert.deepEqual(report.missingInformation.map(x => x.code), ['PDI_VERSION', 'PROVENANCE']);
});

test('elementName resolves an ambiguous artifact to the exact requested component', () => {
  const selected = '<step><name>Second</name><type>UnknownTwo</type><flag>Y</flag></step>';
  const xml = `<transformation><info><name>x</name></info><step><name>First</name><type>UnknownOne</type></step>${selected}<order/></transformation>`;

  const report = analyzeKnowledgeXml({ kind: 'trans', xml, elementName: 'Second' });

  assert.equal(report.candidate.name, 'Second');
  assert.equal(report.candidate.xmlType, 'UnknownTwo');
  assert.equal(report.candidate.xml, selected);
});

test('rejects root and kind mismatches', () => {
  assert.throws(
    () => analyzeKnowledgeXml({ kind: 'trans', xml: '<entry><name>x</name><type>SHELL</type></entry>' }),
    /Expected <step>/,
  );
  assert.throws(
    () => analyzeKnowledgeXml({ kind: 'job', xml: '<transformation><info><name>x</name></info><order/></transformation>' }),
    /Expected <job> root/,
  );
});

test('validates kind, verification, XML, name, type, and selected element name', () => {
  assert.throws(() => analyzeKnowledgeXml({ kind: 'flow', xml: '<step/>' }), /kind/);
  assert.throws(() => analyzeKnowledgeXml({ kind: 'trans', xml: '<step/>', verification: 'trusted' }), /verification/);
  assert.throws(() => analyzeKnowledgeXml({ kind: 'trans', xml: '<step>' }), /Invalid XML/);
  assert.throws(() => analyzeKnowledgeXml({ kind: 'trans', xml: '<step><type>X</type></step>' }), /non-empty <name>/);
  assert.throws(() => analyzeKnowledgeXml({ kind: 'trans', xml: '<step><name>x</name></step>' }), /non-empty <type>/);
  assert.throws(
    () => analyzeKnowledgeXml({
      kind: 'trans',
      elementName: 'Missing',
      xml: '<transformation><info><name>x</name></info><step><name>Present</name><type>Unknown</type></step><order/></transformation>',
    }),
    /No step named "Missing"/,
  );
});

test('reports known status and deterministic missing metadata without mutating knowledge', () => {
  const before = snapshotTree(knowledgeRoot);

  const known = analyzeKnowledgeXml({
    kind: 'trans',
    xml: '<step><name>Input</name><type>TableInput</type></step>',
    sourceArtifact: 'known.ktr',
    pdiVersion: '11',
  });
  const plugin = analyzeKnowledgeXml({
    kind: 'trans',
    xml: '<step><name>Plugin step</name><type>com.acme.CustomStep</type></step>',
  });

  assert.equal(known.candidate.alreadyKnown, true);
  assert.equal(known.candidate.status, 'canonical');
  assert.equal(known.candidate.generatorEligible, true);
  assert.deepEqual(plugin.missingInformation.map(x => x.code), ['PDI_VERSION', 'PLUGIN', 'PROVENANCE']);
  assert.deepEqual(snapshotTree(knowledgeRoot), before);
});

test('registers the read-only analyzer MCP tool with constrained enums', () => {
  const tool = knowledgeTools().find(x => x.name === 'kettle_knowledge_analyze_xml');

  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, ['kind', 'xml']);
  assert.deepEqual(tool.inputSchema.properties.kind.enum, ['job', 'trans']);
  assert.deepEqual(tool.inputSchema.properties.verification.enum, ['unverified', 'spoon_loaded', 'runtime_passed']);
  assert.equal(tool.handler({
    kind: 'job',
    xml: '<entry><name>Wait</name><type>BlockUntilStepsFinish</type></entry>',
  }).candidate.xmlType, 'BlockUntilStepsFinish');
});

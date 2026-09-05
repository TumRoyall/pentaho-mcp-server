import { XMLValidator } from 'fast-xml-parser';

import { findByXmlType, isGeneratorEligible } from '../knowledge/loader.js';
import { parseModel } from './model.js';
import { findAllSpans, innerText, unescapeXml } from './span.js';

const KINDS = new Set(['job', 'trans']);
const VERIFICATIONS = new Set(['unverified', 'spoon_loaded', 'runtime_passed']);
const ROOTS = {
  job: { artifact: 'job', component: 'entry', extension: '.kjb' },
  trans: { artifact: 'transformation', component: 'step', extension: '.ktr' },
};

const SENSITIVE_TAGS = /^(password|passwd|token|secret|apikey|api_key)$/i;
const ABSOLUTE_WINDOWS_PATH = /^[A-Za-z]:[\\/]/;
const ABSOLUTE_UNC_PATH = /^\\\\/;
const URL_VALUE = /^https?:\/\//i;
const IPV4_VALUE = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/;
const STEP_REFERENCE_TAGS = new Set([
  'step1',
  'step2',
  'send_true_to',
  'send_false_to',
  'default_target_step',
  'target_step',
  'source_step',
  'execution_result_target_step',
  'result_rows_target_step',
  'result_files_target_step',
  'executors_output_step',
]);

function rootTag(xml) {
  let rest = xml.replace(/^\uFEFF/, '').trimStart();
  while (rest.startsWith('<?') || rest.startsWith('<!--')) {
    const close = rest.startsWith('<?') ? '?>' : '-->';
    const end = rest.indexOf(close);
    if (end === -1) break;
    rest = rest.slice(end + close.length).trimStart();
  }
  return /^<([A-Za-z_][\w:.-]*)(?:\s|>|\/)/.exec(rest)?.[1] ?? null;
}

function requiredText(xml, span, tag, componentTag) {
  const raw = innerText(xml, span, tag);
  const value = raw == null ? '' : unescapeXml(raw).trim();
  if (!value) throw new Error(`Expected a non-empty <${tag}> in <${componentTag}>`);
  return value;
}

function elementsFrom(xml, componentTag) {
  return findAllSpans(xml, componentTag).map(span => ({
    span,
    name: requiredText(xml, span, 'name', componentTag),
    xmlType: requiredText(xml, span, 'type', componentTag),
  }));
}

function suggestedAlias(xmlType) {
  return xmlType
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function isNonCoreLooking(xmlType) {
  return /[.:/\\]/.test(xmlType);
}

function missingInformation({ pdiVersion, plugin, sourceArtifact }, xmlType) {
  const missing = [];
  if (!pdiVersion?.trim()) {
    missing.push({ code: 'PDI_VERSION', message: 'Provide the exact source PDI version.' });
  }
  if (isNonCoreLooking(xmlType) && !plugin?.trim()) {
    missing.push({ code: 'PLUGIN', message: 'Provide the plugin name and version for this component.' });
  }
  if (!sourceArtifact?.trim()) {
    missing.push({ code: 'PROVENANCE', message: 'Provide the repository-relative source artifact.' });
  }
  return missing;
}

function leafValues(xml) {
  const values = [];
  const pattern = /<([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>([^<]*)<\/\1\s*>/g;
  for (const match of xml.matchAll(pattern)) {
    values.push({ tag: match[1], value: unescapeXml(match[2]).trim() });
  }
  return values;
}

function valueFindings(componentXml) {
  const findings = [];
  for (const { tag, value } of leafValues(componentXml)) {
    if (!value) continue;
    if (SENSITIVE_TAGS.test(tag)) {
      findings.push({
        code: 'POSSIBLE_SECRET',
        tag,
        value: '***',
        message: `Replace the value in <${tag}> with a variable before sharing this template.`,
      });
      continue;
    }
    if (ABSOLUTE_WINDOWS_PATH.test(value) || ABSOLUTE_UNC_PATH.test(value)) {
      findings.push({
        code: 'ABSOLUTE_PATH',
        tag,
        value,
        message: `Replace the machine-specific path in <${tag}> with a variable.`,
      });
    }
    if (URL_VALUE.test(value)) {
      findings.push({
        code: 'URL_VALUE',
        tag,
        value,
        message: `Review the URL in <${tag}> and replace environment-specific values with variables.`,
      });
    }
    if (IPV4_VALUE.test(value)) {
      findings.push({
        code: 'IPV4_VALUE',
        tag,
        value,
        message: `Replace the host/IP value in <${tag}> with a variable.`,
      });
    }
  }
  return findings;
}

function referenceFindings(componentXml, model, kind) {
  if (!model) return [];
  const findings = [];
  const names = new Set(model.elements.map(element => element.name));
  const connections = new Set(model.connections);
  for (const { tag, value } of leafValues(componentXml)) {
    if (!value) continue;
    if (kind === 'trans' && STEP_REFERENCE_TAGS.has(tag) && !names.has(value)) {
      findings.push({
        code: 'UNRESOLVED_STEP_REFERENCE',
        tag,
        value,
        message: `The referenced step "${value}" is not present in the supplied transformation.`,
      });
    }
    if (tag === 'connection' && !connections.has(value)) {
      findings.push({
        code: 'UNRESOLVED_CONNECTION_REFERENCE',
        tag,
        value,
        message: `The connection "${value}" is not present in the supplied artifact.`,
      });
    }
  }
  return findings;
}

function ambiguityReport(elements, metadata) {
  return {
    candidate: null,
    requiresElementName: true,
    candidateNames: elements.map(element => element.name),
    provenance: metadata,
    findings: [],
    missingInformation: missingInformation(metadata, ''),
  };
}

function parseComponentModel(kind, componentXml) {
  if (kind === 'job') {
    return parseModel(
      `<job><name>knowledge-intake</name><entries>${componentXml}</entries><hops/></job>`,
      'intake.kjb',
    );
  }
  return parseModel(
    `<transformation><info><name>knowledge-intake</name></info><order/>${componentXml}</transformation>`,
    'intake.ktr',
  );
}

function candidateReport({ kind, selected, xml, model, metadata }) {
  const entry = findByXmlType(kind, selected.xmlType);
  const componentXml = xml.slice(selected.span.start, selected.span.end);
  return {
    candidate: {
      kind,
      name: selected.name,
      xmlType: selected.xmlType,
      suggestedAlias: suggestedAlias(selected.xmlType),
      status: entry?.status ?? 'observed',
      generatorEligible: entry ? isGeneratorEligible(kind, selected.xmlType) : false,
      alreadyKnown: entry != null,
      xml: componentXml,
      templateXml: componentXml,
    },
    requiresElementName: false,
    candidateNames: [selected.name],
    provenance: metadata,
    findings: [
      ...valueFindings(componentXml),
      ...referenceFindings(componentXml, model, kind),
    ],
    missingInformation: missingInformation(metadata, selected.xmlType),
  };
}

/** Analyze supplied Kettle XML as a catalog candidate without writing any files. */
export function analyzeKnowledgeXml({
  kind,
  xml,
  elementName,
  sourceArtifact,
  pdiVersion,
  plugin,
  verification = 'unverified',
}) {
  if (!KINDS.has(kind)) throw new Error('kind must be "job" or "trans"');
  if (!VERIFICATIONS.has(verification)) {
    throw new Error('verification must be "unverified", "spoon_loaded", or "runtime_passed"');
  }
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('xml must be a non-empty string');

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const detail = validation?.err?.msg ? `: ${validation.err.msg}` : '';
    throw new Error(`Invalid XML${detail}`);
  }

  const expected = ROOTS[kind];
  const root = rootTag(xml);
  if (root !== expected.artifact && root !== expected.component) {
    if (root === 'step' || root === 'entry') {
      throw new Error(`Expected <${expected.component}> component for kind "${kind}"`);
    }
    throw new Error(`Expected <${expected.artifact}> root or <${expected.component}> component for kind "${kind}"`);
  }

  const metadata = {
    sourceArtifact: sourceArtifact?.trim() || null,
    pdiVersion: pdiVersion?.trim() || null,
    plugin: plugin?.trim() || null,
    verification,
  };

  if (root === expected.component) {
    const elements = elementsFrom(xml, expected.component);
    if (elements.length !== 1) throw new Error(`Expected exactly one <${expected.component}> component`);
    const model = parseComponentModel(kind, xml);
    return candidateReport({ kind, selected: elements[0], xml, model, metadata });
  }

  const model = parseModel(xml, `intake${expected.extension}`);
  const elements = elementsFrom(xml, expected.component);
  if (elementName != null) {
    const matches = elements.filter(element => element.name === elementName);
    if (matches.length === 0) throw new Error(`No ${expected.component} named "${elementName}"`);
    if (matches.length > 1) throw new Error(`Multiple ${expected.component} elements named "${elementName}"`);
    return candidateReport({ kind, selected: matches[0], xml, model, metadata });
  }

  const unknown = elements.filter(element => !findByXmlType(kind, element.xmlType));
  if (unknown.length === 1) {
    return candidateReport({ kind, selected: unknown[0], xml, model, metadata });
  }
  return ambiguityReport(unknown.length > 0 ? unknown : elements, metadata);
}

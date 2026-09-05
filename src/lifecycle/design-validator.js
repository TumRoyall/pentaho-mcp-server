import { loadDesignPackage } from './design-loader.js';
import { findByXmlType, isGeneratorEligible } from '../knowledge/loader.js';
import { areDesignDiagramsCurrent } from './diagram-renderer.js';

function finding(code, detail, location) { return { code, detail, location }; }
const list = value => Array.isArray(value) ? value : value == null ? [] : [value];

function knownGaps(manifest) {
  const gaps = new Set();
  for (const decision of list(manifest.technical_decisions)) {
    if (decision?.known_gap === true) for (const type of list(decision.gap_types)) gaps.add(String(type).toLowerCase());
  }
  return gaps;
}

function validateGraph(component, elementsKey, hopsKey, errors) {
  const elements = list(component[elementsKey]);
  const ids = new Set();
  for (const element of elements) {
    if (!element?.id || ids.has(element.id)) errors.push(finding('ID_INVALID', element?.id, component.id));
    ids.add(element?.id);
  }
  for (const hop of list(component[hopsKey])) {
    if (!ids.has(hop?.from) || !ids.has(hop?.to)) {
      errors.push(finding('DANGLING_HOP', `${hop?.from} -> ${hop?.to}`, component.id));
    }
  }
  return { elements, ids };
}

function scanSecrets(value, errors, trail = []) {
  if (Array.isArray(value)) return value.forEach((item, index) => scanSecrets(item, errors, [...trail, index]));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const next = [...trail, key];
    const isVariableDeclaration = trail.at(-1) === 'variables';
    if (/^(?:password|secret|token)$/i.test(key) && typeof child === 'string' && child && !/^\$\{[^}]+\}$/.test(child) && !isVariableDeclaration) {
      errors.push(finding('SECRET_VALUE', 'literal sensitive value', next.join('.')));
    }
    scanSecrets(child, errors, next);
  }
}

export function validateDesign(designDir, catalog = null) {
  const errors = [];
  const warnings = [];
  let pkg;
  try { pkg = loadDesignPackage(designDir); }
  catch (error) { return { ok: false, status: 'BLOCKED', errors: [finding('PACKAGE_INVALID', error.message)], warnings }; }
  const { manifest, jobs, transformations } = pkg;
  const designId = manifest.design?.id;
  const gaps = knownGaps(manifest);
  const componentIds = new Set([...jobs.keys(), ...transformations.keys()]);
  const lookup = (kind, type) => catalog?.find?.(kind, type) ?? findByXmlType(kind, type);
  const eligible = (kind, type) => catalog?.eligible?.(kind, type) ?? isGeneratorEligible(kind, type);

  const inspectType = (kind, type, location) => {
    if (!type) return errors.push(finding('TYPE_MISSING', '', location));
    if (/\{\{|<[A-Z][A-Z0-9_]{2,}>/.test(type)) return errors.push(finding('PLACEHOLDER_LEFT', type, location));
    const row = lookup(kind, type);
    if (!row) return errors.push(finding('CATALOG_GAP', type, location));
    if (!eligible(kind, type)) {
      const aliases = [type, row.type, row.xml_type].filter(Boolean).map(v => String(v).toLowerCase());
      if (aliases.some(alias => gaps.has(alias))) warnings.push(finding('KNOWN_GENERATION_GAP', type, location));
      else errors.push(finding('TYPE_NOT_GENERATABLE', type, location));
    }
  };

  for (const [declaredId, doc] of jobs) {
    const job = doc.job ?? {};
    if (doc.design_id !== designId || job.id !== declaredId) errors.push(finding('IDENTITY_MISMATCH', declaredId, 'job'));
    const { elements } = validateGraph(job, 'entries', 'hops', errors);
    for (const entry of elements) {
      inspectType('job', entry.pentaho_entry_type, `${declaredId}/${entry.id}`);
      if (!list(entry.requirement_refs).length) errors.push(finding('TRACEABILITY_MISSING', entry.id, declaredId));
      if (entry.component_ref && !componentIds.has(entry.component_ref)) errors.push(finding('COMPONENT_REF_MISSING', entry.component_ref, entry.id));
    }
  }
  for (const [declaredId, doc] of transformations) {
    const trans = doc.transformation ?? {};
    if (doc.design_id !== designId || trans.id !== declaredId) errors.push(finding('IDENTITY_MISMATCH', declaredId, 'transformation'));
    const { elements } = validateGraph(trans, 'steps', 'hops', errors);
    const inputs = new Set(list(trans.inputs).map(row => row.id));
    const outputs = new Set(list(trans.outputs).map(row => row.id));
    for (const step of elements) {
      inspectType('trans', step.pentaho_step_type, `${declaredId}/${step.id}`);
      if (!list(step.requirement_refs).length) errors.push(finding('TRACEABILITY_MISSING', step.id, declaredId));
      for (const id of list(step.reads_inputs)) if (!inputs.has(id)) errors.push(finding('INPUT_REF_MISSING', id, step.id));
      for (const id of list(step.writes_outputs)) if (!outputs.has(id)) errors.push(finding('OUTPUT_REF_MISSING', id, step.id));
    }
    for (const hop of list(trans.error_hops)) {
      const ids = new Set(elements.map(row => row.id));
      if (!ids.has(hop?.from) || !ids.has(hop?.to)) errors.push(finding('DANGLING_ERROR_HOP', `${hop?.from} -> ${hop?.to}`, declaredId));
    }
  }

  const serialized = JSON.stringify({ manifest, jobs: [...jobs.values()], transformations: [...transformations.values()] });
  for (const token of serialized.match(/\{\{[^{}]*\}\}|<[A-Z][A-Z0-9_]{2,}>/g) ?? []) errors.push(finding('PLACEHOLDER_LEFT', token));
  scanSecrets({ manifest, jobs: [...jobs.values()], transformations: [...transformations.values()] }, errors);
  try {
    if (!areDesignDiagramsCurrent(designDir, pkg)) errors.push(finding('DIAGRAM_STALE', 'design.md diagrams do not match YAML'));
  } catch (error) {
    errors.push(finding('DIAGRAM_INVALID', error.message));
  }

  return { ok: errors.length === 0, status: errors.length ? 'BLOCKED' : 'READY', package: pkg, errors, warnings };
}

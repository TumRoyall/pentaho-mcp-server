import path from 'node:path';
import { text } from '../core/model.js';

const normalized = value => String(value ?? '').replace(/\r\n?/g, '\n').trim();
const enabled = value => value === true || String(value).toUpperCase() === 'Y';

function artifactIndex(pkg) {
  return new Map([
    ...(pkg.manifest.components?.jobs ?? []).filter(row => row.artifact_name).map(row => [path.basename(row.artifact_name), row.id]),
    ...(pkg.manifest.components?.transformations ?? []).filter(row => row.artifact_name).map(row => [path.basename(row.artifact_name), row.id]),
  ]);
}

function delta(componentId, elementId, pathName, oldValue, newValue, classification = 'TECHNICAL', kind = 'configuration') {
  return { componentId, elementId, path: pathName, kind, oldValue, newValue, classification };
}

export function diffRuntimeDesign(pkg, artifactModels) {
  const results = [];
  const byArtifact = artifactIndex(pkg);
  for (const model of artifactModels) {
    const componentId = byArtifact.get(path.basename(model.path ?? '')) ?? model.name;
    const doc = model.kind === 'job' ? pkg.jobs.get(componentId) : pkg.transformations.get(componentId);
    const component = model.kind === 'job' ? doc?.job : doc?.transformation;
    if (!component) continue;
    const designElements = model.kind === 'job' ? component.entries ?? [] : component.steps ?? [];
    const byName = new Map(designElements.map(element => [element.display_name, element]));
    for (const runtime of model.elements ?? []) {
      const design = byName.get(runtime.name);
      if (!design) {
        results.push(delta(componentId, null, `elements.${runtime.name}`, null, runtime.type, 'TECHNICAL', 'element-added'));
        continue;
      }
      const field = model.kind === 'job' ? 'pentaho_entry_type' : 'pentaho_step_type';
      if (normalized(design[field]) !== normalized(runtime.type)) results.push(delta(componentId, design.id, `${model.kind === 'job' ? 'entries' : 'steps'}.${design.id}.${field}`, design[field], runtime.type, 'TECHNICAL', 'type'));
      if (model.kind === 'trans') {
        const oldConnection = design.configuration?.connection ?? '';
        const newConnection = text(runtime.raw?.connection);
        if (normalized(oldConnection) !== normalized(newConnection) && newConnection) results.push(delta(componentId, design.id, `steps.${design.id}.configuration.connection`, oldConnection, newConnection));
        if (/TableInput/i.test(runtime.type)) {
          const oldSql = design.configuration?.query_contract ?? '';
          const newSql = text(runtime.raw?.sql);
          if (normalized(oldSql) !== normalized(newSql)) results.push(delta(componentId, design.id, `steps.${design.id}.configuration.query_contract`, oldSql, newSql, 'BUSINESS_SEMANTIC', 'sql'));
        }
      }
    }
    const runtimeNames = new Set((model.elements ?? []).map(element => element.name));
    for (const design of designElements) if (!runtimeNames.has(design.display_name)) results.push(delta(componentId, design.id, `elements.${design.id}`, design.display_name, null, 'TECHNICAL', 'element-removed'));

    const names = new Map(designElements.map(element => [element.id, element.display_name]));
    const wanted = new Set((component.hops ?? []).map(hop => `${names.get(hop.from)}\0${names.get(hop.to)}\0${hop.enabled !== false}`));
    const actual = new Set((model.hops ?? []).map(hop => `${hop.from}\0${hop.to}\0${enabled(hop.enabled)}`));
    for (const hop of actual) if (!wanted.has(hop)) results.push(delta(componentId, null, `hops.${hop}`, null, hop, 'TECHNICAL', 'hop-added'));
    for (const hop of wanted) if (!actual.has(hop)) results.push(delta(componentId, null, `hops.${hop}`, hop, null, 'TECHNICAL', 'hop-removed'));
  }
  return results.sort((a, b) => `${a.componentId}/${a.path}`.localeCompare(`${b.componentId}/${b.path}`, 'en'));
}

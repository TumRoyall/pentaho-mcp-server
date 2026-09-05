import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalog = Object.freeze([
  ['developing-pentaho-jobs', 'Pentaho lifecycle orchestrator', 'Inspect, resume, document, design, generate, validate, and synchronize a Pentaho request.'],
  ['writing-etl-requirements', 'Writing ETL requirements', 'Turn BA Markdown evidence into a traceable requirement without inventing business facts.'],
  ['designing-pentaho-solutions', 'Designing Pentaho solutions', 'Produce a traceable, generator-compatible Pentaho design package.'],
  ['generating-pentaho-from-design', 'Generating Pentaho from design', 'Generate KJB/KTR and supporting artifacts from validated design.'],
  ['modifying-pentaho-jobs', 'Modifying Pentaho jobs', 'Patch existing Pentaho XML and synchronize design, docs, and changelog.'],
].map(([slug, name, description]) => Object.freeze({
  slug,
  uri: `dte-pentaho://skills/${slug}`,
  name,
  description,
  mimeType: 'text/markdown',
  file: fileURLToPath(new URL(`./${slug}.md`, import.meta.url)),
})));

export function lifecycleCatalog() {
  return catalog;
}

export function findLifecycleResource(uri) {
  return catalog.find(resource => resource.uri === uri);
}

export function loadLifecycleText(resource) {
  return readFileSync(resource.file, 'utf8');
}

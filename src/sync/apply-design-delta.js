import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { loadDesignPackage } from '../lifecycle/design-loader.js';
import { writeDesignDiagrams } from '../lifecycle/diagram-renderer.js';
import { writeArtifactSet } from '../lifecycle/artifact-write.js';
import { prependChange } from './changelog.js';

function componentFile(pkg, componentId) {
  const row = [...(pkg.manifest.components?.jobs ?? []), ...(pkg.manifest.components?.transformations ?? [])].find(item => item.id === componentId);
  if (!row) throw new Error(`Unknown design component: ${componentId}`);
  return path.join(pkg.designDir, row.spec);
}

function updateComponent(content, delta, isJob) {
  const doc = parseDocument(content, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors[0].message);
  const root = isJob ? 'job' : 'transformation';
  const listName = isJob ? 'entries' : 'steps';
  const rows = doc.getIn([root, listName])?.toJSON?.() ?? [];
  const index = rows.findIndex(row => row.id === delta.elementId);
  if (index < 0) throw new Error(`Cannot patch missing element ${delta.elementId}`);
  const suffix = delta.path.split('.').slice(2);
  doc.setIn([root, listName, index, ...suffix], delta.newValue);
  return String(doc);
}

export function applyDesignDelta(designDir, deltas, expectedHashes = {}) {
  const semantic = deltas.filter(delta => delta.classification === 'BUSINESS_SEMANTIC');
  if (semantic.length) return { status: 'USER_DECISION_REQUIRED', blockers: semantic };
  if (!deltas.length) return { status: 'UNCHANGED', files: [] };
  if (deltas.some(delta => !delta.elementId || delta.kind?.startsWith('hop') || delta.kind?.startsWith('element'))) {
    return { status: 'USER_DECISION_REQUIRED', blockers: deltas.filter(delta => !delta.elementId || delta.kind?.startsWith('hop') || delta.kind?.startsWith('element')) };
  }

  const pkg = loadDesignPackage(designDir);
  const modified = new Map();
  for (const delta of deltas) {
    const file = componentFile(pkg, delta.componentId);
    const content = modified.get(file) ?? readFileSync(file, 'utf8');
    modified.set(file, updateComponent(content, delta, pkg.jobs.has(delta.componentId)));
  }
  const manifestFile = path.join(designDir, 'manifest.yaml');
  const manifestDoc = parseDocument(readFileSync(manifestFile, 'utf8'), { uniqueKeys: true });
  const version = Number(manifestDoc.getIn(['design', 'version']) ?? 0) + 1;
  manifestDoc.setIn(['design', 'version'], version);
  modified.set(manifestFile, String(manifestDoc));

  const temp = mkdtempSync(path.join(os.tmpdir(), 'pentaho-sync-'));
  const staged = path.join(temp, 'design');
  try {
    cpSync(designDir, staged, { recursive: true });
    for (const [file, content] of modified) writeFileSync(path.join(staged, path.relative(designDir, file)), content, 'utf8');
    const designMdFile = path.join(staged, 'design.md');
    const designMd = readFileSync(designMdFile, 'utf8');
    const note = `\nRuntime synchronization applied for design version ${version}.\n`;
    writeFileSync(designMdFile, designMd.replace('<!-- BEGIN GENERATED DIAGRAMS -->', `${note}<!-- BEGIN GENERATED DIAGRAMS -->`), 'utf8');
    writeDesignDiagrams(staged);

    const writes = [...modified].map(([file]) => ({ path: file, content: readFileSync(path.join(staged, path.relative(designDir, file))) }));
    const designTarget = path.join(designDir, 'design.md');
    writes.push({ path: designTarget, content: readFileSync(designMdFile) });
    const changelog = path.join(path.dirname(designDir), 'changelog.md');
    const prior = existsSync(changelog) ? readFileSync(changelog, 'utf8') : '';
    writes.push({ path: changelog, content: prependChange(prior, deltas, version) });
    return { status: 'SYNCED', version, ...writeArtifactSet(writes, expectedHashes) };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

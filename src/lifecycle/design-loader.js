import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

function loadMapping(file) {
  if (!existsSync(file)) throw new Error(`Missing design file: ${file}`);
  const documents = YAML.parseAllDocuments(readFileSync(file, 'utf8'), { uniqueKeys: true });
  if (documents.length !== 1 || documents[0].errors.length) {
    throw new Error(`${path.basename(file)} must contain exactly one YAML mapping document`);
  }
  const value = documents[0].toJSON();
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${path.basename(file)} must contain exactly one YAML mapping document`);
  }
  return value;
}

function safeSpec(designDir, spec) {
  const root = path.resolve(designDir);
  const target = path.resolve(root, String(spec ?? ''));
  const relative = path.relative(root, target);
  if (!spec || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Component spec resolves outside design directory: ${spec}`);
  }
  return target;
}

export function loadDesignPackage(designDir) {
  const root = path.resolve(designDir);
  const manifest = loadMapping(path.join(root, 'manifest.yaml'));
  const jobs = new Map();
  const transformations = new Map();
  for (const row of manifest.components?.jobs ?? []) {
    if (!row?.id || jobs.has(row.id)) throw new Error(`Invalid or duplicate job declaration: ${row?.id}`);
    jobs.set(row.id, loadMapping(safeSpec(root, row.spec)));
  }
  for (const row of manifest.components?.transformations ?? []) {
    if (!row?.id || transformations.has(row.id)) throw new Error(`Invalid or duplicate transformation declaration: ${row?.id}`);
    transformations.set(row.id, loadMapping(safeSpec(root, row.spec)));
  }
  return { designDir: root, manifest, jobs, transformations };
}

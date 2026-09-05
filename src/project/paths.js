import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

function comparable(value) {
  const resolved = path.resolve(value);
  return process.platform === undefined || process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInside(root, target) {
  const base = comparable(root);
  const candidate = comparable(target);
  return candidate === base || candidate.startsWith(`${base}${path.sep}`);
}

function canonicalizeExistingPrefix(target) {
  const suffix = [];
  let current = path.resolve(target);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    suffix.unshift(path.basename(current));
    current = parent;
  }
  const real = existsSync(current) ? realpathSync(current) : current;
  return path.resolve(real, ...suffix);
}

function configuredRoots(config) {
  return [config.paths.requirements, config.paths.pentaho].filter(Boolean);
}

export function assertInsideRoots(config, targetPath, { write = false } = {}) {
  const target = canonicalizeExistingPrefix(targetPath);
  const roots = configuredRoots(config).map(canonicalizeExistingPrefix);
  if (!roots.some(root => isInside(root, target))) {
    throw new Error(`Path is outside configured project roots: ${targetPath}`);
  }

  if (write && isInside(config.paths.requirements, target)) {
    const rel = path.relative(config.paths.requirements, target);
    const parts = rel.split(path.sep).filter(Boolean).map(p => p.toLowerCase());
    if (parts.includes('input')) throw new Error(`BA input is read-only: ${targetPath}`);
  }
  return path.resolve(targetPath);
}

export function resolveProjectPath(config, key, ...segments) {
  const root = config.paths[key];
  if (!root) throw new Error(`Unknown project path key: ${key}`);
  const target = path.resolve(root, ...segments);
  if (!isInside(root, target)) throw new Error(`Path resolves outside configured ${key} root`);
  return target;
}


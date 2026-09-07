/**
 * Canonical workspace boundary for the MCP.
 *
 * A single shared policy that every read/edit/validate/coverage tool factory
 * uses to turn a caller-supplied path into an absolute, canonical, in-root
 * path — or to reject it. The root is resolved once (KETTLE_ROOT, else
 * process.cwd()) and canonicalized so symlink/junction escapes are rejected.
 *
 * `resolveRead` and `resolveWrite` share containment logic today but stay
 * separate so tool adapters keep their access intent explicit.
 */
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Canonicalize the deepest existing ancestor of `target` and re-append the
 * missing suffix. This makes a not-yet-created destination resolve through the
 * real path of its existing parents, so a junction/symlink parent that points
 * outside the root is caught by the containment check below.
 */
function canonicalizeExistingPrefix(target) {
  const suffix = [];
  let current = path.resolve(target);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    suffix.unshift(path.basename(current));
    current = parent;
  }
  const canonical = existsSync(current) ? realpathSync(current) : current;
  return path.resolve(canonical, ...suffix);
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function checkedInput(value) {
  if (value == null) return '.';
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Path must be a non-empty string');
  }
  return value;
}

export function createWorkspaceBoundary(rootInput) {
  if (typeof rootInput !== 'string' || rootInput.trim() === '') {
    throw new Error('KETTLE_ROOT must be a non-empty string');
  }
  const requestedRoot = path.resolve(rootInput);
  if (!existsSync(requestedRoot) || !statSync(requestedRoot).isDirectory()) {
    throw new Error(`KETTLE_ROOT must be an existing directory: ${rootInput}`);
  }
  const root = realpathSync(requestedRoot);
  const resolveInside = inputPath => {
    const input = checkedInput(inputPath);
    const requested = path.isAbsolute(input) ? path.resolve(input) : path.resolve(root, input);
    const target = canonicalizeExistingPrefix(requested);
    if (!isInside(root, target)) {
      throw new Error(`Path is outside KETTLE_ROOT (${root}): ${inputPath}`);
    }
    return target;
  };
  return { root, resolveRead: resolveInside, resolveWrite: resolveInside };
}

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';

const CONFIG_FILE = '.pentaho-mcp.yaml';
const ALLOWED_TOP_LEVEL = new Set(['schema_version', 'project', 'paths', 'environment', 'pentaho']);
const ALLOWED_PROJECT = new Set(['code']);
const ALLOWED_PATHS = new Set(['requirements', 'pentaho', 'ai_context']);
const ALLOWED_ENVIRONMENT = new Set(['name']);
const ALLOWED_PENTAHO = new Set(['home']);

function mapping(value, field) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be a YAML mapping`);
  }
  return value;
}

function rejectUnknown(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unknown ${field} key: ${key}`);
  }
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizedRoot(workspaceRoot) {
  const resolved = path.resolve(workspaceRoot);
  return existsSync(resolved) ? realpathSync(resolved) : resolved;
}

function projectRoot(workspaceRoot, value, field) {
  const relative = requiredString(value, field);
  if (path.isAbsolute(relative)) throw new Error(`${field} must be workspace-relative`);
  const target = path.resolve(workspaceRoot, relative);
  const rel = path.relative(workspaceRoot, target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`${field} resolves outside the workspace`);
  }
  return target;
}

export function loadProjectConfig(workspaceRoot) {
  const root = normalizedRoot(workspaceRoot);
  const file = path.join(root, CONFIG_FILE);
  if (!existsSync(file)) throw new Error(`Missing ${CONFIG_FILE} in workspace: ${root}`);

  const document = parseDocument(readFileSync(file, 'utf8'), { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(`Invalid ${CONFIG_FILE}: ${document.errors.map(e => e.message).join('; ')}`);
  }
  const raw = mapping(document.toJS(), CONFIG_FILE);
  rejectUnknown(raw, ALLOWED_TOP_LEVEL, 'top-level');
  if (raw.schema_version !== 1) throw new Error('schema_version must be 1');

  const project = mapping(raw.project, 'project');
  const paths = mapping(raw.paths, 'paths');
  const environment = mapping(raw.environment ?? {}, 'environment');
  const pentaho = mapping(raw.pentaho ?? {}, 'pentaho');
  rejectUnknown(project, ALLOWED_PROJECT, 'project');
  rejectUnknown(paths, ALLOWED_PATHS, 'paths');
  rejectUnknown(environment, ALLOWED_ENVIRONMENT, 'environment');
  rejectUnknown(pentaho, ALLOWED_PENTAHO, 'pentaho');

  const resolvedPaths = {
    requirements: projectRoot(root, paths.requirements, 'paths.requirements'),
    pentaho: projectRoot(root, paths.pentaho, 'paths.pentaho'),
  };
  if (paths.ai_context != null) {
    resolvedPaths.aiContext = projectRoot(root, paths.ai_context, 'paths.ai_context');
  }

  let pentahoHome = null;
  if (pentaho.home != null) {
    pentahoHome = requiredString(pentaho.home, 'pentaho.home');
    if (!path.isAbsolute(pentahoHome)) pentahoHome = path.resolve(root, pentahoHome);
  }

  return {
    workspaceRoot: root,
    file,
    schemaVersion: 1,
    projectCode: requiredString(project.code, 'project.code'),
    paths: resolvedPaths,
    environment: String(environment.name ?? 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN',
    pentahoHome,
  };
}


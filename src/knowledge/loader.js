/**
 * Knowledge base loader.
 *
 * The knowledge base is a directory of PDI XML references indexed by
 * `catalog.yaml`. It is EMBEDDED in the package (src/knowledge/pentaho) so the
 * server is self-contained: install the package and the knowledge ships with
 * it. The location can be overridden with KETTLE_KNOWLEDGE_DIR when several
 * checkouts should share one canonical knowledge tree.
 *
 * catalog.yaml uses a deliberately narrow YAML shape (top-level scalars, one
 * `policy:` block of scalar pairs, and `components.<kind>:` lists of inline
 * flow-maps). We parse exactly that shape so the package needs no YAML
 * dependency. If the catalog ever grows richer YAML, swap parseCatalog() for a
 * real parser — nothing else here depends on how it was parsed.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(HERE, 'pentaho');

/** Absolute path to the active knowledge directory (env override wins). */
export function knowledgeDir() {
  return process.env.KETTLE_KNOWLEDGE_DIR
    ? path.resolve(process.env.KETTLE_KNOWLEDGE_DIR)
    : DEFAULT_DIR;
}

function scalar(raw) {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  // Strip a single matching pair of surrounding quotes, if present.
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse one `{k: v, k: v}` inline flow-map into an object. */
function parseFlowMap(body) {
  const obj = {};
  for (const pair of body.split(',')) {
    const i = pair.indexOf(':');
    if (i === -1) continue;
    const key = pair.slice(0, i).trim();
    if (key) obj[key] = scalar(pair.slice(i + 1));
  }
  return obj;
}

/**
 * Minimal parser for the catalog's fixed shape. Returns
 * { version, pdi_version, policy, components: { job:[], transformation:[] } }.
 */
export function parseCatalog(text) {
  const out = { policy: {}, components: {} };
  const lines = text.split(/\r?\n/);
  let section = null;   // 'policy' | 'components'
  let kind = null;      // current component kind under `components:`

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0) {
      if (trimmed === 'policy:') { section = 'policy'; kind = null; continue; }
      if (trimmed === 'components:') { section = 'components'; kind = null; continue; }
      section = null; kind = null;
      const i = trimmed.indexOf(':');
      if (i !== -1) out[trimmed.slice(0, i).trim()] = scalar(trimmed.slice(i + 1));
      continue;
    }

    if (section === 'policy' && indent >= 2) {
      const i = trimmed.indexOf(':');
      if (i !== -1) out.policy[trimmed.slice(0, i).trim()] = scalar(trimmed.slice(i + 1));
      continue;
    }

    if (section === 'components') {
      // `job:` / `transformation:` header (indent 2), or a `- {..}` list item.
      if (!trimmed.startsWith('-') && trimmed.endsWith(':')) {
        kind = trimmed.slice(0, -1).trim();
        out.components[kind] = [];
        continue;
      }
      if (trimmed.startsWith('-') && kind) {
        const body = trimmed.replace(/^-\s*/, '').replace(/^\{/, '').replace(/\}$/, '');
        out.components[kind].push(parseFlowMap(body));
      }
    }
  }
  return out;
}

let _cache = null;

/** Load and cache the parsed catalog for the active knowledge directory. */
export function loadCatalog() {
  const dir = knowledgeDir();
  const file = path.join(dir, 'catalog.yaml');
  if (_cache && _cache.dir === dir) return _cache.catalog;
  if (!existsSync(file)) {
    throw new Error(`Knowledge catalog not found: ${file} (set KETTLE_KNOWLEDGE_DIR?)`);
  }
  const catalog = parseCatalog(readFileSync(file, 'utf8'));
  _cache = { dir, catalog };
  return catalog;
}

/** Clear the cache — used by tests that point the loader at a temp dir. */
export function _resetCache() {
  _cache = null;
}

const KIND_KEY = { job: 'job', trans: 'transformation' };

function componentList(kind) {
  const catalog = loadCatalog();
  const key = KIND_KEY[kind] ?? kind;
  return catalog.components[key] ?? [];
}

/** All catalog entries for a kind ('job' | 'trans'). */
export function listTypes(kind) {
  return componentList(kind).map(e => ({ ...e }));
}

/**
 * Look up a catalog entry by the Kettle XML `<type>` value (e.g. 'TableInput',
 * 'SPECIAL'). Matches on `xml_type` first, then the design-level `type` alias,
 * so callers can pass either. Returns null when unknown.
 */
export function findByXmlType(kind, xmlType) {
  const list = componentList(kind);
  return (
    list.find(e => e.xml_type === xmlType) ??
    list.find(e => e.type === xmlType) ??
    null
  );
}

/** Known XML type set for a kind — used by validation to flag unknown types. */
export function knownXmlTypes(kind) {
  return new Set(componentList(kind).map(e => e.xml_type).filter(Boolean));
}

/**
 * Parse an entry's `verified_versions` scalar into a clean list. The scalar is
 * a pipe-separated set of PDI versions for which target evidence exists (e.g.
 * "9.3|9.4"). Empty/missing means no target-version verification is recorded.
 */
export function verifiedVersions(entry) {
  return String(entry?.verified_versions ?? '')
    .split('|')
    .map(v => v.trim())
    .filter(Boolean);
}

/** True when a type is safe for automatic scaffolding (per catalog policy). */
export function isGeneratorEligible(kind, xmlType) {
  const entry = findByXmlType(kind, xmlType);
  if (!entry) return false;
  const policy = loadCatalog().policy ?? {};
  const needStatus = policy.generator_requires_status ?? 'canonical';
  const needEligible = policy.generator_requires_eligible !== false;
  if (needStatus && entry.status !== needStatus) return false;
  if (needEligible && entry.generator_eligible !== true) return false;
  // The catalog target must be explicitly verified for this entry; without
  // target-version evidence a row cannot be generator-eligible.
  const target = String(loadCatalog().pdi_version ?? '').trim();
  if (target && !verifiedVersions(entry).includes(target)) return false;
  return true;
}

/**
 * Read the reference markdown for a type (template XML, field tables, mapping).
 * Returns { entry, file, content } or throws with a clear message.
 */
export function getReference(kind, xmlType) {
  const entry = findByXmlType(kind, xmlType);
  if (!entry) throw new Error(`No knowledge entry for ${kind} type "${xmlType}"`);
  if (!entry.file) throw new Error(`Catalog entry for "${xmlType}" has no file`);
  const file = path.join(knowledgeDir(), entry.file);
  if (!existsSync(file)) throw new Error(`Reference file missing: ${entry.file}`);
  return { entry, file: entry.file, content: readFileSync(file, 'utf8') };
}

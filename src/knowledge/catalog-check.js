/**
 * Catalog-aware validation layer.
 *
 * core/validate.js checks structure that Kettle itself would reject at load or
 * run time (malformed XML, dangling hops, undefined connections, ...). This
 * layer adds a softer, knowledge-driven check: does every step/entry `<type>`
 * appear in the knowledge catalog, and is it a canonical (verified) type?
 *
 * It is kept OUT of core/ on purpose: core knows nothing about the knowledge
 * base, so it stays a pure XML/graph tool. The validate tool composes the two.
 *
 * Severities are intentionally never `error` here — an unknown type does not
 * necessarily break loading (it may be a valid PDI plugin the catalog simply
 * hasn't documented yet), so flagging it as `error` would produce false
 * failures. Unknown -> warning, observed-but-undocumented -> info.
 */
import { loadModel } from '../core/model.js';
import { knownXmlTypes, findByXmlType } from './loader.js';

/**
 * Return issue objects ({severity, message}) for a parsed model's element
 * types, measured against the catalog for its kind. Never throws for a missing
 * catalog entry; only a broken catalog file would throw (surfaced by caller).
 */
export function checkCatalogTypes(model) {
  const issues = [];
  const known = knownXmlTypes(model.kind);
  for (const el of model.elements) {
    const type = el.type;
    if (!type) continue;
    if (!known.has(type)) {
      issues.push({
        severity: 'warning',
        message: `Element "${el.name}" has type "${type}" not found in the knowledge catalog (${model.kind}). It may be a valid PDI type that is not yet documented, or a typo.`,
      });
      continue;
    }
    const entry = findByXmlType(model.kind, type);
    if (entry && entry.status !== 'canonical') {
      issues.push({
        severity: 'info',
        message: `Element "${el.name}" type "${type}" is documented but status="${entry.status}" (not yet runtime-verified as canonical).`,
      });
    }
  }
  return issues;
}

/** Convenience: parse a file and return its catalog-type issues. */
export function checkCatalogTypesForFile(filePath) {
  return checkCatalogTypes(loadModel(filePath));
}

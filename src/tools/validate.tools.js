/**
 * Validation tool. Composes two layers:
 *  - core/validate.js: structural rules Kettle would reject at load/run time.
 *  - knowledge/catalog-check.js: soft check that each element type is a known
 *    (ideally canonical) type in the embedded knowledge catalog.
 *
 * The catalog layer is on by default here (unlike core, which stays
 * knowledge-agnostic) because the whole point of this server is a knowledge-
 * aware "will it load?" check. Pass checkCatalog:false to get pure structural
 * results. Catalog issues are only warning/info, so they never turn a
 * structurally-sound file into a failure.
 */
import { validateFile, validateAll } from '../core/validate.js';
import { loadModel } from '../core/model.js';
import { checkCatalogTypes } from '../knowledge/catalog-check.js';

const str = d => ({ type: 'string', description: d });

function recount(report) {
  report.summary = {
    errors: report.issues.filter(i => i.severity === 'error').length,
    warnings: report.issues.filter(i => i.severity === 'warning').length,
    info: report.issues.filter(i => i.severity === 'info').length,
  };
  return report;
}

/** Run structural validation on one file, then append catalog-type issues. */
function validateWithCatalog(filePath) {
  const report = validateFile(filePath);
  // Only attempt the catalog layer if the file parsed cleanly enough to model.
  try {
    const model = loadModel(filePath);
    report.issues.push(...checkCatalogTypes(model));
    recount(report);
  } catch {
    // A parse failure is already an error in the structural report; skip.
  }
  return report;
}

export function validateTools({ resolveRead, root }) {
  return [
    {
      name: 'kettle_validate',
      description: 'Lint one file (or every file under KETTLE_ROOT when path omitted). Checks structure (XML, hops, connections, start entry, reachability) plus knowledge-catalog type coverage. checkCatalog:false skips the catalog layer.',
      inputSchema: {
        type: 'object',
        properties: {
          path: str('Path to a .kjb/.ktr file (workspace-relative, or an absolute path contained by KETTLE_ROOT)'),
          checkCatalog: { type: 'boolean', description: 'Include knowledge-catalog type check (default true)' },
        },
      },
      handler: a => {
        const withCatalog = a.checkCatalog !== false;
        if (a.path) {
          const file = resolveRead(a.path);
          return withCatalog ? validateWithCatalog(file) : validateFile(file);
        }
        // Whole-tree: core validateAll, optionally enriched per reported file.
        const all = validateAll(root);
        if (!withCatalog) return all;
        for (const report of all.files) {
          try {
            report.issues.push(...checkCatalogTypes(loadModel(report.path)));
            recount(report);
          } catch { /* structural error already recorded */ }
        }
        // Recompute the tree-level counters after enrichment.
        const summary = { files: all.summary.files, errors: 0, warnings: 0, info: 0 };
        for (const r of all.files) {
          summary.errors += r.summary.errors;
          summary.warnings += r.summary.warnings;
          summary.info += r.summary.info;
        }
        all.summary = summary;
        return all;
      },
    },
  ];
}

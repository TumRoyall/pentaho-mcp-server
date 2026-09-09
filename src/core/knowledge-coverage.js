/**
 * Catalog coverage reporting.
 *
 * Walks a Kettle tree, counts how each step/entry <type> maps onto the embedded
 * catalog, and reports the split between canonical, observed, and missing
 * (uncatalogued) types. Read-only: it parses models and reads the catalog, and
 * never writes any file. A single unreadable/malformed artifact becomes a scan
 * issue rather than aborting the whole report.
 */
import { walkKettleFiles } from './search.js';
import { loadModel } from './model.js';
import { findByXmlType, isGeneratorEligible, verifiedVersions } from '../knowledge/loader.js';

const STATUS_RANK = { missing: 0, observed: 1, canonical: 2 };

function classify(kind, type) {
  const entry = findByXmlType(kind, type);
  if (!entry) {
    return {
      status: 'missing',
      generatorEligible: false,
      alias: null,
      sourceVersion: null,
      verifiedVersions: [],
      verification: null,
    };
  }
  return {
    status: entry.status ?? 'observed',
    generatorEligible: isGeneratorEligible(kind, entry.xml_type),
    alias: entry.type ?? null,
    sourceVersion: entry.source_version ?? null,
    verifiedVersions: verifiedVersions(entry),
    verification: entry.verification ?? null,
  };
}

export function knowledgeCoverage(root, { includeExamples = true } = {}) {
  const files = walkKettleFiles(root);
  const rows = new Map(); // `${kind}\0${type}` -> row
  const issues = [];
  let parsedFiles = 0;
  let typeUsages = 0;

  for (const file of files) {
    let model;
    try {
      model = loadModel(file);
    } catch (err) {
      issues.push({ file, error: err.message });
      continue;
    }
    parsedFiles += 1;
    for (const element of model.elements) {
      const type = element.type;
      if (!type) continue;
      typeUsages += 1;
      const key = `${model.kind}\0${type}`;
      let row = rows.get(key);
      if (!row) {
        const info = classify(model.kind, type);
        row = {
          kind: model.kind,
          xmlType: type,
          alias: info.alias,
          status: info.status,
          generatorEligible: info.generatorEligible,
          sourceVersion: info.sourceVersion,
          verifiedVersions: info.verifiedVersions,
          verification: info.verification,
          uses: 0,
          examples: [],
        };
        rows.set(key, row);
      }
      row.uses += 1;
      if (includeExamples && row.examples.length < 5) {
        row.examples.push({ file, name: element.name });
      }
    }
  }

  const types = [...rows.values()].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    if (b.uses !== a.uses) return b.uses - a.uses;
    return a.xmlType < b.xmlType ? -1 : a.xmlType > b.xmlType ? 1 : 0;
  });

  if (!includeExamples) {
    for (const row of types) delete row.examples;
  }

  const summary = {
    files: files.length,
    parsedFiles,
    scanIssues: issues.length,
    typeUsages,
    distinctTypes: types.length,
    canonical: types.filter(t => t.status === 'canonical').length,
    observed: types.filter(t => t.status === 'observed').length,
    missing: types.filter(t => t.status === 'missing').length,
  };

  return { root, summary, types, issues };
}

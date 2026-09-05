/**
 * Parse .kjb/.ktr files into a normalized read-only model.
 * fast-xml-parser is used with string-preserving options (no value parsing,
 * no trimming) — verified zero data loss across the consumer repo.
 * This module NEVER writes files; edits go through span.js/edit.js.
 */
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const PARSER_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
};
const parser = new XMLParser(PARSER_OPTS);

export function toArray(x) {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}

/**
 * Transformation step config elements whose text is another step's NAME.
 * Hops are not the only way steps reference each other: MergeJoin names its
 * two inputs, FilterRows names its two outputs, and so on. Renaming a step
 * has to rewrite these too, and a dangling one is a broken transformation
 * that Kettle only complains about at run time — so edit.js and validate.js
 * share this list.
 *
 * Every tag here is unambiguously a step reference in Kettle's schema, which
 * is what makes it safe to match on tag name alone. Deliberately excluded:
 * <origin> inside <value-meta>, which caches which step produced a field —
 * Kettle regenerates it, so rewriting it would add diff noise for no gain.
 * Erring long is safe (an absent tag simply never matches), so add to this
 * list when a new step type is encountered.
 */
export const STEP_REFERENCE_TAGS = Object.freeze([
  'step1', 'step2', // MergeJoin
  'send_true_to', 'send_false_to', // FilterRows
  'default_target_step', 'target_step', // SwitchCase
  'source_step', // step error handling
  'execution_result_target_step', // TransExecutor
  'result_rows_target_step',
  'result_files_target_step',
  'executors_output_step',
]);

/**
 * The subset of STEP_REFERENCE_TAGS whose value is a DOWNSTREAM target: the row
 * flow leaves the step carrying the tag and heads to the named step, so a
 * matching enabled <hop> from the carrier to that target must also exist or the
 * transformation is silently broken. Deliberately excludes the upstream/self
 * references — MergeJoin's <step1>/<step2> name its inputs (the hop points the
 * other way), and error handling's <source_step> names the step itself (its
 * downstream is <target_step>, which is covered by the trans hop the error hop
 * writes alongside the <error> block).
 */
export const STEP_TARGET_REFERENCE_TAGS = Object.freeze([
  'send_true_to', 'send_false_to', // FilterRows
  'default_target_step', 'target_step', // SwitchCase
  'execution_result_target_step', // TransExecutor
  'result_rows_target_step',
  'result_files_target_step',
  'executors_output_step',
]);

export function kindOf(filePath) {
  const p = filePath.toLowerCase();
  if (p.endsWith('.kjb')) return 'job';
  if (p.endsWith('.ktr')) return 'trans';
  throw new Error(`Not a Kettle file (.kjb/.ktr): ${filePath}`);
}

/** Child element value → string. Empty elements parse to '' , wrapped text to {'#text': …}. */
export function text(v) {
  if (v == null) return '';
  if (typeof v === 'object') return v['#text'] != null ? String(v['#text']) : '';
  return String(v);
}

function mapParams(parametersNode) {
  return toArray(parametersNode?.parameter).map(p => ({
    name: text(p.name),
    default: text(p.default_value),
    description: text(p.description),
  }));
}

export function parseModel(xml, filePath) {
  const kind = kindOf(filePath);
  const doc = parser.parse(xml);
  if (kind === 'job') {
    const job = doc.job;
    if (!job) throw new Error(`Missing <job> root in ${filePath}`);
    return {
      kind, path: filePath, xml,
      name: text(job.name),
      params: mapParams(job.parameters),
      connections: toArray(job.connection).map(c => text(c.name)),
      elements: toArray(job.entries?.entry).map(e => ({
        name: text(e.name), type: text(e.type), tag: 'entry', raw: e,
      })),
      hops: toArray(job.hops?.hop).map(h => ({
        from: text(h.from), to: text(h.to), enabled: text(h.enabled),
        evaluation: text(h.evaluation), unconditional: text(h.unconditional),
      })),
    };
  }
  const trans = doc.transformation;
  if (!trans) throw new Error(`Missing <transformation> root in ${filePath}`);
  return {
    kind, path: filePath, xml,
    name: text(trans.info?.name),
    params: mapParams(trans.info?.parameters),
    connections: toArray(trans.connection).map(c => text(c.name)),
    elements: toArray(trans.step).map(s => ({
      name: text(s.name), type: text(s.type), tag: 'step', raw: s,
    })),
    hops: toArray(trans.order?.hop).map(h => ({
      from: text(h.from), to: text(h.to), enabled: text(h.enabled),
    })),
    // Step error handling ("red hops") lives in a transformation-level
    // <step_error_handling> container, outside any <step>, so it is surfaced
    // here rather than on an element. Each entry names the source and target
    // step plus whether it is enabled.
    errorHops: toArray(trans.step_error_handling?.error).map(e => ({
      source: text(e.source_step), target: text(e.target_step), enabled: text(e.is_enabled),
    })),
  };
}

export function loadModel(filePath) {
  return parseModel(readFileSync(filePath, 'utf8'), filePath);
}

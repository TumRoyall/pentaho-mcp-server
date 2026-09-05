/** Lint rules matched to the consumer repo's Kettle 9.4 usage. */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import {
  parseModel, text, toArray, STEP_REFERENCE_TAGS, STEP_TARGET_REFERENCE_TAGS,
} from './model.js';
import { walkKettleFiles } from './search.js';

function report(filePath, issues) {
  return {
    path: filePath,
    issues,
    summary: {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    },
  };
}

function isStartEntry(e) {
  return e.type === 'SPECIAL' && text(e.raw.start) === 'Y';
}

/** BFS over hops. Jobs start from the start entry; transformations from source steps. */
function computeReachable(m) {
  const adj = new Map();
  for (const h of m.hops) {
    if (!adj.has(h.from)) adj.set(h.from, []);
    adj.get(h.from).push(h.to);
  }
  let roots;
  if (m.kind === 'job') {
    roots = m.elements.filter(isStartEntry).map(e => e.name);
  } else if (m.elements.length === 1) {
    roots = [m.elements[0].name];
  } else {
    const targets = new Set(m.hops.map(h => h.to));
    roots = m.elements
      .map(e => e.name)
      .filter(n => !targets.has(n) && (adj.get(n) ?? []).length > 0);
  }
  const seen = new Set(roots);
  const stack = [...roots];
  while (stack.length) {
    for (const next of adj.get(stack.pop()) ?? []) {
      if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return seen;
}

function checkDuplicateNames(names, push) {
  for (const n of new Set(names.filter((n, i) => names.indexOf(n) !== i))) {
    push('error', `Duplicate element name "${n}"`);
  }
}

function checkHopReferences(m, names, push) {
  for (const h of m.hops) {
    for (const [role, n] of [['from', h.from], ['to', h.to]]) {
      if (!names.includes(n)) {
        push('error', `Hop ${role} references missing element "${n}" (${h.from} -> ${h.to})`);
      }
    }
  }
}

function checkJobStartEntry(m, push) {
  const starts = m.elements.filter(isStartEntry);
  if (starts.length !== 1) {
    push('error', `Job must have exactly one start entry, found ${starts.length}`);
  }
}

function checkJobEntryFilenames(m, push, dir) {
  for (const e of m.elements.filter(e => e.type === 'TRANS' || e.type === 'JOB')) {
    const fn = text(e.raw.filename);
    if (!fn) {
      push('warning', `${e.type} entry "${e.name}" has no filename (repository reference?)`);
      continue;
    }
    const resolved = fn
      .replaceAll('${Internal.Job.Filename.Directory}', dir)
      .replaceAll('${Internal.Entry.Current.Directory}', dir);
    if (resolved.includes('${')) {
      push('info', `${e.type} entry "${e.name}" filename uses unresolved variables: ${fn}`);
    } else if (!existsSync(resolved)) {
      push('error', `${e.type} entry "${e.name}" references missing file: ${resolved}`);
    }
  }
}

function checkUndefinedConnections(m, push) {
  const defined = new Set(m.connections);
  for (const e of m.elements) {
    const conn = text(e.raw.connection);
    if (conn && !defined.has(conn)) {
      push('error', `Element "${e.name}" uses undefined connection "${conn}"`);
    }
  }
}

/**
 * Steps reference each other by name outside the hop graph too (MergeJoin's
 * <step1>/<step2>, FilterRows' <send_true_to>/<send_false_to>, ...). A stale
 * one is invisible to the hop-endpoint rule but breaks the transformation, so
 * flag it. Warning rather than error: the reference may point at a step the
 * author is about to add, and unlike a bad hop the file still parses.
 */
function checkStepReferences(m, names, push) {
  for (const e of m.elements) {
    for (const tag of STEP_REFERENCE_TAGS) {
      for (const raw of toArray(e.raw[tag])) {
        const ref = text(raw);
        if (ref && !names.includes(ref)) {
          push('warning', `Step reference <${tag}> in "${e.name}" names missing step "${ref}"`);
        }
      }
    }
  }
}

/**
 * A downstream step reference (FilterRows <send_true_to>, SwitchCase
 * <target_step>, ...) names where the row flow goes, but Kettle only actually
 * routes it when a matching enabled <hop> exists from the carrier step to that
 * target. A reference without its hop draws no arrow in Spoon and drops rows at
 * run time, so warn. The reverse (a hop with no reference) is legal — plenty of
 * steps have a single output and no target tag — so it is not flagged here.
 */
function checkTargetReferenceHops(m, push) {
  if (m.kind !== 'trans') return;
  const hopSet = new Set(m.hops.map(h => `${h.from}\u0000${h.to}`));
  const flag = (from, target, where) => {
    if (target && !hopSet.has(`${from}\u0000${target}`)) {
      push('warning', `Step "${from}" routes to "${target}" via ${where} but has no hop to it`);
    }
  };
  for (const e of m.elements) {
    for (const tag of STEP_TARGET_REFERENCE_TAGS) {
      for (const raw of toArray(e.raw[tag])) {
        flag(e.name, text(raw), `<${tag}>`);
      }
    }
    // SwitchCase routes each case to a step named in a nested
    // <cases>/<case>/<target_step>, which the flat tag scan above cannot see.
    for (const c of toArray(e.raw.cases?.case)) {
      flag(e.name, text(c.target_step), '<cases><case><target_step>');
    }
  }
}

/**
 * Error handling (<step_error_handling><error>) routes a step's error rows to a
 * target step — the red hop in Spoon. Like other target references it needs a
 * matching enabled <hop> from source to target to connect the graph. Parse the
 * error blocks straight off the transformation node (they live outside <step>,
 * so they are not on any element's raw).
 */
function checkErrorHandlingHops(m, push) {
  if (m.kind !== 'trans') return;
  const names = new Set(m.elements.map(e => e.name));
  const hopSet = new Set(m.hops.map(h => `${h.from}\u0000${h.to}`));
  for (const err of m.errorHops ?? []) {
    if (err.enabled !== 'Y') continue;
    if (!err.source || !err.target) continue;
    if (!names.has(err.target)) {
      push('error', `Error handling on "${err.source}" targets missing step "${err.target}"`);
    } else if (!hopSet.has(`${err.source}\u0000${err.target}`)) {
      push('warning', `Error handling on "${err.source}" routes to "${err.target}" but has no hop to it`);
    }
  }
}

/**
 * Every <step> shares a wrapper that StepMeta.getXML() always emits around the
 * step-specific body: name/type, the distribute+copies routing, <partitioning>,
 * and the <GUI> block. Spoon reads by tag name so a missing wrapper node does
 * not break loading, but it does mean the step was hand-assembled or generated
 * from an incomplete template and will not round-trip cleanly (Spoon
 * re-materialises the node on save, producing diff noise). Flag the missing
 * ones as warnings — never errors — so authors can complete the wrapper.
 *
 * Only the always-present nodes are checked. Cosmetic optional nodes
 * (custom_distribution, cluster_schema, remotesteps) are intentionally left
 * out: their absence is harmless and flagging them would just add noise.
 */
const STEP_WRAPPER_NODES = Object.freeze(['type', 'distribute', 'copies', 'partitioning', 'GUI']);

function checkStepWrapper(m, push) {
  if (m.kind !== 'trans') return;
  for (const e of m.elements) {
    for (const tag of STEP_WRAPPER_NODES) {
      if (e.raw[tag] === undefined) {
        push('warning', `Step "${e.name}" is missing the wrapper node <${tag}> that Spoon writes for every step`);
      }
    }
  }
}

function checkReachability(m, push) {
  const reachable = computeReachable(m);
  for (const e of m.elements) {
    if (!reachable.has(e.name)) {
      push('warning', `Element "${e.name}" is not reachable from the start of the graph`);
    }
  }
}

function checkUndeclaredVariables(m, xml, push) {
  const declared = new Set(m.params.map(p => p.name));
  const setVars = new Set();
  if (m.kind === 'job') {
    for (const e of m.elements.filter(e => e.type === 'SET_VARIABLES')) {
      for (const f of toArray(e.raw.fields?.field)) setVars.add(text(f.variable_name));
    }
  }
  const used = new Set([...xml.matchAll(/\$\{([A-Za-z0-9_.]+)\}/g)].map(x => x[1]));
  for (const v of used) {
    if (!v.startsWith('Internal.') && !declared.has(v) && !setVars.has(v)) {
      push('info', `Variable \${${v}} is not a declared parameter (may be set by caller or environment)`);
    }
  }
}

export function validateXml(xml, filePath, { dir }) {
  const issues = [];
  const push = (severity, message) => issues.push({ severity, message });

  const wf = XMLValidator.validate(xml);
  if (wf !== true) {
    push('error', `Malformed XML: ${wf.err?.msg} (line ${wf.err?.line})`);
    return report(filePath, issues);
  }

  let m;
  try {
    m = parseModel(xml, filePath);
  } catch (err) {
    push('error', `Cannot parse: ${err.message}`);
    return report(filePath, issues);
  }

  const names = m.elements.map(e => e.name);
  checkDuplicateNames(names, push);
  checkHopReferences(m, names, push);

  if (m.kind === 'job') {
    checkJobStartEntry(m, push);
    checkJobEntryFilenames(m, push, dir);
  }

  checkUndefinedConnections(m, push);
  checkStepReferences(m, names, push);
  checkTargetReferenceHops(m, push);
  checkErrorHandlingHops(m, push);
  checkStepWrapper(m, push);
  checkReachability(m, push);
  checkUndeclaredVariables(m, xml, push);

  return report(filePath, issues);
}

export function validateFile(filePath) {
  let xml;
  try {
    xml = readFileSync(filePath, 'utf8');
  } catch (err) {
    return report(filePath, [{ severity: 'error', message: `Cannot read file: ${err.message}` }]);
  }
  return validateXml(xml, filePath, { dir: path.dirname(filePath) });
}

export function validateAll(root) {
  const reports = walkKettleFiles(root).map(validateFile);
  const summary = { files: reports.length, errors: 0, warnings: 0, info: 0 };
  for (const r of reports) {
    summary.errors += r.summary.errors;
    summary.warnings += r.summary.warnings;
    summary.info += r.summary.info;
  }
  return { summary, files: reports.filter(r => r.issues.length > 0) };
}

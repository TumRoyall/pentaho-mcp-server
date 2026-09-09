/**
 * Reference-safe removal of steps/entries and editing of transformation
 * error hops. Kept out of edit.js so that module does not keep growing.
 *
 * Two guarantees make removal safe:
 *  - Refusal mode (default) never touches the file when the named element is
 *    still referenced by a hop, an error block, or a known step-reference tag;
 *    it reports every reference kind so the caller can decide.
 *  - Cascade mode removes the referencing hops/error blocks and blanks the
 *    text of every route-reference tag (preserving the tags themselves), then
 *    removes the element, in one atomic, re-validated write.
 *
 * All span math is done right-to-left so earlier offsets stay valid as later
 * ranges are spliced out.
 */
import { readFileSync } from 'node:fs';
import {
  findAllSpans, findChildSpan, findElementSpan, innerText, unescapeXml,
} from './span.js';
import { replaceRange, commitEdit } from './edit.js';
import { kindOf, STEP_REFERENCE_TAGS, STEP_TARGET_REFERENCE_TAGS } from './model.js';

const ELEMENT_TAG = { job: 'entry', trans: 'step' };

/** Extend a span's start back over its leading indent and one preceding EOL. */
function withLeadingWhitespace(xml, start) {
  let s = start;
  while (s > 0 && (xml[s - 1] === ' ' || xml[s - 1] === '\t')) s--;
  if (s > 0 && xml[s - 1] === '\n') {
    s--;
    if (s > 0 && xml[s - 1] === '\r') s--;
  }
  return s;
}

/** All spans of a container-child tag whose named child == value. */
function hopsReferencing(xml, name) {
  const refs = [];
  for (const span of findAllSpans(xml, 'hop')) {
    const from = unescapeXml(innerText(xml, span, 'from') ?? '');
    const to = unescapeXml(innerText(xml, span, 'to') ?? '');
    if (from === name || to === name) refs.push(span);
  }
  return refs;
}

/** All <error> block spans whose source_step or target_step == name. */
function errorBlocksReferencing(xml, name) {
  const refs = [];
  for (const span of findAllSpans(xml, 'error')) {
    const source = unescapeXml(innerText(xml, span, 'source_step') ?? '');
    const target = unescapeXml(innerText(xml, span, 'target_step') ?? '');
    if (source === name || target === name) refs.push(span);
  }
  return refs;
}

/**
 * All step-reference tag inner ranges whose text == name. Each is
 * { start, end } of the inner text between the opening and closing tag, so the
 * caller can blank the content while preserving the tags.
 */
function referenceTagInnerRanges(xml, name) {
  const ranges = [];
  for (const refTag of STEP_REFERENCE_TAGS) {
    const open = `<${refTag}>`;
    const close = `</${refTag}>`;
    for (const ref of findAllSpans(xml, refTag)) {
      const inner = { start: ref.start + open.length, end: ref.end - close.length };
      if (unescapeXml(xml.slice(inner.start, inner.end)) === name) {
        ranges.push(inner);
      }
    }
  }
  return ranges;
}

function findElementSpansByName(xml, tag, name) {
  const matches = [];
  for (const span of findAllSpans(xml, tag)) {
    const n = innerText(xml, span, 'name');
    if (n != null && unescapeXml(n) === name) matches.push(span);
  }
  return matches;
}

function isSoleStart(xml, span) {
  const type = unescapeXml(innerText(xml, span, 'type') ?? '');
  const start = unescapeXml(innerText(xml, span, 'start') ?? '');
  return type === 'SPECIAL' && start === 'Y';
}

/**
 * Remove a named step/entry.
 *
 * Default (removeReferences:false): collect every reference to `name` first;
 * if any exists, throw one error listing their kinds and never touch the file.
 *
 * Cascade (removeReferences:true): splice out referencing hops and error
 * blocks, blank the content of every route-reference tag (keeping the tags),
 * then remove the element itself — all right-to-left in one atomic write.
 *
 * The sole job START entry is always rejected. Duplicate names are rejected
 * rather than guessing which element to remove.
 */
export function removeElement(filePath, name, { removeReferences = false } = {}) {
  const kind = kindOf(filePath);
  const tag = ELEMENT_TAG[kind];
  const xml = readFileSync(filePath, 'utf8');

  const elementSpans = findElementSpansByName(xml, tag, name);
  if (elementSpans.length === 0) {
    throw new Error(`No ${tag} named "${name}" in ${filePath}`);
  }
  if (elementSpans.length > 1) {
    throw new Error(
      `Refusing to remove "${name}": duplicate name shared by ${elementSpans.length} ${tag} elements in ${filePath}`,
    );
  }
  const elementSpan = elementSpans[0];

  if (kind === 'job' && isSoleStart(xml, elementSpan)) {
    throw new Error(`Refusing to remove the START entry "${name}" in ${filePath}`);
  }

  const hopRefs = hopsReferencing(xml, name);
  const errorRefs = errorBlocksReferencing(xml, name);
  const tagRefs = referenceTagInnerRanges(xml, name);

  if (!removeReferences) {
    const kinds = [];
    if (hopRefs.length) kinds.push(`${hopRefs.length} hop(s)`);
    if (errorRefs.length) kinds.push(`${errorRefs.length} error block(s)`);
    if (tagRefs.length) kinds.push(`${tagRefs.length} step-reference tag(s)`);
    if (kinds.length) {
      throw new Error(
        `Refusing to remove "${name}": still referenced by ${kinds.join(', ')}. `
        + 'Pass removeReferences:true to cascade.',
      );
    }
  }

  // Build the full edit list, right-to-left. Whole-block removals (hops, error
  // blocks, the element) take their leading whitespace; tag-content blanks
  // replace only the inner text.
  const edits = [];
  for (const span of hopRefs) {
    edits.push({ start: withLeadingWhitespace(xml, span.start), end: span.end, replacement: '' });
  }
  for (const span of errorRefs) {
    edits.push({ start: withLeadingWhitespace(xml, span.start), end: span.end, replacement: '' });
  }
  for (const inner of tagRefs) {
    edits.push({ start: inner.start, end: inner.end, replacement: '' });
  }
  edits.push({
    start: withLeadingWhitespace(xml, elementSpan.start),
    end: elementSpan.end,
    replacement: '',
  });

  edits.sort((a, b) => b.start - a.start);
  let newXml = xml;
  for (const { start, end, replacement } of edits) {
    newXml = replaceRange(newXml, start, end, replacement);
  }

  return commitEdit(filePath, xml, newXml);
}

/**
 * Edit the transformation error block whose <source_step> == source.
 *
 * enable/disable set <is_enabled> to Y/N. remove drops the whole <error>
 * block, and also removes the ordinary source->target hop when that hop exists
 * solely for the error route — i.e. no other explicit downstream route from
 * source to that target still needs it.
 *
 * Rejects job files (jobs have no per-step error handling) and a missing
 * source.
 */
export function editErrorHop(filePath, action, source) {
  const kind = kindOf(filePath);
  if (kind !== 'trans') {
    throw new Error(`Error hops only exist in transformations, not ${kind} files: ${filePath}`);
  }
  if (!['enable', 'disable', 'remove'].includes(action)) {
    throw new Error(`Unknown error-hop action "${action}" (use enable|disable|remove)`);
  }

  const xml = readFileSync(filePath, 'utf8');
  let errorSpan = null;
  for (const span of findAllSpans(xml, 'error')) {
    if (unescapeXml(innerText(xml, span, 'source_step') ?? '') === source) {
      errorSpan = span;
      break;
    }
  }
  if (!errorSpan) {
    throw new Error(`No error hop with source step "${source}" in ${filePath}`);
  }

  if (action === 'enable' || action === 'disable') {
    const en = findChildSpan(xml, errorSpan, 'is_enabled');
    const value = action === 'enable' ? 'Y' : 'N';
    let newXml;
    if (en && !en.selfClosing) {
      newXml = replaceRange(xml, en.inner.start, en.inner.end, value);
    } else if (en && en.selfClosing) {
      newXml = replaceRange(xml, en.start, en.end, `<is_enabled>${value}</is_enabled>`);
    } else {
      throw new Error(`Error block for "${source}" has no <is_enabled> element in ${filePath}`);
    }
    return commitEdit(filePath, xml, newXml);
  }

  // action === 'remove'
  const target = unescapeXml(innerText(xml, errorSpan, 'target_step') ?? '');
  const edits = [{
    start: withLeadingWhitespace(xml, errorSpan.start),
    end: errorSpan.end,
    replacement: '',
  }];

  // Remove the ordinary source->target hop only when no other explicit route
  // needs it. An explicit route is a STEP_TARGET_REFERENCE_TAG on the source
  // step pointing at target (SwitchCase target_step/default_target_step,
  // FilterRows send_*_to, TransExecutor targets, etc.).
  if (target) {
    const sourceSpan = findElementSpan(xml, 'step', source);
    let neededByRoute = false;
    if (sourceSpan) {
      for (const refTag of STEP_TARGET_REFERENCE_TAGS) {
        for (const ref of findAllSpans(xml, refTag)) {
          // Only consider tags inside the source step's span.
          if (ref.start < sourceSpan.start || ref.end > sourceSpan.end) continue;
          const open = `<${refTag}>`;
          const close = `</${refTag}>`;
          const inner = xml.slice(ref.start + open.length, ref.end - close.length);
          if (unescapeXml(inner) === target) { neededByRoute = true; break; }
        }
        if (neededByRoute) break;
      }
    }
    if (!neededByRoute) {
      for (const span of findAllSpans(xml, 'hop')) {
        const from = unescapeXml(innerText(xml, span, 'from') ?? '');
        const to = unescapeXml(innerText(xml, span, 'to') ?? '');
        if (from === source && to === target) {
          edits.push({ start: withLeadingWhitespace(xml, span.start), end: span.end, replacement: '' });
        }
      }
    }
  }

  edits.sort((a, b) => b.start - a.start);
  let newXml = xml;
  for (const { start, end, replacement } of edits) {
    newXml = replaceRange(newXml, start, end, replacement);
  }
  return commitEdit(filePath, xml, newXml);
}

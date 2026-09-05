/**
 * Surgical edits to Kettle XML files.
 * Never rebuilds the document: only the target character range changes,
 * so untouched lines stay byte-identical and git diffs stay minimal.
 * Every op: locate -> edit in memory -> re-validate -> atomic write.
 * On any failure the file on disk is never touched. Git is the undo story.
 */
import {
  readFileSync, writeFileSync, renameSync, existsSync, mkdirSync,
} from 'node:fs';
import path from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import { kindOf, STEP_REFERENCE_TAGS } from './model.js';
import {
  findChildSpan, findElementSpan, escapeXml, findAllSpans, innerText, unescapeXml,
} from './span.js';
import { validateFile } from './validate.js';
import { findByXmlType, getReference, isGeneratorEligible } from '../knowledge/loader.js';

const ELEMENT_TAG = { job: 'entry', trans: 'step' };

/**
 * The document's dominant line ending, used for every fragment this module
 * inserts (never to normalise the rest of the file). CRLF wins when at least
 * half of the file's newlines are part of a \r\n pair; a file with no
 * newline at all defaults to \n.
 */
export function dominantEol(xml) {
  const lf = (xml.match(/\n/g) || []).length;
  if (lf === 0) return '\n';
  const crlf = (xml.match(/\r\n/g) || []).length;
  return crlf * 2 >= lf ? '\r\n' : '\n';
}

/** The run of spaces/tabs immediately before `pos` — i.e. an existing line's own indent. */
function indentBefore(xml, pos) {
  let i = pos;
  while (i > 0 && (xml[i - 1] === ' ' || xml[i - 1] === '\t')) i--;
  return xml.slice(i, pos);
}

export function assertWritable(filePath) {
  const root = process.env.KETTLE_ROOT;
  if (!root) return;
  const rootPrefix = path.resolve(root) + path.sep;
  const target = path.resolve(filePath);
  // Windows paths are case-insensitive; comparing case-sensitively would
  // falsely refuse legitimate writes whenever KETTLE_ROOT and the caller's
  // path differ only in case. POSIX paths are case-sensitive, so keep that
  // comparison exact there.
  const isWritable = process.platform === 'win32'
    ? target.toLowerCase().startsWith(rootPrefix.toLowerCase())
    : target.startsWith(rootPrefix);
  if (!isWritable) {
    throw new Error(`Refusing to write outside KETTLE_ROOT (${root}): ${filePath}`);
  }
}

export function replaceRange(xml, start, end, replacement) {
  return xml.slice(0, start) + replacement + xml.slice(end);
}

export function unifiedDiff(a, b, label) {
  const al = a.split('\n');
  const bl = b.split('\n');
  let p = 0;
  while (p < al.length && p < bl.length && al[p] === bl[p]) p++;
  let s = 0;
  while (s < al.length - p && s < bl.length - p && al[al.length - 1 - s] === bl[bl.length - 1 - s]) s++;
  const removed = al.slice(p, al.length - s);
  const added = bl.slice(p, bl.length - s);
  if (removed.length === 0 && added.length === 0) return `--- ${label}\n(no changes)`;
  const lines = [
    `--- ${label}`,
    `+++ ${label}`,
    `@@ -${p + 1},${removed.length} +${p + 1},${added.length} @@`,
  ];
  for (const l of removed) lines.push('-' + l);
  for (const l of added) lines.push('+' + l);
  return lines.join('\n');
}

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, filePath);
}

export function commitEdit(filePath, oldXml, newXml) {
  const v = XMLValidator.validate(newXml);
  if (v !== true) {
    throw new Error(`Edit would produce malformed XML, aborting: ${v.err?.msg} (${filePath})`);
  }
  atomicWrite(filePath, newXml);
  return unifiedDiff(oldXml, newXml, filePath);
}

function requireElementSpan(xml, filePath, name) {
  const tag = ELEMENT_TAG[kindOf(filePath)];
  const span = findElementSpan(xml, tag, name);
  if (!span) throw new Error(`No ${tag} named "${name}" in ${filePath}`);
  return { span, tag };
}

function extractXmlTemplate(content, kind, xmlType) {
  const match = content.match(/```xml[\t ]*\r?\n([\s\S]*?)```/i);
  if (!match) {
    throw new Error(`No XML template block for ${kind} type "${xmlType}"`);
  }
  return match[1];
}

function replaceTemplateValue(template, rootSpan, tag, value, placeholder) {
  const child = findChildSpan(template, rootSpan, tag);
  if (child) {
    const replacement = escapeXml(value);
    return child.selfClosing
      ? replaceRange(template, child.start, child.end, `<${tag}>${replacement}</${tag}>`)
      : replaceRange(template, child.inner.start, child.inner.end, replacement);
  }
  return placeholder ? template.replaceAll(placeholder, escapeXml(value)) : template;
}

function prepareElementTemplate(rawTemplate, tag, kind, xmlType, name, { x, y }) {
  let template = String(rawTemplate).trim();
  const rootPattern = new RegExp(`^<${tag}>[\\s\\S]*<\\/${tag}>$`);
  if (!rootPattern.test(template) || XMLValidator.validate(template) !== true) {
    throw new Error(`Template must be a single <${tag}> block for ${kind} type "${xmlType}"`);
  }

  let rootSpan = { start: 0, end: template.length };
  const nameChild = findChildSpan(template, rootSpan, 'name');
  if (nameChild) {
    template = replaceTemplateValue(template, rootSpan, 'name', name);
  } else {
    const placeholder = kind === 'job' ? '{{ENTRY_NAME}}' : '{{STEP_NAME}}';
    if (!template.includes(placeholder)) {
      throw new Error(`Template <${tag}> has no <name> element or ${placeholder} placeholder`);
    }
    template = template.replaceAll(placeholder, escapeXml(name));
  }

  rootSpan = { start: 0, end: template.length };
  if (x != null) template = replaceTemplateValue(template, rootSpan, 'xloc', x, '{{X}}');
  rootSpan = { start: 0, end: template.length };
  if (y != null) template = replaceTemplateValue(template, rootSpan, 'yloc', y, '{{Y}}');
  return template;
}

function indentBlock(block, indent, eol) {
  return block
    .replace(/\r\n|\r|\n/g, eol)
    .split(eol)
    .map(line => indent + line)
    .join(eol);
}

function insertBeforeClosingTag(xml, closingTag, block, childIndent, eol, filePath) {
  const at = xml.indexOf(closingTag);
  if (at === -1) throw new Error(`No ${closingTag} container in ${filePath}`);
  const closingIndent = indentBefore(xml, at);
  const indentStart = at - closingIndent.length;
  const rendered = indentBlock(block, childIndent ?? closingIndent + '  ', eol);
  return replaceRange(xml, indentStart, at, `${rendered}${eol}${closingIndent}`);
}

/**
 * Insert one step/entry template without rebuilding the Kettle document.
 * Transformations in the supported PDI fixtures order <order> before their
 * steps, so a new step follows the last existing step (or <order> when empty).
 * Job entries are children of <entries> and are inserted before its close.
 */
export function addElement(filePath, xmlType, name, opts = {}) {
  assertWritable(filePath);
  const kind = kindOf(filePath);
  const catalogEntry = findByXmlType(kind, xmlType);
  if (!catalogEntry) {
    throw new Error(`No knowledge entry for ${kind} type "${xmlType}"`);
  }
  const eligible = isGeneratorEligible(kind, catalogEntry.xml_type);
  if (!eligible && opts.allowObserved !== true) {
    throw new Error(
      `${kind} type "${catalogEntry.xml_type}" has status="${catalogEntry.status}" and is not generator-eligible; pass allowObserved:true to insert it with MANUAL_REVIEW`,
    );
  }

  const xml = readFileSync(filePath, 'utf8');
  const tag = ELEMENT_TAG[kind];
  if (findElementSpan(xml, tag, name)) {
    throw new Error(`A ${tag} named "${name}" already exists in ${filePath}`);
  }

  const rawTemplate = opts.templateXml == null
    ? extractXmlTemplate(getReference(kind, xmlType).content, kind, xmlType)
    : opts.templateXml;
  const template = prepareElementTemplate(rawTemplate, tag, kind, xmlType, name, opts);
  const eol = dominantEol(xml);
  const manualReviewRequired = !eligible;
  const marker = `<!-- MANUAL_REVIEW: ${catalogEntry.xml_type} is observed-only; verify in Spoon before production -->`;
  const normalizedTemplate = manualReviewRequired ? template.replaceAll(marker, '') : template;
  const renderedTemplate = manualReviewRequired ? `${marker}${eol}${normalizedTemplate}` : template;
  let newXml;

  if (kind === 'job') {
    const closeAt = xml.indexOf('</entries>');
    if (closeAt === -1) throw new Error(`No </entries> container in ${filePath}`);
    const entriesIndent = indentBefore(xml, closeAt);
    newXml = insertBeforeClosingTag(xml, '</entries>', renderedTemplate, entriesIndent + '  ', eol, filePath);
  } else {
    const steps = findAllSpans(xml, 'step');
    let anchorEnd = steps.at(-1)?.end ?? null;
    if (anchorEnd == null) {
      const orders = findAllSpans(xml, 'order');
      anchorEnd = orders.at(-1)?.end ?? null;
    }
    if (anchorEnd == null) {
      const selfClosingOrder = xml.match(/<order\s*\/>/);
      if (selfClosingOrder) anchorEnd = selfClosingOrder.index + selfClosingOrder[0].length;
    }

    if (anchorEnd != null) {
      newXml = replaceRange(xml, anchorEnd, anchorEnd, `${eol}${indentBlock(renderedTemplate, '  ', eol)}`);
    } else {
      newXml = insertBeforeClosingTag(xml, '</transformation>', renderedTemplate, '  ', eol, filePath);
    }
  }

  return {
    diff: commitEdit(filePath, xml, newXml),
    catalogStatus: catalogEntry.status,
    manualReviewRequired,
  };
}

export function setSql(filePath, name, sql) {
  assertWritable(filePath);
  const xml = readFileSync(filePath, 'utf8');
  const { span } = requireElementSpan(xml, filePath, name);
  const child = findChildSpan(xml, span, 'sql');
  if (!child) throw new Error(`Element "${name}" has no <sql> block in ${filePath}`);
  const newXml = child.selfClosing
    ? replaceRange(xml, child.start, child.end, `<sql>${escapeXml(sql)}</sql>`)
    : replaceRange(xml, child.inner.start, child.inner.end, escapeXml(sql));
  return commitEdit(filePath, xml, newXml);
}

export function setField(filePath, name, field, value) {
  assertWritable(filePath);
  const xml = readFileSync(filePath, 'utf8');
  const { span, tag } = requireElementSpan(xml, filePath, name);
  const child = findChildSpan(xml, span, field);
  let newXml;
  if (child) {
    newXml = child.selfClosing
      ? replaceRange(xml, child.start, child.end, `<${field}>${escapeXml(value)}</${field}>`)
      : replaceRange(xml, child.inner.start, child.inner.end, escapeXml(value));
  } else {
    // Insert just before the element's closing tag, at the closing tag's own
    // indent plus two spaces (matching sibling depth), using the file's
    // dominant line ending. Extend the edit range back over the closing
    // tag's pre-existing indent whitespace so that whitespace becomes the
    // new field's line, and the closing tag's own line is re-emitted
    // unchanged (not re-indented).
    const at = span.end - `</${tag}>`.length;
    const closingIndent = indentBefore(xml, at);
    const indentStart = at - closingIndent.length;
    const eol = dominantEol(xml);
    const fieldIndent = closingIndent + '  ';
    const insertion = `${fieldIndent}<${field}>${escapeXml(value)}</${field}>${eol}${closingIndent}`;
    newXml = replaceRange(xml, indentStart, at, insertion);
  }
  return commitEdit(filePath, xml, newXml);
}

function findHopSpan(xml, from, to) {
  for (const span of findAllSpans(xml, 'hop')) {
    if (
      unescapeXml(innerText(xml, span, 'from') ?? '') === from &&
      unescapeXml(innerText(xml, span, 'to') ?? '') === to
    ) return span;
  }
  return null;
}

export function editHops(filePath, action, from, to, opts = {}) {
  assertWritable(filePath);
  const kind = kindOf(filePath);
  const xml = readFileSync(filePath, 'utf8');
  const tag = ELEMENT_TAG[kind];
  for (const [role, n] of [['from', from], ['to', to]]) {
    if (!findElementSpan(xml, tag, n)) {
      throw new Error(`Hop ${role} "${n}" not found in ${filePath}`);
    }
  }
  const hopSpan = findHopSpan(xml, from, to);
  let newXml;
  if (action === 'add') {
    if (hopSpan) throw new Error(`Hop ${from} -> ${to} already exists in ${filePath}`);
    const containerClose = kind === 'job' ? '</hops>' : '</order>';
    const at = xml.indexOf(containerClose);
    if (at === -1) throw new Error(`No ${containerClose} container in ${filePath}`);
    const f = escapeXml(from);
    const t = escapeXml(to);
    const eol = dominantEol(xml);
    // Job hop semantics come in three flavours (JobHopMeta.getXML): success
    // (evaluation=Y, unconditional=N), failure (evaluation=N, unconditional=N),
    // and unconditional (unconditional=Y). Spoon forces the hop leaving the
    // START entry to be unconditional — JobHopMeta's constructor calls
    // setUnconditional() when from.isStart() — so a plain `add` from START must
    // default to unconditional Y, not the ordinary success default N. An
    // explicit opts.unconditional still wins.
    const fromIsStart = kind === 'job' && (() => {
      const fromSpan = findElementSpan(xml, tag, from);
      return fromSpan != null
        && unescapeXml(innerText(xml, fromSpan, 'type') ?? '') === 'SPECIAL'
        && unescapeXml(innerText(xml, fromSpan, 'start') ?? '') === 'Y';
    })();
    const unconditional = opts.unconditional ?? (fromIsStart ? 'Y' : 'N');
    const jobLines = [
      '<hop>',
      `      <from>${f}</from>`,
      `      <to>${t}</to>`,
      '      <from_nr>0</from_nr>',
      '      <to_nr>0</to_nr>',
      '      <enabled>Y</enabled>',
      `      <evaluation>${escapeXml(opts.evaluation ?? 'Y')}</evaluation>`,
      `      <unconditional>${escapeXml(unconditional)}</unconditional>`,
      '    </hop>',
      '  ',
    ];
    const transLines = [
      '<hop>',
      `      <from>${f}</from>`,
      `      <to>${t}</to>`,
      '      <enabled>Y</enabled>',
      '    </hop>',
      '  ',
    ];
    const hopXml = (kind === 'job' ? jobLines : transLines).join(eol);
    newXml = replaceRange(xml, at, at, hopXml);
  } else if (action === 'remove') {
    if (!hopSpan) throw new Error(`Hop ${from} -> ${to} not found in ${filePath}`);
    let s = hopSpan.start;
    while (s > 0 && (xml[s - 1] === ' ' || xml[s - 1] === '\t')) s--;
    if (s > 0 && xml[s - 1] === '\n') {
      s--;
      if (s > 0 && xml[s - 1] === '\r') s--;
    }
    newXml = replaceRange(xml, s, hopSpan.end, '');
  } else if (action === 'enable' || action === 'disable') {
    if (!hopSpan) throw new Error(`Hop ${from} -> ${to} not found in ${filePath}`);
    const en = findChildSpan(xml, hopSpan, 'enabled');
    if (!en) throw new Error(`Hop ${from} -> ${to} has no <enabled> element`);
    newXml = replaceRange(xml, en.inner.start, en.inner.end, action === 'enable' ? 'Y' : 'N');
  } else {
    throw new Error(`Unknown hop action "${action}" (use add|remove|enable|disable)`);
  }
  return commitEdit(filePath, xml, newXml);
}

/**
 * The ten child nodes of a transformation's <error> block, in the exact order
 * StepErrorMeta.getXML() emits them. source_step/target_step name the steps;
 * the rest are optional value/limit fields left empty by default (Spoon writes
 * empty self-closing tags for them).
 */
const ERROR_BLOCK_TAGS = Object.freeze([
  'source_step', 'target_step', 'is_enabled',
  'nr_valuename', 'descriptions_valuename', 'fields_valuename', 'codes_valuename',
  'max_errors', 'max_pct_errors', 'min_pct_rows',
]);

function findErrorSpanForSource(xml, source) {
  for (const span of findAllSpans(xml, 'error')) {
    if (unescapeXml(innerText(xml, span, 'source_step') ?? '') === source) return span;
  }
  return null;
}

/**
 * Add error handling to a transformation: route the error rows of `source`
 * into `target`. This is the "red hop" in Spoon, and it is NOT just a hop — it
 * needs a matching <error> block inside a transformation-level
 * <step_error_handling> container (StepErrorMeta.getXML), plus an ordinary
 * enabled <hop> source -> target so the graph actually connects the two steps.
 *
 * Both are written in one atomic edit. The <error> block carries the ten nodes
 * StepErrorMeta emits, in order; the optional value/limit fields default empty
 * (self-closing) and can be filled afterwards with set_field_path against the
 * <error> block if a caller wants error counts/descriptions in the stream.
 *
 * Refuses on a job (jobs have no per-step error handling), when either step is
 * missing, or when `source` already has an error block (Kettle allows only one
 * error target per step).
 */
export function addErrorHop(filePath, source, target, opts = {}) {
  assertWritable(filePath);
  const kind = kindOf(filePath);
  if (kind !== 'trans') {
    throw new Error(`Error hops only exist in transformations, not ${kind} files: ${filePath}`);
  }
  const xml = readFileSync(filePath, 'utf8');
  for (const [role, n] of [['source', source], ['target', target]]) {
    if (!findElementSpan(xml, 'step', n)) {
      throw new Error(`Error hop ${role} step "${n}" not found in ${filePath}`);
    }
  }
  if (findErrorSpanForSource(xml, source)) {
    throw new Error(`Step "${source}" already has an error hop in ${filePath}`);
  }

  const eol = dominantEol(xml);
  const values = {
    source_step: source,
    target_step: target,
    is_enabled: opts.enabled === false ? 'N' : 'Y',
    nr_valuename: opts.nrErrorsField ?? '',
    descriptions_valuename: opts.errorDescField ?? '',
    fields_valuename: opts.errorFieldsField ?? '',
    codes_valuename: opts.errorCodesField ?? '',
    max_errors: opts.maxErrors ?? '',
    max_pct_errors: opts.maxPctErrors ?? '',
    min_pct_rows: opts.minPctRows ?? '',
  };
  const errorInner = ERROR_BLOCK_TAGS
    .map((t) => {
      const v = values[t] == null ? '' : String(values[t]);
      return v === '' ? `      <${t}/>` : `      <${t}>${escapeXml(v)}</${t}>`;
    })
    .join(eol);
  const errorBlock = `    <error>${eol}${errorInner}${eol}    </error>`;

  // 1) Insert (or extend) the transformation-level <step_error_handling>
  // container. Spoon places it right after the last <step> and before
  // <slave-step-copy-partition-distribution>; when absent we create it just
  // before that anchor, or before </transformation> as a fallback.
  let withError;
  const existing = findAllSpans(xml, 'step_error_handling')[0];
  if (existing) {
    const closeAt = xml.lastIndexOf('</step_error_handling>', existing.end);
    const closingIndent = indentBefore(xml, closeAt);
    const indentStart = closeAt - closingIndent.length;
    withError = replaceRange(xml, indentStart, closeAt, `${errorBlock}${eol}${closingIndent}`);
  } else {
    const container = `  <step_error_handling>${eol}${errorBlock}${eol}  </step_error_handling>`;
    let anchor = xml.indexOf('<slave-step-copy-partition-distribution>');
    if (anchor === -1) anchor = xml.indexOf('</transformation>');
    if (anchor === -1) throw new Error(`No place to insert error handling in ${filePath}`);
    const anchorIndent = indentBefore(xml, anchor);
    const indentStart = anchor - anchorIndent.length;
    withError = replaceRange(xml, indentStart, anchor, `${container}${eol}${anchorIndent}`);
  }

  // 2) Ensure an ordinary enabled hop source -> target connects the steps.
  let newXml = withError;
  if (!findHopSpan(withError, source, target)) {
    const at = withError.indexOf('</order>');
    if (at === -1) throw new Error(`No </order> container in ${filePath}`);
    const hopXml = [
      '<hop>',
      `      <from>${escapeXml(source)}</from>`,
      `      <to>${escapeXml(target)}</to>`,
      '      <enabled>Y</enabled>',
      '    </hop>',
      '  ',
    ].join(eol);
    newXml = replaceRange(withError, at, at, hopXml);
  }

  return commitEdit(filePath, xml, newXml);
}

export function renameElement(filePath, oldName, newName) {
  assertWritable(filePath);
  const xml = readFileSync(filePath, 'utf8');
  const tag = ELEMENT_TAG[kindOf(filePath)];
  if (findElementSpan(xml, tag, newName)) {
    throw new Error(`A ${tag} named "${newName}" already exists in ${filePath}`);
  }
  const span = findElementSpan(xml, tag, oldName);
  if (!span) throw new Error(`No ${tag} named "${oldName}" in ${filePath}`);
  const edits = [];
  const nameChild = findChildSpan(xml, span, 'name');
  edits.push([nameChild.inner.start, nameChild.inner.end]);
  for (const hop of findAllSpans(xml, 'hop')) {
    for (const t of ['from', 'to']) {
      const c = findChildSpan(xml, hop, t);
      if (c && unescapeXml(xml.slice(c.inner.start, c.inner.end)) === oldName) {
        edits.push([c.inner.start, c.inner.end]);
      }
    }
  }
  // Steps also reference each other outside the hop graph — MergeJoin's
  // <step1>/<step2>, FilterRows' <send_true_to>/<send_false_to>, and friends.
  // Leaving those stale renames the step into a transformation Kettle can no
  // longer wire up. Scan the whole document rather than each step's span: a
  // tag like <target_step> can repeat within one step, and <source_step>
  // lives in the transformation-level error-handling block.
  for (const refTag of STEP_REFERENCE_TAGS) {
    const open = `<${refTag}>`;
    const close = `</${refTag}>`;
    for (const ref of findAllSpans(xml, refTag)) {
      const inner = { start: ref.start + open.length, end: ref.end - close.length };
      if (unescapeXml(xml.slice(inner.start, inner.end)) === oldName) {
        edits.push([inner.start, inner.end]);
      }
    }
  }
  edits.sort((a, b) => b[0] - a[0]); // right-to-left so earlier offsets stay valid
  let newXml = xml;
  for (const [s, e] of edits) newXml = replaceRange(newXml, s, e, escapeXml(newName));
  return commitEdit(filePath, xml, newXml);
}

/**
 * Parse the tag order and default values of a template item block, e.g. one
 * `<field>...</field>`. Returns an ordered list of { tag, default } for the
 * item's direct children. Only flat (non-nested) children are read; that
 * covers the repeatable item blocks in SelectValues, ExcelWriter, GroupBy,
 * TableOutput, etc. The order is preserved because PDI is order-sensitive.
 */
function parseItemTemplate(itemInnerXml) {
  const order = [];
  const re = /<([A-Za-z0-9_]+)\s*\/>|<([A-Za-z0-9_]+)>([\s\S]*?)<\/\2>/g;
  let m;
  while ((m = re.exec(itemInnerXml)) !== null) {
    if (m[1]) order.push({ tag: m[1], default: '' });
    else order.push({ tag: m[2], default: m[3] });
  }
  return order;
}

/** Render one item block from a template child-order and a value object. */
function renderItem(itemTag, order, values, indent, eol) {
  const inner = order
    .map(({ tag, default: def }) => {
      const raw = Object.prototype.hasOwnProperty.call(values, tag) ? values[tag] : def;
      const v = raw == null ? '' : String(raw);
      return v === ''
        ? `${indent}  <${tag}/>`
        : `${indent}  <${tag}>${escapeXml(v)}</${tag}>`;
    })
    .join(eol);
  return `${indent}<${itemTag}>${eol}${inner}${eol}${indent}</${itemTag}>`;
}

/**
 * Replace the whole run of consecutive `<itemTag>` blocks inside a step's
 * `<listTag>` with blocks built from `items`. Learns each item's child tag
 * order and defaults from the FIRST existing `<itemTag>` (the template), so
 * the shape is taken from real XML rather than hard-coded per step type.
 * Everything else inside `<listTag>` (e.g. <select_unspecified>, a different
 * repeated block like <meta>) is left byte-identical.
 *
 * `items` is an array of objects mapping child tag -> value; omitted tags fall
 * back to the template's default for that tag.
 *
 * When the list has no existing `<itemTag>` block to learn from, the item's
 * child-tag order is instead derived from the union of keys across `items`
 * (first-seen order preserved) and the new run is inserted just before the
 * list's closing tag. This lets a caller seed a brand-new repeatable item
 * type (e.g. SelectValues <meta>, which Spoon otherwise materialises on save)
 * without a hand-written template block. Everything else in the list stays
 * byte-identical.
 */
export function setFields(filePath, name, listTag, itemTag, items) {
  assertWritable(filePath);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`setFields requires a non-empty items array for <${itemTag}> in "${name}"`);
  }
  const xml = readFileSync(filePath, 'utf8');
  const { span } = requireElementSpan(xml, filePath, name);
  const list = findChildSpan(xml, span, listTag);
  if (!list) throw new Error(`Element "${name}" has no <${listTag}> block in ${filePath}`);
  if (list.selfClosing) {
    throw new Error(`<${listTag}> in "${name}" is empty (<${listTag}/>); cannot host <${itemTag}> items`);
  }

  // Find every top-level <itemTag> block within the list's inner range.
  const open = `<${itemTag}>`;
  const close = `</${itemTag}>`;
  const blocks = [];
  let i = list.inner.start;
  while (true) {
    const s = xml.indexOf(open, i);
    if (s === -1 || s >= list.inner.end) break;
    const e = xml.indexOf(close, s);
    if (e === -1 || e >= list.inner.end) break;
    blocks.push({ start: s, end: e + close.length });
    i = e + close.length;
  }

  const eol = dominantEol(xml);
  let order;
  let indent;
  let runStart;
  let runEnd;

  if (blocks.length > 0) {
    // Learn shape from the FIRST existing block; replace the whole run.
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    indent = indentBefore(xml, first.start);
    runStart = first.start - indent.length;
    runEnd = last.end;
    const templateInner = xml.slice(first.start + open.length, first.end - close.length);
    order = parseItemTemplate(templateInner);
  } else {
    // No template item to copy: seed a new item type. Derive the child-tag
    // order from the union of keys across items (first-seen order), and insert
    // the new run just before the list's closing tag.
    const seen = new Set();
    order = [];
    for (const values of items) {
      for (const tag of Object.keys(values)) {
        if (!seen.has(tag)) { seen.add(tag); order.push({ tag, default: '' }); }
      }
    }
    if (order.length === 0) {
      throw new Error(`Cannot seed <${itemTag}> in "${name}": items have no keys to derive child tags`);
    }
    const closingIndent = indentBefore(xml, list.inner.end);
    indent = closingIndent + '  ';
    runStart = list.inner.end - closingIndent.length;
    runEnd = list.inner.end;
  }

  const rendered = items
    .map(values => renderItem(itemTag, order, values, indent, eol))
    .join(eol);

  const replacement = blocks.length > 0
    ? rendered
    : `${rendered}${eol}${indentBefore(xml, list.inner.end)}`;

  const newXml = replaceRange(xml, runStart, runEnd, replacement);
  return commitEdit(filePath, xml, newXml);
}

/**
 * Set a single value that lives nested under a step/entry, addressed by a
 * slash path of tag names, e.g. "file/sheetname" targets
 * <step>...<file>...<sheetname>HERE</sheetname>...</file>. All ancestor tags
 * in the path must already exist (they come from the cloned template); only
 * the final leaf is created if missing, inserted at sibling depth just before
 * its parent's closing tag. Everything else stays byte-identical.
 *
 * `path` may be a "a/b/c" string or an array ["a","b","c"]. A single segment
 * behaves like setField (direct child).
 */
export function setFieldPath(filePath, name, fieldPath, value) {
  assertWritable(filePath);
  const xml = readFileSync(filePath, 'utf8');
  const { span, tag } = requireElementSpan(xml, filePath, name);
  const segments = Array.isArray(fieldPath)
    ? fieldPath.slice()
    : String(fieldPath).split('/').map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) throw new Error('setFieldPath requires a non-empty path');

  // Walk ancestors, narrowing the search span at each level. Ancestors must
  // exist and must not be self-closing (there is nothing to descend into).
  // `insertBefore` is the offset just before the current scope's closing tag,
  // where a missing leaf would be inserted. For the step/entry itself that is
  // `span.end - "</tag>".length`; for a descended tag it is the inner-range end.
  let scope = span;
  let insertBefore = span.end - `</${tag}>`.length;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const child = findChildSpan(xml, scope, seg);
    if (!child) {
      throw new Error(`Path segment "${seg}" not found under "${name}" in ${filePath}`);
    }
    if (child.selfClosing) {
      throw new Error(`Path segment "${seg}" under "${name}" is empty (<${seg}/>); cannot descend`);
    }
    scope = { start: child.inner.start, end: child.inner.end };
    insertBefore = child.inner.end;
  }

  const leaf = segments[segments.length - 1];
  const child = findChildSpan(xml, scope, leaf);
  let newXml;
  if (child) {
    newXml = child.selfClosing
      ? replaceRange(xml, child.start, child.end, `<${leaf}>${escapeXml(value)}</${leaf}>`)
      : replaceRange(xml, child.inner.start, child.inner.end, escapeXml(value));
  } else {
    // Create the leaf just before the parent scope's closing tag, matching the
    // indent of the parent's closing tag plus two spaces.
    const at = insertBefore;
    const closingIndent = indentBefore(xml, at);
    const indentStart = at - closingIndent.length;
    const eol = dominantEol(xml);
    const fieldIndent = closingIndent + '  ';
    const insertion = `${fieldIndent}<${leaf}>${escapeXml(value)}</${leaf}>${eol}${closingIndent}`;
    newXml = replaceRange(xml, indentStart, at, insertion);
  }
  return commitEdit(filePath, xml, newXml);
}

/** Minimal, well-formed skeletons that pass the structural validator as-is. */
function emptyTransXml(name) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info>
    <name>${escapeXml(name)}</name>
  </info>
  <order>
  </order>
</transformation>
`;
}

// A job must have exactly one start entry to validate clean, so the skeleton
// ships the canonical Kettle START (type SPECIAL, <start>Y</start>).
function emptyJobXml(name) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>${escapeXml(name)}</name>
  <entries>
    <entry>
      <name>START</name>
      <description/>
      <type>SPECIAL</type>
      <attributes/>
      <start>Y</start>
      <dummy>N</dummy>
      <repeat>N</repeat>
      <schedulerType>0</schedulerType>
      <intervalSeconds>0</intervalSeconds>
      <intervalMinutes>60</intervalMinutes>
      <hour>12</hour>
      <minutes>0</minutes>
      <weekDay>1</weekDay>
      <DayOfMonth>1</DayOfMonth>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>80</xloc>
      <yloc>100</yloc>
      <attributes_kjc/>
    </entry>
  </entries>
  <hops>
  </hops>
</job>
`;
}

/**
 * Create a brand-new empty Kettle file from scratch (no source to clone).
 * The kind is taken from the extension (.ktr -> transformation, .kjb -> job);
 * the internal artifact name defaults to the file's basename when not given.
 *
 * The skeleton is the smallest structure the validator accepts: a
 * transformation carries an empty <order>; a job carries the single START
 * entry it requires plus an empty <hops>. Callers then build it up with
 * addElement / editHops / set* — no clone-then-strip needed.
 */
export function createFile(filePath, { kind, name } = {}) {
  assertWritable(filePath);
  const detected = kindOf(filePath); // throws on a non-.kjb/.ktr path
  if (kind && kind !== detected) {
    throw new Error(`kind "${kind}" conflicts with extension of ${filePath} (${detected})`);
  }
  if (existsSync(filePath)) throw new Error(`Destination already exists: ${filePath}`);
  const artifactName = name && String(name).trim()
    ? String(name).trim()
    : path.basename(filePath).replace(/\.(kjb|ktr)$/i, '');
  const xml = detected === 'job' ? emptyJobXml(artifactName) : emptyTransXml(artifactName);
  const v = XMLValidator.validate(xml);
  if (v !== true) throw new Error(`Generated skeleton is malformed: ${v.err?.msg}`);
  mkdirSync(path.dirname(filePath), { recursive: true });
  atomicWrite(filePath, xml);
  const validation = validateFile(filePath);
  return { path: filePath, kind: detected, name: artifactName, validation };
}

export function cloneFile(sourcePath, destPath, name, replacements = []) {
  assertWritable(destPath);
  if (kindOf(sourcePath) !== kindOf(destPath)) {
    throw new Error('Source and destination must be the same kind (.kjb/.ktr)');
  }
  if (existsSync(destPath)) throw new Error(`Destination already exists: ${destPath}`);
  let xml = readFileSync(sourcePath, 'utf8');
  for (const { find, replace } of replacements) xml = xml.split(find).join(replace);
  // Set the internal artifact name: the first <name> after <job> (jobs)
  // or after <info> (transformations).
  const kind = kindOf(sourcePath);
  const anchor = xml.indexOf(kind === 'job' ? '<job>' : '<info>');
  if (anchor === -1) throw new Error(`Missing root element in ${sourcePath}`);
  const ns = xml.indexOf('<name>', anchor);
  const ne = xml.indexOf('</name>', ns);
  if (ns === -1 || ne === -1) throw new Error(`Missing <name> element in ${sourcePath}`);
  xml = xml.slice(0, ns + '<name>'.length) + escapeXml(name) + xml.slice(ne);
  const v = XMLValidator.validate(xml);
  if (v !== true) {
    throw new Error(`Clone would produce malformed XML (check replacements): ${v.err?.msg}`);
  }
  mkdirSync(path.dirname(destPath), { recursive: true });
  atomicWrite(destPath, xml);
  const validation = validateFile(destPath);
  return { destPath, name, validation };
}

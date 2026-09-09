/**
 * Artifact-level edits that are neither steps/entries nor hops: the
 * <parameters> list and top-level <connection> blocks. These live in their own
 * module (not edit.js) so that file does not keep growing. Each operation
 * follows the same contract as edit.js: locate an exact character range, edit
 * in memory, then commitEdit() re-validates the XML and writes atomically.
 */
import { readFileSync } from 'node:fs';
import { kindOf } from './model.js';
import {
  findAllSpans, findDirectChildSpan, escapeXml, unescapeXml,
} from './span.js';
import {
  replaceRange, commitEdit, dominantEol,
} from './edit.js';

/** The run of spaces/tabs immediately before `pos` — an existing line's own indent. */
function indentBefore(xml, pos) {
  let i = pos;
  while (i > 0 && (xml[i - 1] === ' ' || xml[i - 1] === '\t')) i--;
  return xml.slice(i, pos);
}

/**
 * The span of the artifact's PARENT element that owns <parameters>:
 *  - transformation: the <info> block (parameters and <name> are siblings there)
 *  - job:            the <job> root itself
 * Returns { start, end } of that parent's opening..closing tag so callers can
 * pass it straight to findDirectChildSpan.
 */
function parametersParentSpan(xml, kind) {
  if (kind === 'trans') {
    const info = findAllSpans(xml, 'info')[0];
    if (!info) throw new Error('Transformation has no <info> block');
    return info;
  }
  const job = findAllSpans(xml, 'job')[0];
  if (!job) throw new Error('Job has no <job> root');
  return job;
}

/** Render one <parameter> block at the given child indent. */
function renderParameter(param, indent, eol) {
  const name = escapeXml(param.name);
  const def = escapeXml(param.default == null ? '' : String(param.default));
  const desc = escapeXml(param.description == null ? '' : String(param.description));
  const defLine = def === '' ? `${indent}  <default_value/>` : `${indent}  <default_value>${def}</default_value>`;
  const descLine = desc === '' ? `${indent}  <description/>` : `${indent}  <description>${desc}</description>`;
  return [
    `${indent}<parameter>`,
    `${indent}  <name>${name}</name>`,
    defLine,
    descLine,
    `${indent}</parameter>`,
  ].join(eol);
}

/**
 * Replace the artifact-level <parameters> list with the given parameters, or
 * create the container in the correct location when absent. One atomic minimal
 * edit. Parameter children are rendered in stable order: <name>,
 * <default_value>, <description>. Duplicate or blank names are rejected.
 *
 * parameters: [{ name, default, description }]
 */
export function setArtifactParameters(filePath, parameters) {
  if (!Array.isArray(parameters)) {
    throw new Error('parameters must be an array of { name, default, description }');
  }
  const seen = new Set();
  for (const p of parameters) {
    const name = p && typeof p.name === 'string' ? p.name : '';
    if (name.trim() === '') {
      throw new Error('Parameter name must not be blank/empty');
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate parameter name "${name}"`);
    }
    seen.add(name);
  }

  const kind = kindOf(filePath);
  const xml = readFileSync(filePath, 'utf8');
  const eol = dominantEol(xml);
  const parent = parametersParentSpan(xml, kind);
  const existing = findDirectChildSpan(xml, parent, 'parameters');

  let newXml;
  if (existing) {
    // Replace the whole <parameters>...</parameters> container in place,
    // matching its existing indent so surrounding bytes stay untouched.
    const containerIndent = indentBefore(xml, existing.start);
    const childIndent = containerIndent + '  ';
    const body = parameters.length === 0
      ? `<parameters/>`
      : `<parameters>${eol}${parameters.map(p => renderParameter(p, childIndent, eol)).join(eol)}${eol}${containerIndent}</parameters>`;
    newXml = replaceRange(xml, existing.start, existing.end, body);
  } else {
    // Create the container just before the parent's closing tag, at sibling
    // depth (parent's closing-tag indent + two spaces).
    const parentTagEnd = xml.indexOf('>', parent.start);
    const parentName = xml.slice(parent.start + 1, parentTagEnd).match(/^[^\s/>]+/)[0];
    const closeTag = `</${parentName}>`;
    const at = xml.lastIndexOf(closeTag, parent.end);
    const closingIndent = indentBefore(xml, at);
    const indentStart = at - closingIndent.length;
    const containerIndent = closingIndent + '  ';
    const childIndent = containerIndent + '  ';
    const body = parameters.length === 0
      ? `<parameters/>`
      : `<parameters>${eol}${parameters.map(p => renderParameter(p, childIndent, eol)).join(eol)}${eol}${containerIndent}</parameters>`;
    const insertion = `${containerIndent}${body}${eol}${closingIndent}`;
    newXml = replaceRange(xml, indentStart, at, insertion);
  }

  return commitEdit(filePath, xml, newXml);
}

// --- Connection copy ---------------------------------------------------------

/**
 * Locate a top-level <connection> block by its direct <name> child. Returns
 * the span or null. Only direct <connection> siblings under the artifact root
 * are considered; findAllSpans finds each <connection>...</connection>, and
 * findDirectChildSpan reads its depth-one <name>.
 */
function findConnectionSpan(xml, name) {
  for (const span of findAllSpans(xml, 'connection')) {
    const nameChild = findDirectChildSpan(xml, span, 'name');
    if (!nameChild) continue;
    const value = unescapeXml(xml.slice(nameChild.inner.start, nameChild.inner.end));
    if (value === name) return { span, nameChild };
  }
  return null;
}

/**
 * Classify a connection's password text against the copy policy:
 *   empty / self-closing         -> allowed
 *   ${VARIABLE}                  -> allowed
 *   Encrypted... (opt-in only)   -> allowed only when allowEncryptedPassword
 *   anything else (plaintext)    -> rejected
 * Returns nothing on success; throws with a clear message otherwise.
 */
function assertPasswordPolicy(passwordChild, connectionXml, allowEncryptedPassword) {
  if (!passwordChild || passwordChild.selfClosing) return; // no password / <password/>
  const rawInner = connectionXml.slice(passwordChild.inner.start, passwordChild.inner.end);
  const value = unescapeXml(rawInner).trim();
  if (value === '') return; // empty <password></password>
  if (/^\$\{[^}]+\}$/.test(value)) return; // ${VARIABLE}
  if (value.startsWith('Encrypted')) {
    if (allowEncryptedPassword === true) return;
    throw new Error(
      'Source connection has an encrypted password; pass allowEncryptedPassword:true to copy it',
    );
  }
  throw new Error(
    'Refusing to copy a connection with a non-placeholder (plaintext) password',
  );
}

/**
 * Copy one named <connection> block from an in-root source artifact into a
 * destination artifact. Extracts the EXACT source span; when renaming, only its
 * direct <name> child changes. Inserts alongside existing top-level connection
 * blocks in the destination. Refuses a destination-name collision. Source and
 * destination kind are independent (a job connection may be copied into a
 * transformation and vice versa). Password policy is enforced before any write.
 *
 * Returns the destination diff.
 */
export function copyConnection(sourcePath, destPath, sourceName, opts = {}) {
  const { destName, allowEncryptedPassword } = opts;
  const finalName = destName != null && destName !== '' ? destName : sourceName;

  // kindOf validates both paths are .kjb/.ktr; kinds may differ.
  kindOf(sourcePath);
  const destKind = kindOf(destPath);

  const srcXml = readFileSync(sourcePath, 'utf8');
  const found = findConnectionSpan(srcXml, sourceName);
  if (!found) {
    throw new Error(`No connection named "${sourceName}" in ${sourcePath}`);
  }
  const { span: srcSpan, nameChild: srcNameChild } = found;

  // Password policy: enforce on the source block before extracting it.
  const passwordChild = findDirectChildSpan(srcXml, srcSpan, 'password');
  assertPasswordPolicy(passwordChild, srcXml, allowEncryptedPassword);

  // Extract the exact source connection block, then (optionally) rename only
  // its direct <name> child. Offsets inside the extracted block are the source
  // offsets shifted by srcSpan.start.
  let block = srcXml.slice(srcSpan.start, srcSpan.end);
  if (finalName !== sourceName) {
    const relStart = srcNameChild.inner.start - srcSpan.start;
    const relEnd = srcNameChild.inner.end - srcSpan.start;
    block = block.slice(0, relStart) + escapeXml(finalName) + block.slice(relEnd);
  }

  const destXml = readFileSync(destPath, 'utf8');
  if (findConnectionSpan(destXml, finalName)) {
    throw new Error(`A connection named "${finalName}" already exists in ${destPath}`);
  }

  const eol = dominantEol(destXml);
  const destConnections = findAllSpans(destXml, 'connection');
  let newXml;
  if (destConnections.length > 0) {
    // Insert right after the last existing top-level connection block.
    const last = destConnections[destConnections.length - 1];
    const indent = indentBefore(destXml, last.start);
    const rendered = reindentBlock(block, indent, eol);
    newXml = replaceRange(destXml, last.end, last.end, `${eol}${indent}${rendered}`);
  } else {
    // No existing connections: insert before the artifact root's closing tag.
    const closeTag = destKind === 'job' ? '</job>' : '</transformation>';
    const at = destXml.lastIndexOf(closeTag);
    if (at === -1) throw new Error(`No ${closeTag} in ${destPath}`);
    const closingIndent = indentBefore(destXml, at);
    const indentStart = at - closingIndent.length;
    const indent = closingIndent + '  ';
    const rendered = reindentBlock(block, indent, eol);
    newXml = replaceRange(destXml, indentStart, at, `${indent}${rendered}${eol}${closingIndent}`);
  }

  return commitEdit(destPath, destXml, newXml);
}

/**
 * Re-emit a multi-line block under a new base indent, normalizing line endings
 * to `eol`. The block's own first line is returned WITHOUT the leading indent
 * (the caller writes that), so callers can place it after an existing indent.
 * Subsequent lines are re-based: their relative indentation to the block's
 * opening line is preserved but anchored at `baseIndent`.
 */
function reindentBlock(block, baseIndent, eol) {
  const lines = block.replace(/\r\n|\r|\n/g, '\n').split('\n');
  if (lines.length === 1) return lines[0];
  // Determine the source indent of the opening line so we can compute deltas.
  const first = lines[0];
  const firstIndentMatch = first.match(/^[ \t]*/);
  const firstIndent = firstIndentMatch ? firstIndentMatch[0] : '';
  const out = [lines[0].slice(firstIndent.length)];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^[ \t]*/);
    const lead = m ? m[0] : '';
    const rest = line.slice(lead.length);
    // Delta indentation relative to the opening line's indent.
    const delta = lead.startsWith(firstIndent) ? lead.slice(firstIndent.length) : lead;
    out.push(rest === '' ? '' : `${baseIndent}${delta}${rest}`);
  }
  return out.join(eol);
}

/** Repo-wide inventory and search across .kjb/.ktr files. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseModel, kindOf } from './model.js';
import {
  findAllSpans, findChildSpan, innerText, unescapeXml,
} from './span.js';

export function walkKettleFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '.git' && e.name !== 'node_modules') walk(p);
      } else if (/\.(ktr|kjb)$/i.test(e.name)) {
        out.push(p);
      }
    }
  })(root);
  return out.sort();
}

export function listArtifacts(root) {
  return walkKettleFiles(root).map(p => {
    // A file can vanish between the walk and these calls, so the stat must
    // degrade like the read does rather than abort the whole inventory.
    let modified;
    try {
      modified = statSync(p).mtime.toISOString();
    } catch {
      // Left undefined. Nothing is swallowed: the read below fails on the
      // same cause and reports it as this row's error.
    }
    try {
      const m = parseModel(readFileSync(p, 'utf8'), p);
      return {
        path: p, kind: m.kind, name: m.name,
        params: m.params.map(x => x.name),
        elements: m.elements.length,
        modified,
      };
    } catch (err) {
      return { path: p, error: err.message, modified };
    }
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatches(xml, query, kind, elements) {
  const out = [];
  if (kind === 'step_type' || kind === 'entry_type') {
    // Match only the element's own <type> child (via its already-located
    // span), not any <type> that happens to occur elsewhere inside the
    // element — e.g. a field's or a connection's <type> nested within it.
    for (const el of elements) {
      if (el.type !== query) continue;
      const child = findChildSpan(xml, el.span, 'type');
      if (child && !child.selfClosing) {
        out.push({ index: child.inner.start, length: child.inner.end - child.inner.start });
      }
    }
    return out;
  }
  let re;
  if (kind === 'connection') re = new RegExp(`<connection>${escapeRe(query)}</connection>`, 'gi');
  else if (kind === 'variable') re = new RegExp(`\\$\\{${escapeRe(query)}\\}`, 'g');
  else if (kind === 'table') re = new RegExp(`(?<![A-Za-z0-9_$#])${escapeRe(query)}(?![A-Za-z0-9_$#])`, 'gi');
  else re = new RegExp(escapeRe(query), 'gi'); // text
  for (const m of xml.matchAll(re)) out.push({ index: m.index, length: m[0].length });
  return out;
}

function lineOf(xml, idx) {
  let line = 1;
  for (let i = 0; i < idx; i++) if (xml.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Build a single-line excerpt (max 200 chars) around the match's containing
 * line, windowed so the matched text (idx..idx+matchLen) is always present —
 * a plain slice(0, 200) can miss the match entirely on a long line.
 */
function excerptFor(xml, idx, matchLen, maxLen = 200) {
  const s = xml.lastIndexOf('\n', idx - 1) + 1;
  let e = xml.indexOf('\n', idx);
  if (e === -1) e = xml.length;
  const raw = xml.slice(s, e);
  const trimmed = raw.trim();
  if (trimmed.length <= maxLen) return trimmed;

  const leadWs = raw.length - raw.trimStart().length;
  const matchStart = Math.max(0, Math.min(idx - s - leadWs, trimmed.length));
  const winLen = Math.min(maxLen, trimmed.length);
  const clampedMatchLen = Math.min(matchLen, winLen);
  let start = matchStart - Math.floor((winLen - clampedMatchLen) / 2);
  start = Math.max(0, Math.min(start, trimmed.length - winLen));
  return trimmed.slice(start, start + winLen);
}

const SEARCH_KINDS = ['text', 'table', 'connection', 'variable', 'step_type', 'entry_type'];

/**
 * Search across .kjb/.ktr files and return a bounded SearchReport:
 *   { matches, limit, truncated, scannedFiles, scanIssues }
 *
 * Blank queries are rejected before any filesystem traversal; only the
 * blank-detection uses a trim, the caller's original query drives matching.
 * Per-file read/parse failures are collected in scanIssues and never consume
 * a match slot. Collection stops once one match beyond the limit proves
 * truncation, so a huge tree is not scanned in full unnecessarily.
 */
export function search(root, query, kind = 'text', directory, { limit = 100 } = {}) {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new Error('search query must be a non-empty string');
  }
  if (!SEARCH_KINDS.includes(kind)) {
    throw new Error(`search kind must be one of: ${SEARCH_KINDS.join(', ')}`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('search limit must be an integer in 1..500');
  }

  const base = directory ?? root;
  const matches = [];
  const scanIssues = [];
  let scannedFiles = 0;
  let truncated = false;

  for (const file of walkKettleFiles(base)) {
    if (truncated) break;
    try {
      const fileKind = kindOf(file);
      if (kind === 'step_type' && fileKind !== 'trans') continue;
      if (kind === 'entry_type' && fileKind !== 'job') continue;
      const xml = readFileSync(file, 'utf8');
      scannedFiles++;
      const tag = fileKind === 'job' ? 'entry' : 'step';
      const elements = findAllSpans(xml, tag).map(s => ({
        span: s,
        name: unescapeXml(innerText(xml, s, 'name') ?? ''),
        type: unescapeXml(innerText(xml, s, 'type') ?? ''),
      }));
      for (const { index: idx, length: len } of findMatches(xml, query, kind, elements)) {
        if (matches.length >= limit) {
          // One match beyond the limit is enough to prove truncation; stop.
          truncated = true;
          break;
        }
        const el = elements.find(e => idx >= e.span.start && idx < e.span.end);
        matches.push({
          file,
          line: lineOf(xml, idx),
          element: el ? el.name : null,
          elementType: el ? el.type : null,
          excerpt: excerptFor(xml, idx, len),
        });
      }
    } catch (err) {
      scanIssues.push({ file, error: err.message });
    }
  }
  return { matches, limit, truncated, scannedFiles, scanIssues };
}

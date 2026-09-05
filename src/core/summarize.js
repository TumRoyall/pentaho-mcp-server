/** Compact, LLM-friendly summaries of jobs and transformations. */
import { loadModel, text } from './model.js';
import { findElementSpan } from './span.js';

const SQL_PREVIEW_LINES = 3;

function hopLabel(h, kind) {
  let s = `${h.from} -> ${h.to}`;
  if (h.enabled === 'N') s += ' [disabled]';
  if (kind === 'job') {
    if (h.unconditional === 'Y') s += ' [always]';
    else if (h.evaluation === 'Y') s += ' [on success]';
    else if (h.evaluation === 'N') s += ' [on failure]';
  }
  return s;
}

export function summarize(filePath) {
  const m = loadModel(filePath);
  return {
    kind: m.kind,
    path: m.path,
    name: m.name,
    params: m.params,
    connections: m.connections,
    elements: m.elements.map(e => {
      const out = { name: e.name, type: e.type };
      const sql = text(e.raw.sql).trim();
      if (sql) out.sqlPreview = sql.split(/\r?\n/).slice(0, SQL_PREVIEW_LINES).join('\n');
      const conn = text(e.raw.connection);
      if (conn) out.connection = conn;
      const fn = text(e.raw.filename);
      if (fn) out.filename = fn;
      return out;
    }),
    hops: m.hops.map(h => hopLabel(h, m.kind)),
  };
}

export function getElement(filePath, name, raw = false) {
  const m = loadModel(filePath);
  const el = m.elements.find(e => e.name === name);
  if (!el) {
    const tag = m.kind === 'job' ? 'entry' : 'step';
    throw new Error(
      `No ${tag} named "${name}" in ${filePath} (have: ${m.elements.map(e => e.name).join(', ')})`
    );
  }
  const out = { name: el.name, type: el.type, kind: m.kind, config: el.raw };
  if (raw) {
    const tag = m.kind === 'job' ? 'entry' : 'step';
    const span = findElementSpan(m.xml, tag, name);
    out.rawXml = m.xml.slice(span.start, span.end);
  }
  return out;
}

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const folderPattern = /^REQ_\d{3,}_[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const sections = [
  /objective and scope/i,
  /source contract/i,
  /target contract/i,
  /mapping and transformation/i,
  /load and operating/i,
  /controls.*error handling.*security/i,
  /acceptance criteria/i,
  /\bdecisions\b/i,
  /open questions/i,
  /\bevidence\b/i,
];

function finding(code, detail) { return { code, detail }; }

function parseRequirement(text) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('requirement.md needs YAML front matter');
  const docs = YAML.parseAllDocuments(match[1], { uniqueKeys: true });
  if (docs.length !== 1 || docs[0].errors.length) {
    throw new Error(docs[0]?.errors[0]?.message ?? 'invalid front matter');
  }
  const metadata = docs[0].toJSON();
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    throw new Error('front matter must be a mapping');
  }
  return { metadata, body: match[2] };
}

function splitTables(lines) {
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    rows.push(line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
  }
  return rows.length >= 2 ? rows.slice(2) : [];
}

function sectionBody(body, headingPattern) {
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  const index = matches.findIndex(match => headingPattern.test(match[1]));
  if (index < 0) return '';
  const start = matches[index].index + matches[index][0].length;
  const finish = matches[index + 1]?.index ?? body.length;
  return body.slice(start, finish);
}

export function validateRequirement(reqDir) {
  const errors = [];
  const warnings = [];
  const file = path.join(reqDir, 'requirement.md');
  if (!existsSync(file)) return { ok: false, status: 'BLOCKED', errors: [finding('FILE_MISSING', file)], warnings };
  if (!folderPattern.test(path.basename(reqDir))) errors.push(finding('FOLDER_INVALID', path.basename(reqDir)));

  let parsed;
  try { parsed = parseRequirement(readFileSync(file, 'utf8')); }
  catch (error) {
    return { ok: false, status: 'BLOCKED', errors: [finding('FRONTMATTER_INVALID', error.message)], warnings };
  }
  const { metadata, body } = parsed;
  if (metadata.artifact_type !== 'etl-requirement') errors.push(finding('ARTIFACT_TYPE_INVALID', metadata.artifact_type));
  if (metadata.requirement_id !== path.basename(reqDir)) errors.push(finding('REQUIREMENT_ID_MISMATCH', metadata.requirement_id));
  if (!Number.isInteger(metadata.revision) || metadata.revision < 1) errors.push(finding('REVISION_INVALID', metadata.revision));

  const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map(match => match[1]);
  for (const expected of sections) {
    if (!headings.some(heading => expected.test(heading))) errors.push(finding('SECTION_MISSING', expected.source));
  }
  for (const match of body.matchAll(/\{\{[^{}]*\}\}|<[A-Z][A-Z0-9_]{2,}>/g)) {
    errors.push(finding('PLACEHOLDER_LEFT', match[0]));
  }

  const evidenceDefined = new Set();
  const evidenceSection = sectionBody(body, /\bevidence\b/i);
  for (const row of splitTables(evidenceSection.split('\n'))) {
    const id = row[0]?.match(/SRC-\d{2,}/)?.[0];
    if (id) evidenceDefined.add(id);
  }
  const evidenceReferenced = new Set(body.match(/SRC-\d{2,}/g) ?? []);
  for (const id of evidenceReferenced) {
    if (!evidenceDefined.has(id)) errors.push(finding('EVIDENCE_UNDEFINED', id));
  }

  const itemDefined = new Set();
  for (const line of body.split('\n').filter(line => line.trim().startsWith('|'))) {
    const id = line.match(/\b(?:REQ-\d+-)?(?:R|AC|Q)\d{2,}\b/)?.[0];
    if (id) itemDefined.add(id.replace(/^REQ-\d+-/, ''));
  }
  const refs = new Set([...body.matchAll(/\b(?:REQ-\d+-)?(R|AC|Q)(\d{2,})\b/g)].map(m => `${m[1]}${m[2]}`));
  for (const id of refs) if (!itemDefined.has(id)) errors.push(finding('ID_UNDEFINED', id));

  const openSection = sectionBody(body, /open questions/i);
  const openRows = splitTables(openSection.split('\n'));
  if (!Number.isInteger(metadata.open_questions) || metadata.open_questions !== openRows.length) {
    errors.push(finding('OPEN_QUESTIONS_COUNT_MISMATCH', `${metadata.open_questions} != ${openRows.length}`));
  }
  const blocking = openRows.filter(row => String(row[1]).toUpperCase() === 'YES');
  if (blocking.length) errors.push(finding('BLOCKING_QUESTION', blocking.map(row => row[0]).join(', ')));

  const ok = errors.length === 0;
  return { ok, status: ok && metadata.status === 'READY_FOR_DESIGN' ? 'READY' : 'BLOCKED', metadata, errors, warnings };
}

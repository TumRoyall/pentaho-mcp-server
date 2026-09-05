import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseDocument, stringify } from 'yaml';

const STATE_FILE = 'workflow-state.yaml';

export function readWorkflowState(reqDir) {
  const file = path.join(reqDir, STATE_FILE);
  if (!existsSync(file)) return null;
  const document = parseDocument(readFileSync(file, 'utf8'), { uniqueKeys: true });
  if (document.errors.length > 0) throw new Error(`Invalid ${STATE_FILE}: ${document.errors.map(e => e.message).join('; ')}`);
  const state = document.toJS();
  if (state == null || typeof state !== 'object' || Array.isArray(state)) throw new Error(`${STATE_FILE} must be a YAML mapping`);
  if (state.schema_version !== 1) throw new Error(`${STATE_FILE} schema_version must be 1`);
  return state;
}

export function writeWorkflowState(reqDir, state) {
  if (state?.schema_version !== 1) throw new Error(`${STATE_FILE} schema_version must be 1`);
  const file = path.join(reqDir, STATE_FILE);
  const tmp = `${file}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, stringify(state, { lineWidth: 0 }), 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
  return { path: file };
}


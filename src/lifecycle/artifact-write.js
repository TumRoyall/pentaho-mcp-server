import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { unifiedDiff } from '../core/edit.js';

export function hashBytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function current(file) {
  return existsSync(file) ? readFileSync(file) : null;
}

export function writeArtifactSet(files, expectedHashes = {}) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('No artifacts supplied');
  const prepared = [];
  const seen = new Set();
  try {
    for (const item of files) {
      const file = path.resolve(item.path);
      if (seen.has(file)) throw new Error(`Duplicate artifact path: ${file}`);
      seen.add(file);
      const before = current(file);
      const actualHash = before == null ? null : hashBytes(before);
      const hasExpected = Object.hasOwn(expectedHashes, file);
      if (before != null && (!hasExpected || expectedHashes[file] !== actualHash)) {
        throw new Error(`CONCURRENT_CHANGE: ${file}`);
      }
      if (before == null && hasExpected && expectedHashes[file] != null) {
        throw new Error(`CONCURRENT_CHANGE: ${file}`);
      }
      const content = Buffer.isBuffer(item.content) ? item.content : Buffer.from(String(item.content), 'utf8');
      mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.pentaho-mcp-${process.pid}.tmp`;
      writeFileSync(temp, content);
      prepared.push({ file, temp, before, content });
    }

    for (const item of prepared) {
      const latest = current(item.file);
      const beforeHash = item.before == null ? null : hashBytes(item.before);
      const latestHash = latest == null ? null : hashBytes(latest);
      if (latestHash !== beforeHash) throw new Error(`CONCURRENT_CHANGE: ${item.file}`);
    }
    for (const item of prepared) renameSync(item.temp, item.file);
    return {
      files: prepared.map(item => ({
        path: item.file,
        hash: hashBytes(item.content),
        diff: unifiedDiff(item.before?.toString('utf8') ?? '', item.content.toString('utf8'), item.file),
      })),
    };
  } finally {
    for (const item of prepared) if (existsSync(item.temp)) rmSync(item.temp, { force: true });
  }
}

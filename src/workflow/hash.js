import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function normalizedRelative(root, file) {
  const relative = path.relative(root, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Cannot hash file outside root: ${file}`);
  }
  return relative.split(path.sep).join('/');
}

export function hashTree(files, { root = process.cwd() } = {}) {
  const records = files.map(file => ({ file: path.resolve(file), relative: normalizedRelative(path.resolve(root), path.resolve(file)) }));
  records.sort((a, b) => a.relative.localeCompare(b.relative, 'en'));
  const hash = createHash('sha256');
  for (const record of records) {
    if (!statSync(record.file).isFile()) throw new Error(`Cannot hash non-file: ${record.file}`);
    const name = Buffer.from(record.relative, 'utf8');
    const content = readFileSync(record.file);
    hash.update(String(name.length));
    hash.update(':');
    hash.update(name);
    hash.update(':');
    hash.update(String(content.length));
    hash.update(':');
    hash.update(content);
  }
  return hash.digest('hex');
}


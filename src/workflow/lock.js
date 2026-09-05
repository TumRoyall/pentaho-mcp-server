import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LOCK_FILE = '.pentaho-workflow.lock';

function lockAge(file, now) {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    const updated = Date.parse(value.updated_at);
    return Number.isFinite(updated) ? now - updated : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export async function withWorkflowLock(reqDir, callback, {
  staleAfterMs = 5 * 60_000,
  recoverStale = false,
  now = () => Date.now(),
} = {}) {
  const file = path.join(reqDir, LOCK_FILE);
  if (existsSync(file)) {
    const stale = lockAge(file, now()) > staleAfterMs;
    if (!(stale && recoverStale)) throw new Error(`Workflow is already locked: ${reqDir}`);
    rmSync(file);
  }

  let fd;
  try {
    fd = openSync(file, 'wx');
    writeFileSync(fd, JSON.stringify({ pid: process.pid, updated_at: new Date(now()).toISOString() }), 'utf8');
    closeSync(fd);
    fd = undefined;
    return await callback();
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Workflow is already locked: ${reqDir}`);
    throw error;
  } finally {
    if (fd != null) closeSync(fd);
    if (existsSync(file)) rmSync(file);
  }
}


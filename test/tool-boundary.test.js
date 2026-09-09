import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { symlinkSync } from 'node:fs';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { buildTools } from '../src/tools/registry.js';
import { makeContext } from '../src/server.js';
import { runtimeTools } from '../src/tools/runtime.tools.js';
import { artifactTools } from '../src/tools/artifact.tools.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (...p) => path.join(here, 'fixtures', ...p);

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function scratch() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-tool-boundary-'));
  dirs.push(root);
  copyFileSync(fx('mini.ktr'), path.join(root, 'mini.ktr'));
  copyFileSync(fx('mini.kjb'), path.join(root, 'mini.kjb'));
  const outside = mkdtempSync(path.join(os.tmpdir(), 'kettle-outside-'));
  dirs.push(outside);
  copyFileSync(fx('mini.ktr'), path.join(outside, 'mini.ktr'));
  copyFileSync(fx('mini.kjb'), path.join(outside, 'mini.kjb'));
  return { root, outside };
}

function toolMap(root) {
  const context = createWorkspaceBoundary(root);
  return new Map(buildTools(context).map(tool => [tool.name, tool]));
}

// Handlers may throw synchronously (at the resolver) or return a rejected
// promise; normalize both into a promise so assert.rejects always applies.
const invoke = (tool, args) => Promise.resolve().then(() => tool.handler(args));

test('kettle_summary succeeds for a relative in-root file', async () => {
  const { root } = scratch();
  const tools = toolMap(root);
  const data = await invoke(tools.get('kettle_summary'), { path: 'mini.ktr' });
  assert.equal(data.name, 'mini');
});

test('kettle_summary rejects an absolute outside file', async () => {
  const { root, outside } = scratch();
  const tools = toolMap(root);
  await assert.rejects(
    () => invoke(tools.get('kettle_summary'), { path: path.join(outside, 'mini.ktr') }),
    /outside KETTLE_ROOT/i,
  );
});

test('read/validate/coverage tools reject an outside directory or path', async () => {
  const { root, outside } = scratch();
  const tools = toolMap(root);
  await assert.rejects(() => invoke(tools.get('kettle_list'), { directory: outside }), /outside KETTLE_ROOT/i);
  await assert.rejects(
    () => invoke(tools.get('kettle_search'), { query: 'x', directory: outside }),
    /outside KETTLE_ROOT/i,
  );
  await assert.rejects(
    () => invoke(tools.get('kettle_validate'), { path: path.join(outside, 'mini.ktr') }),
    /outside KETTLE_ROOT/i,
  );
  await assert.rejects(
    () => invoke(tools.get('kettle_knowledge_coverage'), { directory: outside }),
    /outside KETTLE_ROOT/i,
  );
});

test('kettle_set_field rejects an outside file and leaves it unchanged', async () => {
  const { root, outside } = scratch();
  const tools = toolMap(root);
  const target = path.join(outside, 'mini.ktr');
  const before = readFileSync(target);
  await assert.rejects(
    () => invoke(tools.get('kettle_set_field'), { path: target, name: 'in', field: 'connection', value: 'conn_b' }),
    /outside KETTLE_ROOT/i,
  );
  assert.deepEqual(readFileSync(target), before);
});

test('kettle_create_file rejects an outside destination and creates no file', async () => {
  const { root, outside } = scratch();
  const tools = toolMap(root);
  const dest = path.join(outside, 'new.ktr');
  await assert.rejects(() => invoke(tools.get('kettle_create_file'), { path: dest }), /outside KETTLE_ROOT/i);
  assert.equal(existsSync(dest), false);
});

function runtimeMap(root) {
  const tools = runtimeTools(makeContext({ root, pentahoHome: null }));
  return new Map(tools.map(tool => [tool.name, tool]));
}

test('kettle_runtime_logs schema accepts optional name and a bounded limit', () => {
  const { root } = scratch();
  const logs = runtimeMap(root).get('kettle_runtime_logs');
  const props = logs.inputSchema.properties;
  assert.equal(props.name.type, 'string');
  assert.equal(props.limit.type, 'integer');
  assert.equal(props.limit.minimum, 1);
  assert.equal(props.limit.maximum, 100);
  assert.equal(Array.isArray(logs.inputSchema.required), false);
});

test('kettle_runtime_logs returns newest-first, honours limit, and bounds each file to 256 KiB', () => {
  const { root } = scratch();
  const logsDir = path.join(root, '.pentaho-mcp', 'runtime-logs');
  mkdirSync(logsDir, { recursive: true });
  // Older then newer, so the newest name sorts last lexicographically.
  const older = '1000-job-execute.log';
  const newer = '2000-job-execute.log';
  writeFileSync(path.join(logsDir, older), 'old-body');
  writeFileSync(path.join(logsDir, newer), 'B'.repeat(300 * 1024));
  const logs = runtimeMap(root).get('kettle_runtime_logs');
  const result = invokeSync(logs, { limit: 1 });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].name, newer);
  assert.ok(Buffer.byteLength(result.files[0].content, 'utf8') <= 256 * 1024);
});

test('kettle_runtime_logs can select a single log by name', () => {
  const { root } = scratch();
  const logsDir = path.join(root, '.pentaho-mcp', 'runtime-logs');
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(path.join(logsDir, '1000-job-execute.log'), 'one');
  writeFileSync(path.join(logsDir, '2000-job-execute.log'), 'two');
  const logs = runtimeMap(root).get('kettle_runtime_logs');
  const result = invokeSync(logs, { name: '1000-job-execute.log' });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].name, '1000-job-execute.log');
  assert.equal(result.files[0].content, 'one');
});

test('kettle_runtime_logs rejects a name that escapes the logs directory', () => {
  const { root } = scratch();
  mkdirSync(path.join(root, '.pentaho-mcp', 'runtime-logs'), { recursive: true });
  const logs = runtimeMap(root).get('kettle_runtime_logs');
  assert.throws(() => invokeSync(logs, { name: '..\\..\\escape.log' }), /log/i);
});

const invokeSync = (tool, args) => tool.handler(args);

test('runtime loadcheck/execute reject outside and non-Kettle artifacts before spawning', async () => {
  const { root, outside } = scratch();
  const tools = runtimeMap(root);
  const loadcheck = tools.get('kettle_runtime_loadcheck');
  const execute = tools.get('kettle_runtime_execute');
  await assert.rejects(
    () => invoke(loadcheck, { artifact: '../outside.kjb' }),
    /outside KETTLE_ROOT/i,
  );
  await assert.rejects(
    () => invoke(execute, { artifact: path.join(outside, 'mini.kjb'), confirmed: true }),
    /outside KETTLE_ROOT/i,
  );
  await assert.rejects(
    () => invoke(loadcheck, { artifact: 'notes.txt' }),
    /must end in \.kjb or \.ktr/i,
  );
});

test('runtime tools reject an in-root link that resolves to an outside artifact', t => {
  const { root, outside } = scratch();
  const link = path.join(root, 'external');
  try {
    symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (err) {
    if (['EPERM', 'EACCES', 'UNKNOWN'].includes(err.code)) {
      t.skip(`cannot create link on this platform: ${err.code}`);
      return;
    }
    throw err;
  }
  const tools = runtimeMap(root);
  return assert.rejects(
    () => invoke(tools.get('kettle_runtime_loadcheck'), { artifact: path.join('external', 'mini.kjb') }),
    /outside KETTLE_ROOT/i,
  );
});

test('kettle_clone rejects an outside source and independently an outside destination', async () => {
  const { root, outside } = scratch();
  const tools = toolMap(root);
  await assert.rejects(
    () => invoke(tools.get('kettle_clone'), {
      sourcePath: path.join(outside, 'mini.ktr'),
      destPath: 'clone.ktr',
      name: 'clone',
    }),
    /outside KETTLE_ROOT/i,
  );
  assert.equal(existsSync(path.join(root, 'clone.ktr')), false);
  await assert.rejects(
    () => invoke(tools.get('kettle_clone'), {
      sourcePath: 'mini.ktr',
      destPath: path.join(outside, 'clone.ktr'),
      name: 'clone',
    }),
    /outside KETTLE_ROOT/i,
  );
  assert.equal(existsSync(path.join(outside, 'clone.ktr')), false);
});

// The artifact tools are not yet in the global registry (the coordinator wires
// that in a later integration task), so build them directly from the factory
// with the shared boundary to prove both source and destination paths are
// enforced.
function artifactMap(root) {
  const context = createWorkspaceBoundary(root);
  return new Map(artifactTools(context).map(tool => [tool.name, tool]));
}

test('kettle_set_parameters rejects an outside file and leaves it unchanged', async () => {
  const { root, outside } = scratch();
  const tools = artifactMap(root);
  const target = path.join(outside, 'mini.ktr');
  const before = readFileSync(target);
  await assert.rejects(
    () => invoke(tools.get('kettle_set_parameters'), {
      path: target,
      parameters: [{ name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' }],
    }),
    /outside KETTLE_ROOT/i,
  );
  assert.deepEqual(readFileSync(target), before);
});

test('kettle_copy_connection rejects an outside source and independently an outside destination', async () => {
  const { root, outside } = scratch();
  const tools = artifactMap(root);
  // Outside source is refused before any destination write.
  await assert.rejects(
    () => invoke(tools.get('kettle_copy_connection'), {
      sourcePath: path.join(outside, 'mini.ktr'),
      destPath: 'mini.kjb',
      sourceName: 'conn_a',
      destName: 'conn_copy',
    }),
    /outside KETTLE_ROOT/i,
  );
  const destBefore = readFileSync(path.join(root, 'mini.kjb'));
  assert.deepEqual(readFileSync(path.join(root, 'mini.kjb')), destBefore);
  // Outside destination is refused independently.
  const target = path.join(outside, 'mini.kjb');
  const targetBefore = readFileSync(target);
  await assert.rejects(
    () => invoke(tools.get('kettle_copy_connection'), {
      sourcePath: 'mini.ktr',
      destPath: target,
      sourceName: 'conn_a',
      destName: 'conn_copy',
    }),
    /outside KETTLE_ROOT/i,
  );
  assert.deepEqual(readFileSync(target), targetBefore);
});

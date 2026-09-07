import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { symlinkSync } from 'node:fs';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { buildTools } from '../src/tools/registry.js';
import { makeContext } from '../src/server.js';
import { runtimeTools } from '../src/tools/runtime.tools.js';

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

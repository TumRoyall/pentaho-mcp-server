import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { buildTools } from '../src/tools/registry.js';
import { makeContext } from '../src/server.js';
import { validateToolArguments } from '../src/tools/schema.js';
import { SERVER_VERSION } from '../src/version.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(here);

function rpc(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

/** Recursively assert every object schema declares additionalProperties, with
 *  the single intentional exception of the runtime `parameters` string-map. */
function assertClosedObjectSchemas(schema, pathLabel) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') {
    // Intentional open string-value maps (additionalProperties is a
    // {type:'string'} schema, not `false`) are allowed: the runtime
    // `parameters` map and the set_fields item maps. Every other object schema
    // must explicitly reject unknown properties.
    const isStringValueMap =
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object' &&
      schema.additionalProperties.type === 'string';
    if (isStringValueMap) return;
    assert.equal(
      schema.additionalProperties, false,
      `${pathLabel} must declare additionalProperties:false`,
    );
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      assertClosedObjectSchemas(child, `${pathLabel}.${key}`);
    }
  }
  if (schema.type === 'array' && schema.items) {
    assertClosedObjectSchemas(schema.items, `${pathLabel}[]`);
  }
}

// -- Step 1: title, annotations, closed object schemas on EVERY tool ---------

test('every tool declares title, annotations, and an object input schema', () => {
  const tools = buildTools(makeContext({ root: repoRoot }));
  assert.ok(tools.length > 0);
  for (const tool of tools) {
    assert.equal(typeof tool.title, 'string', `${tool.name} missing title`);
    assert.ok(tool.title.length > 0, `${tool.name} empty title`);
    assert.ok(tool.annotations && typeof tool.annotations === 'object', `${tool.name} missing annotations`);
    assert.equal(typeof tool.annotations.title, 'string', `${tool.name} annotations.title`);
    assert.equal(tool.inputSchema?.type, 'object', `${tool.name} input schema must be an object`);
  }
});

test('every object schema rejects unknown properties except the runtime parameters map', () => {
  const tools = buildTools(makeContext({ root: repoRoot }));
  for (const tool of tools) {
    assertClosedObjectSchemas(tool.inputSchema, `${tool.name}$`);
  }
});

test('read-only tools carry readOnlyHint, runtime execute is destructive+openWorld', () => {
  const tools = buildTools(makeContext({ root: repoRoot }));
  const byName = new Map(tools.map(t => [t.name, t]));
  const readOnly = [
    'kettle_list', 'kettle_summary', 'kettle_get_element', 'kettle_search',
    'kettle_validate', 'kettle_knowledge_list', 'kettle_knowledge_get',
    'kettle_knowledge_coverage', 'kettle_knowledge_analyze_xml',
    'kettle_runtime_detect', 'kettle_runtime_logs',
  ];
  for (const name of readOnly) {
    assert.equal(byName.get(name).annotations.readOnlyHint, true, `${name} should be read-only`);
  }
  const exec = byName.get('kettle_runtime_execute');
  assert.equal(exec.annotations.readOnlyHint ?? false, false);
  assert.equal(exec.annotations.destructiveHint, true);
  assert.equal(exec.annotations.openWorldHint, true);
  // Mutating edit tools are not read-only.
  assert.equal(byName.get('kettle_set_field').annotations.readOnlyHint ?? false, false);
});

// -- Step 1: isError semantics over stdio ------------------------------------

test('stdio: missing file, unknown tool, and bad arguments all set isError', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-contract-'));
  copyFileSync(path.join(here, 'fixtures', 'mini.ktr'), path.join(root, 'mini.ktr'));
  const proc = spawn(process.execPath, [path.join(repoRoot, 'src', 'index.js')], {
    env: { ...process.env, KETTLE_ROOT: root },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stdin.write([
    rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'c', version: '1' } }),
    rpc(2, 'tools/call', { name: 'kettle_summary', arguments: { path: 'nope.ktr' } }),
    rpc(3, 'tools/call', { name: 'kettle_does_not_exist', arguments: {} }),
    rpc(4, 'tools/call', { name: 'kettle_search', arguments: { query: 'x', limit: 9999 } }),
    rpc(5, 'tools/call', { name: 'kettle_summary', arguments: { path: 'mini.ktr' } }),
  ].join('\n') + '\n');
  proc.stdin.end();
  try {
    let out = '';
    for await (const chunk of proc.stdout) out += chunk;
    const responses = out.split('\n').filter(l => l.trim().startsWith('{')).map(l => JSON.parse(l));

    const missing = responses.find(r => r.id === 2);
    assert.equal(missing.result.isError, true);
    assert.equal(JSON.parse(missing.result.content[0].text).ok, false);

    const unknown = responses.find(r => r.id === 3);
    assert.equal(unknown.result.isError, true);
    assert.equal(JSON.parse(unknown.result.content[0].text).ok, false);

    const badArgs = responses.find(r => r.id === 4);
    assert.equal(badArgs.result.isError, true);
    const badPayload = JSON.parse(badArgs.result.content[0].text);
    assert.equal(badPayload.ok, false);
    assert.match(badPayload.error, /kettle_search/);
    assert.match(badPayload.error, /\$\.limit/);

    const ok = responses.find(r => r.id === 5);
    assert.equal(ok.result.isError ?? false, false);
    assert.equal(JSON.parse(ok.result.content[0].text).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// -- Step 3: argument validation unit coverage -------------------------------

test('validateToolArguments returns deterministic path-qualified messages', () => {
  const tool = {
    name: 'kettle_search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        kind: { type: 'string', enum: ['text', 'table'] },
        limit: { type: 'integer', minimum: 1, maximum: 500 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  };
  assert.equal(validateToolArguments(tool, { query: 'a' }), null);
  assert.match(validateToolArguments(tool, {}), /Invalid arguments for kettle_search: \$\.query is required/);
  assert.match(validateToolArguments(tool, { query: '' }), /\$\.query/);
  assert.match(validateToolArguments(tool, { query: 'a', limit: 9999 }), /\$\.limit must be an integer between 1 and 500/);
  assert.match(validateToolArguments(tool, { query: 'a', kind: 'bogus' }), /\$\.kind must be one of/);
  assert.match(validateToolArguments(tool, { query: 'a', extra: 1 }), /\$\.extra is not an allowed property/);
});

test('validateToolArguments allows the open runtime parameters string-map', () => {
  const tool = {
    name: 'kettle_runtime_execute',
    inputSchema: {
      type: 'object',
      properties: {
        artifact: { type: 'string' },
        parameters: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['artifact'],
      additionalProperties: false,
    },
  };
  assert.equal(validateToolArguments(tool, { artifact: 'a.ktr', parameters: { RUN_DATE: '2026-09-09' } }), null);
  assert.match(
    validateToolArguments(tool, { artifact: 'a.ktr', parameters: { RUN_DATE: 5 } }),
    /\$\.parameters\.RUN_DATE must be a string/,
  );
});

// -- Step 5: source-mode version fallback ------------------------------------

test('SERVER_VERSION falls back to the package version in source mode', () => {
  assert.equal(SERVER_VERSION, '0.1.0');
});

// -- Step 5: build-mode version injection through build-release define -------
//
// This drives the real Windows SEA build so it proves the esbuild `define`
// for __PENTAHO_MCP_VERSION__ reaches serverInfo.version end-to-end. It runs
// in an isolated copy of the project so it never races the packaging test's
// build over the shared build/ and dist/ directories (both write there), which
// is what makes the full `node --test` suite deterministic on Windows.

test('build-release injects the requested version into serverInfo', () => {
  const requested = '1.2.3';
  const work = mkdtempSync(path.join(os.tmpdir(), 'kettle-build-'));
  try {
    for (const entry of ['src', 'scripts', 'packaging', 'skills', 'README.md', 'package.json']) {
      cpSync(path.join(repoRoot, entry), path.join(work, entry), { recursive: true });
    }
    // esbuild and postject are resolved by name from the copy's tree; a Windows
    // directory junction to the repo's node_modules is cheap and needs no admin,
    // unlike copying the whole tree.
    symlinkSync(path.join(repoRoot, 'node_modules'), path.join(work, 'node_modules'), 'junction');

    const build = spawnSync(
      process.execPath,
      ['scripts/build-release.mjs', '--version', requested],
      { cwd: work, encoding: 'utf8', timeout: 180_000 },
    );
    assert.equal(build.status, 0, build.stderr || build.stdout);

    const exe = path.join(work, 'build', 'dte-pentaho-mcp.exe');
    const res = spawnSync(exe, [], {
      input: rpc(1, 'initialize', {
        protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'v', version: '1' },
      }) + '\n',
      encoding: 'utf8',
      timeout: 60_000,
    });
    const responses = (res.stdout || '').split(/\r?\n/).filter(l => l.startsWith('{')).map(JSON.parse);
    const info = responses.find(r => r.id === 1)?.result?.serverInfo;
    assert.ok(info, 'no serverInfo in initialize response');
    assert.equal(info.version, requested);
  } finally {
    // Drop the node_modules junction first so recursive cleanup never touches
    // the repo's real dependency tree, then remove the isolated work dir.
    try { rmSync(path.join(work, 'node_modules'), { recursive: false, force: true }); } catch { /* ignore */ }
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

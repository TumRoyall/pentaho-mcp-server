import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectPdi } from '../src/runtime/detect.js';
import { executionPolicy } from '../src/runtime/policy.js';
import { runPdi } from '../src/runtime/run.js';
import { runtimeTools } from '../src/tools/runtime.tools.js';
import { createTailBuffer } from '../src/runtime/tail-buffer.js';
import { assertSafeWindowsToken, assertParameterName } from '../src/runtime/windows-args.js';

test('createTailBuffer retains only the last maxBytes across many appends', () => {
  const buffer = createTailBuffer(8);
  buffer.append('12345');
  buffer.append('6789');
  buffer.append('ABCD');
  assert.equal(Buffer.byteLength(buffer.value(), 'utf8') <= 8, true);
  assert.equal(buffer.value(), '6789ABCD');
});

test('assertSafeWindowsToken rejects metacharacters and accepts ordinary paths', () => {
  for (const value of ['x"y', 'x&y', 'x|y', 'x<y', 'x>y', 'x^y', 'x%y', 'x!y', 'x\ry', 'x\ny', 'x\0y']) {
    assert.throws(() => assertSafeWindowsToken(value, 'test'), /unsafe Windows shell token/i);
  }
  assert.doesNotThrow(() => assertSafeWindowsToken('C:\\Program Files\\pentaho\\job with spaces.kjb', 'artifact'));
  assert.doesNotThrow(() => assertSafeWindowsToken('2026-09-09,value.thing_1', 'value'));
});

test('assertParameterName enforces the identifier pattern', () => {
  for (const good of ['RUN_DATE', '_x', 'a.b-c', 'A1']) assert.doesNotThrow(() => assertParameterName(good));
  for (const bad of ['1bad', 'has space', 'bad$', '']) assert.throws(() => assertParameterName(bad), /parameter name/i);
});

function fakePdi() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fake pdi '));
  writeFileSync(path.join(root, 'Kitchen.bat'), '@echo off\r\n');
  writeFileSync(path.join(root, 'Pan.bat'), '@echo off\r\n');
  return root;
}

function spawnResult({ stdout = '', stderr = '', code = 0, hang = false, chunks = null } = {}, capture = {}) {
  return (command, args, options) => {
    Object.assign(capture, { command, args, options });
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = signal => { child.emit('close', null, signal ?? 'SIGTERM'); return true; };
    process.nextTick(() => {
      if (chunks) {
        for (const chunk of chunks.stdout ?? []) child.stdout.write(chunk);
        for (const chunk of chunks.stderr ?? []) child.stderr.write(chunk);
        child.stdout.end(); child.stderr.end();
      } else {
        child.stdout.end(stdout); child.stderr.end(stderr);
      }
      if (!hang) child.emit('close', code, null);
    });
    return child;
  };
}

// Minimal in-root workspace with a real .kjb/.ktr so runPdi can resolve and
// statically validate the artifact before it ever consults the fake spawn.
function workspaceArtifact(kind = 'job') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-args-'));
  const artifact = path.join(root, kind === 'trans' ? 'a.ktr' : 'a.kjb');
  const xml = kind === 'trans'
    ? '<?xml version="1.0"?><transformation><info><name>x</name></info><order/></transformation>'
    : '<?xml version="1.0"?><job><name>x</name><entries><entry><name>Start</name><type>SPECIAL</type><start>Y</start></entry></entries><hops/></job>';
  writeFileSync(artifact, xml);
  return { root, artifact };
}

test('detects Kitchen/Pan only beneath PENTAHO_HOME', () => {
  const home = fakePdi();
  const result = detectPdi(home);
  assert.equal(result.available, true);
  assert.equal(result.kitchen, path.join(home, 'Kitchen.bat'));
  assert.equal(result.pan, path.join(home, 'Pan.bat'));
  assert.deepEqual(detectPdi(null), {
    available: false,
    reason: 'PENTAHO_HOME is not configured',
    kitchen: null,
    pan: null,
  });
  assert.throws(() => detectPdi(path.join(home, '..', 'missing')), /not found/i);
});

test('execution policy requires both server opt-in and per-call confirmation', () => {
  assert.equal(executionPolicy({ confirmed: false, executeEnabled: false }), 'EXECUTE_DISABLED');
  assert.equal(executionPolicy({ confirmed: true, executeEnabled: false }), 'EXECUTE_DISABLED');
  assert.equal(executionPolicy({ confirmed: false, executeEnabled: true }), 'CONFIRM_REQUIRED');
  assert.equal(executionPolicy({ confirmed: true, executeEnabled: true }), 'ALLOW');
  assert.equal(executionPolicy({}), 'EXECUTE_DISABLED');
});

test('runtime rejects unsafe Windows shell tokens before starting a child', async () => {
  const home = fakePdi();
  for (const value of ['x"y', 'x&y', 'x|y', 'x<y', 'x>y', 'x^y', 'x%PATH%', 'x!y', 'x\ny']) {
    const { artifact } = workspaceArtifact('job');
    let called = false;
    await assert.rejects(
      () => runPdi(
        { kind: 'job', artifact, mode: 'execute', confirmed: true, timeoutMs: 1000, parameters: { RUN_DATE: value } },
        { pentahoHome: home, executeEnabled: true, spawnImpl: () => { called = true; } },
      ),
      /unsafe Windows shell token/i,
    );
    assert.equal(called, false);
  }
});

test('runtime rejects parameter names that are not identifiers', async () => {
  const home = fakePdi();
  const { artifact } = workspaceArtifact('job');
  let called = false;
  await assert.rejects(
    () => runPdi(
      { kind: 'job', artifact, mode: 'execute', confirmed: true, timeoutMs: 1000, parameters: { '1bad': 'ok' } },
      { pentahoHome: home, executeEnabled: true, spawnImpl: () => { called = true; } },
    ),
    /parameter name/i,
  );
  assert.equal(called, false);
});

test('runtime returns EXECUTE_DISABLED before detection/spawn unless the server opts in', async () => {
  let called = false;
  let detected = false;
  const blocked = await runPdi(
    { kind: 'job', artifact: 'x.kjb', mode: 'execute', confirmed: true },
    {
      pentahoHome: '/does/not/matter',
      executeEnabled: false,
      spawnImpl: () => { called = true; },
      detection: (detected = true, undefined),
    },
  );
  assert.deepEqual(blocked, { status: 'EXECUTE_DISABLED' });
  assert.equal(called, false);
});

test('runtime keeps CONFIRM_REQUIRED distinct when enabled but unconfirmed', async () => {
  const home = fakePdi();
  let called = false;
  const blocked = await runPdi(
    { kind: 'job', artifact: 'x.kjb', mode: 'execute' },
    { pentahoHome: home, executeEnabled: true, spawnImpl: () => { called = true; } },
  );
  assert.deepEqual(blocked, { status: 'CONFIRM_REQUIRED' });
  assert.equal(called, false);
});

test('runtime bounds stdout/stderr to 256 KiB tails while streaming', async () => {
  const home = fakePdi();
  const { root, artifact } = workspaceArtifact('trans');
  const prefix = 'PREFIX_MARKER';
  const tail = 'TAIL_MARKER';
  // >256 KiB total delivered as many chunks; only the last 256 KiB survive.
  const filler = 'A'.repeat(200_000);
  const report = await runPdi(
    { kind: 'trans', artifact, mode: 'execute', confirmed: true, timeoutMs: 1000 },
    {
      pentahoHome: home, logsDir: path.join(root, 'logs'), executeEnabled: true,
      spawnImpl: spawnResult({ chunks: {
        stdout: [prefix, filler, filler, tail],
        stderr: [prefix, filler, filler, tail],
      } }),
    },
  );
  assert.equal(report.status, 'PASS');
  assert.ok(Buffer.byteLength(report.stdout, 'utf8') <= 256 * 1024);
  assert.ok(Buffer.byteLength(report.stderr, 'utf8') <= 256 * 1024);
  assert.match(report.stdout, /TAIL_MARKER/);
  assert.doesNotMatch(report.stdout, /PREFIX_MARKER/);
  assert.match(report.stderr, /TAIL_MARKER/);
  assert.doesNotMatch(report.stderr, /PREFIX_MARKER/);
});

test('runtime timeout uses the injectable terminate and never sends a real signal', async () => {
  const home = fakePdi();
  const { root, artifact } = workspaceArtifact('trans');
  let terminatedPid = null;
  const timed = await runPdi(
    { kind: 'trans', artifact, mode: 'execute', timeoutMs: 10, confirmed: true },
    {
      pentahoHome: home, logsDir: path.join(root, 'logs'), executeEnabled: true,
      spawnImpl: spawnResult({ hang: true }),
      terminate: child => { terminatedPid = child.pid; child.emit('close', null, 'SIGTERM'); },
    },
  );
  assert.equal(timed.status, 'TIMEOUT');
  assert.equal(terminatedPid, 4242);
});

test('runtime preserves spaced arguments, shells out for .bat on Windows only, redacts secrets, and writes sanitized logs', async () => {
  const home = fakePdi();
  const root = mkdtempSync(path.join(os.tmpdir(), 'runtime work '));
  const artifact = path.join(root, 'job with spaces.kjb');
  const logsDir = path.join(root, 'logs');
  writeFileSync(artifact, '<?xml version="1.0"?><job><name>x</name><entries><entry><name>Start</name><type>SPECIAL</type><start>Y</start></entry></entries><hops/></job>');
  const capture = {};
  const report = await runPdi({
    kind: 'job', artifact, parameters: { INPUT_DATE: '20260904', DB_PASSWORD: 'top-secret' }, mode: 'execute', timeoutMs: 1000, confirmed: true,
  }, {
    pentahoHome: home, logsDir, executeEnabled: true,
    spawnImpl: spawnResult({ stdout: 'password=top-secret\nDone', code: 0 }, capture),
  });
  assert.equal(report.status, 'PASS');
  const kitchen = path.join(home, 'Kitchen.bat');
  if (process.platform === 'win32') {
    // On Windows, .bat files must run through the shell (Node EINVAL guard),
    // so command and args are quoted and shell is enabled.
    assert.equal(capture.command, `"${kitchen}"`);
    assert.ok(capture.args.includes(`"/file:${artifact}"`));
    assert.ok(capture.args.includes('"/param:DB_PASSWORD=top-secret"'));
    assert.equal(capture.options.shell, true);
  } else {
    // Elsewhere the batch launcher runs directly without a shell.
    assert.equal(capture.command, kitchen);
    assert.ok(capture.args.includes(`/file:${artifact}`));
    assert.ok(capture.args.includes('/param:DB_PASSWORD=top-secret'));
    assert.equal(capture.options.shell, false);
  }
  assert.doesNotMatch(report.stdout, /top-secret/);
  assert.match(report.stdout, /\[REDACTED\]/);
  assert.doesNotMatch(readFileSync(report.logFile, 'utf8'), /top-secret/);
});

test('runtime reports confirmation requirement and timeout without executing unsafely', async () => {
  const home = fakePdi();
  let called = false;
  const blocked = await runPdi({ kind: 'job', artifact: 'x.kjb', mode: 'execute' }, {
    pentahoHome: home, executeEnabled: true,
    spawnImpl: () => { called = true; },
  });
  assert.deepEqual(blocked, { status: 'CONFIRM_REQUIRED' });
  assert.equal(called, false);

  const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-timeout-'));
  const artifact = path.join(root, 'x.ktr');
  writeFileSync(artifact, '<?xml version="1.0"?><transformation><info><name>x</name></info><order/></transformation>');
  const timed = await runPdi({ kind: 'trans', artifact, mode: 'execute', timeoutMs: 10, confirmed: true }, {
    pentahoHome: home, logsDir: path.join(root, 'logs'), executeEnabled: true,
    spawnImpl: spawnResult({ hang: true }),
    terminate: child => child.emit('close', null, 'SIGTERM'),
  });
  assert.equal(timed.status, 'TIMEOUT');
});

test('runtime factory exposes detect, loadcheck, execute, and logs tools', () => {
  assert.deepEqual(runtimeTools({}).map(tool => tool.name), [
    'kettle_runtime_detect', 'kettle_runtime_loadcheck', 'kettle_runtime_execute', 'kettle_runtime_logs',
  ]);
});

test('runtime tools use the server root without project-selection arguments', () => {
  const root = path.resolve('C:/project');
  const tools = runtimeTools({
    root,
    pentahoHome: 'C:/Pentaho/data-integration',
    resolveRead: value => path.resolve(root, value),
  });
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  assert.deepEqual(byName.get('kettle_runtime_detect').inputSchema, {
    // Task 9 closes every tool's top-level object schema; detect still takes no
    // arguments, and additionalProperties:false now enforces exactly that.
    type: 'object', properties: {}, additionalProperties: false,
  });
  const logsSchema = byName.get('kettle_runtime_logs').inputSchema;
  assert.equal(logsSchema.properties.name.type, 'string');
  assert.equal(logsSchema.properties.limit.maximum, 100);
  assert.equal(Object.hasOwn(logsSchema.properties, 'workspaceRoot'), false);
  for (const name of ['kettle_runtime_loadcheck', 'kettle_runtime_execute']) {
    const schema = byName.get(name).inputSchema;
    assert.deepEqual(schema.required, ['artifact']);
    assert.equal(Object.hasOwn(schema.properties, 'workspaceRoot'), false);
    assert.equal(Object.hasOwn(schema.properties, 'requirementFolder'), false);
  }
});

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

function fakePdi() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fake pdi '));
  writeFileSync(path.join(root, 'Kitchen.bat'), '@echo off\r\n');
  writeFileSync(path.join(root, 'Pan.bat'), '@echo off\r\n');
  return root;
}

function spawnResult({ stdout = '', stderr = '', code = 0, hang = false } = {}, capture = {}) {
  return (command, args, options) => {
    Object.assign(capture, { command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.emit('close', null, 'SIGTERM'); return true; };
    process.nextTick(() => {
      child.stdout.end(stdout); child.stderr.end(stderr);
      if (!hang) child.emit('close', code, null);
    });
    return child;
  };
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

test('execution policy always requires explicit confirmation', () => {
  assert.equal(executionPolicy(), 'CONFIRM_REQUIRED');
  assert.equal(executionPolicy(false), 'CONFIRM_REQUIRED');
  assert.equal(executionPolicy(true), 'ALLOW');
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
    pentahoHome: home, logsDir,
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
    pentahoHome: home,
    spawnImpl: () => { called = true; },
  });
  assert.deepEqual(blocked, { status: 'CONFIRM_REQUIRED' });
  assert.equal(called, false);

  const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-timeout-'));
  const artifact = path.join(root, 'x.ktr');
  writeFileSync(artifact, '<?xml version="1.0"?><transformation><info><name>x</name></info><order/></transformation>');
  const timed = await runPdi({ kind: 'trans', artifact, mode: 'execute', timeoutMs: 10, confirmed: true }, {
    pentahoHome: home, logsDir: path.join(root, 'logs'),
    spawnImpl: spawnResult({ hang: true }),
  });
  assert.equal(timed.status, 'TIMEOUT');
});

test('runtime factory exposes detect, loadcheck, execute, and logs tools', () => {
  assert.deepEqual(runtimeTools({}).map(tool => tool.name), [
    'kettle_runtime_detect', 'kettle_runtime_loadcheck', 'kettle_runtime_execute', 'kettle_runtime_logs',
  ]);
});

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateFile } from '../core/validate.js';
import { detectPdi } from './detect.js';
import { executionPolicy } from './policy.js';
import { redact } from './redact.js';
import { createTailBuffer } from './tail-buffer.js';
import { assertSafeWindowsToken, assertParameterName } from './windows-args.js';

const MAX_STREAM_BYTES = 256 * 1024;
const TERMINATE_GRACE_MS = 2000;

/**
 * Default process-tree-aware terminator.
 *
 * On Windows a batch launcher spawns a JVM child; killing only the .bat leaves
 * the JVM orphaned, so we ask taskkill to tear down the whole tree by PID with
 * `shell:false`. Elsewhere we escalate SIGTERM -> SIGKILL after a short grace
 * so a well-behaved process can exit cleanly first.
 */
function defaultTerminate(child) {
  if (process.platform === 'win32') {
    if (child.pid != null) {
      spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true });
    } else {
      child.kill();
    }
    return;
  }
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, TERMINATE_GRACE_MS).unref?.();
}

function execute(command, args, options, spawnImpl, timeoutMs, terminate) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, options);
    const stdout = createTailBuffer(MAX_STREAM_BYTES);
    const stderr = createTailBuffer(MAX_STREAM_BYTES);
    let timedOut = false; let settled = false;
    const clear = () => { if (timer) clearTimeout(timer); };
    child.stdout?.on('data', chunk => stdout.append(chunk));
    child.stderr?.on('data', chunk => stderr.append(chunk));
    child.on('error', err => { if (settled) return; settled = true; clear(); reject(err); });
    const timer = setTimeout(() => {
      timedOut = true;
      terminate(child);
    }, timeoutMs);
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true; clear();
      resolve({ code, signal, stdout: stdout.value(), stderr: stderr.value(), timedOut });
    });
  });
}

export async function runPdi(request, context) {
  if (request.mode === 'execute') {
    const decision = executionPolicy({ confirmed: request.confirmed, executeEnabled: context.executeEnabled });
    if (decision === 'EXECUTE_DISABLED') return { status: 'EXECUTE_DISABLED' };
    if (decision !== 'ALLOW') return { status: 'CONFIRM_REQUIRED' };
  }
  const detection = context.detection ?? detectPdi(context.pentahoHome);
  if (!detection.available) return { status: 'UNAVAILABLE', detection };
  const artifact = path.resolve(request.artifact);
  if (request.mode === 'execute' || request.mode === 'loadcheck') {
    const structural = validateFile(artifact);
    if (structural.summary.errors) return { status: 'STATIC_VALIDATION_FAILED', structural };
  }
  const command = request.kind === 'trans' ? detection.pan : detection.kitchen;
  const args = [`/file:${artifact}`, '/norep', '/level:Basic'];
  if (request.mode === 'loadcheck') args.push('/listparam');
  for (const [key, value] of Object.entries(request.parameters ?? {}).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    assertParameterName(key);
    args.push(`/param:${key}=${value}`);
  }
  // Node >=18 on Windows refuses to spawn .bat/.cmd directly with shell:false
  // (EINVAL, per the CVE-2024-27980 fix). Kitchen/Pan are batch files, so on
  // Windows we must run them through the shell. When shelling out we quote the
  // command and every argument so paths with spaces and /param values with
  // commas/spaces survive intact — but only after a conservative validator has
  // rejected any token carrying a shell metacharacter.
  const batchLauncher = /\.(bat|cmd)$/i.test(command);
  const needsShell = process.platform === 'win32' && batchLauncher;
  // Validate every token that would reach cmd.exe against the conservative
  // Windows validator whenever the launcher is a batch file. This is keyed on
  // the launcher kind, not the host OS, so the safety contract is enforced and
  // testable regardless of the platform running the suite.
  if (batchLauncher) {
    assertSafeWindowsToken(command, 'command');
    for (const arg of args) assertSafeWindowsToken(arg, 'argument');
  }
  const quote = value => `"${String(value).replace(/"/g, '\\"')}"`;
  const spawnCommand = needsShell ? quote(command) : command;
  const spawnArgs = needsShell ? args.map(quote) : args;
  const raw = await execute(spawnCommand, spawnArgs, {
    cwd: path.dirname(artifact), shell: needsShell, windowsHide: true,
    env: { ...process.env, ...(context.environment ?? {}) },
  }, context.spawnImpl ?? spawn, Math.max(1, request.timeoutMs ?? 120_000), context.terminate ?? defaultTerminate);
  const stdout = redact(raw.stdout, request.parameters);
  const stderr = redact(raw.stderr, request.parameters);
  const status = raw.timedOut ? 'TIMEOUT' : raw.code === 0 ? 'PASS' : 'FAIL';
  let logFile = null;
  if (context.logsDir) {
    mkdirSync(context.logsDir, { recursive: true });
    logFile = path.join(context.logsDir, `${Date.now()}-${request.kind}-${request.mode}.log`);
    writeFileSync(logFile, `status=${status}\nexitCode=${raw.code ?? ''}\nsignal=${raw.signal ?? ''}\n\nSTDOUT\n${stdout}\n\nSTDERR\n${stderr}\n`, 'utf8');
  }
  return { status, exitCode: raw.code, signal: raw.signal, stdout, stderr, logFile };
}

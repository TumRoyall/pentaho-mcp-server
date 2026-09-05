import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateFile } from '../core/validate.js';
import { detectPdi } from './detect.js';
import { executionPolicy } from './policy.js';
import { redact } from './redact.js';

function execute(command, args, options, spawnImpl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, options);
    let stdout = ''; let stderr = ''; let timedOut = false; let settled = false;
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });
}

export async function runPdi(request, context) {
  if (request.mode === 'execute' && executionPolicy(context.config.environment, request.confirmed) !== 'ALLOW') {
    return { status: 'CONFIRM_REQUIRED', environment: context.config.environment };
  }
  const detection = context.detection ?? detectPdi(context.config);
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
    args.push(`/param:${key}=${value}`);
  }
  // Node >=18 on Windows refuses to spawn .bat/.cmd directly with shell:false
  // (EINVAL, per the CVE-2024-27980 fix). Kitchen/Pan are batch files, so on
  // Windows we must run them through the shell. When shelling out we quote the
  // command and every argument so paths with spaces and /param values with
  // commas/spaces survive intact.
  const needsShell = process.platform === 'win32' && /\.(bat|cmd)$/i.test(command);
  const quote = value => `"${String(value).replace(/"/g, '\\"')}"`;
  const spawnCommand = needsShell ? quote(command) : command;
  const spawnArgs = needsShell ? args.map(quote) : args;
  const raw = await execute(spawnCommand, spawnArgs, {
    cwd: path.dirname(artifact), shell: needsShell, windowsHide: true,
    env: { ...process.env, ...(context.environment ?? {}) },
  }, context.spawnImpl ?? spawn, Math.max(1, request.timeoutMs ?? 120_000));
  const stdout = redact(raw.stdout.slice(-256_000), request.parameters);
  const stderr = redact(raw.stderr.slice(-256_000), request.parameters);
  const status = raw.timedOut ? 'TIMEOUT' : raw.code === 0 ? 'PASS' : 'FAIL';
  let logFile = null;
  if (context.logsDir) {
    mkdirSync(context.logsDir, { recursive: true });
    logFile = path.join(context.logsDir, `${Date.now()}-${request.kind}-${request.mode}.log`);
    writeFileSync(logFile, `status=${status}\nexitCode=${raw.code ?? ''}\nsignal=${raw.signal ?? ''}\n\nSTDOUT\n${stdout}\n\nSTDERR\n${stderr}\n`, 'utf8');
  }
  return { status, exitCode: raw.code, signal: raw.signal, stdout, stderr, logFile };
}

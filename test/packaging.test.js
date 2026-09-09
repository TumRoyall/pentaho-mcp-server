import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = '1.0.0';
const zip = path.join(root, 'dist', `dte-pentaho-mcp-${version}-win-x64.zip`);

test('production profile and client-neutral doctor remain portable', () => {
  const verify = spawnSync(process.execPath, ['scripts/verify-production-profile.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);
  const doctor = readFileSync(path.join(root, 'packaging', 'doctor.ps1'), 'utf8');
  assert.doesNotMatch(doctor, /C:\\Users\\|autoApprove\s*[:=]\s*\[\s*["']\*["']/i);
  assert.equal(existsSync(path.join(root, 'packaging', 'install.ps1')), false);
  assert.equal(existsSync(path.join(root, 'packaging', 'uninstall.ps1')), false);
});

test('current user-facing docs and installers drop legacy configuration references', () => {
  for (const relative of [
    'README.md', 'docs/architecture.md', 'docs/configuration.md',
    'docs/tools-reference.md', 'docs/operations.md', 'docs/install.md',
    'packaging/doctor.ps1',
  ]) {
    const text = readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(
      text,
      /\.pentaho-mcp\.yaml|workspaceRoot|requirementFolder|PENTAHO_ENV|KETTLE_DOCS_DIR|KETTLE_JOBS_DIR/,
      `${relative} must not reference removed configuration`,
    );
  }
});

test('package metadata ships the companion skill in the npm files list', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.files.includes('skills'), 'package.json files must include skills');
});

test('npm tarball excludes historical superpowers docs but keeps current docs, source, and skill', () => {
  const npmCli = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packed = spawnSync(npmCli, ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 120_000,
  });
  assert.equal(packed.status, 0, packed.stderr || packed.stdout);
  const jsonStart = packed.stdout.indexOf('[');
  assert.ok(jsonStart >= 0, `npm pack did not emit JSON: ${packed.stdout}`);
  const report = JSON.parse(packed.stdout.slice(jsonStart));
  const entries = report.flatMap(item => (item.files ?? []).map(file => file.path.replace(/\\/g, '/')));

  assert.equal(
    entries.some(file => file.startsWith('docs/superpowers/')),
    false,
    `published tarball must not contain historical superpowers docs: ${entries.filter(f => f.startsWith('docs/superpowers/')).join(', ')}`,
  );
  for (const required of [
    'docs/architecture.md',
    'docs/operations.md',
    'src/index.js',
    'skills/developing-pentaho-jobs/SKILL.md',
  ]) {
    assert.ok(entries.includes(required), `published tarball must include ${required}`);
  }
});

test('versioned Windows release has exact inventory, checksum, and working MCP executable', async () => {
  rmSync(path.join(root, 'dist'), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  const build = spawnSync(process.execPath, ['scripts/build-release.mjs', '--version', version], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  assert.ok(existsSync(zip));
  const checksum = readFileSync(path.join(root, 'dist', 'checksums.sha256'), 'utf8').trim();
  assert.equal(checksum, `${createHash('sha256').update(readFileSync(zip)).digest('hex')}  ${path.basename(zip)}`);

  const listing = spawnSync('tar.exe', ['-tf', zip], { encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  assert.deepEqual(listing.stdout.trim().split(/\r?\n/).sort(), [
    'README.md',
    'VERSION',
    'doctor.ps1',
    'dte-pentaho-mcp.exe',
    'skills/',
    'skills/developing-pentaho-jobs/',
    'skills/developing-pentaho-jobs/references/',
    'skills/developing-pentaho-jobs/SKILL.md',
    'skills/developing-pentaho-jobs/references/pentaho-spec-template.md',
    'skills/developing-pentaho-jobs/references/pentaho-plan-template.md',
  ].sort());

  const extract = path.join(root, 'dist', 'verify-extract');
  mkdirSync(extract, { recursive: true });
  const unpack = spawnSync('tar.exe', ['-xf', zip, '-C', extract], { encoding: 'utf8' });
  assert.equal(unpack.status, 0, unpack.stderr);
  const proc = spawn(path.join(extract, 'dte-pentaho-mcp.exe'), [], { stdio: ['pipe', 'pipe', 'pipe'] });
  const rpc = (id, method, params) => JSON.stringify({ jsonrpc: '2.0', id, method, params });
  proc.stdin.end([
    rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'package-test', version: '1' } }),
    rpc(2, 'tools/list', {}),
  ].join('\n') + '\n');
  let output = '';
  for await (const chunk of proc.stdout) output += chunk;
  const responses = output.split(/\r?\n/).filter(line => line.startsWith('{')).map(JSON.parse);
  const tools = responses.find(row => row.id === 2).result.tools;
  assert.equal(tools.length, 26);
  assert.equal(tools.some(item => item.name.startsWith('pentaho_')), false);
  const capabilities = responses.find(row => row.id === 1).result.capabilities;
  assert.ok(Object.hasOwn(capabilities, 'tools'));
  assert.equal(Object.hasOwn(capabilities, 'prompts'), false);
  assert.equal(Object.hasOwn(capabilities, 'resources'), false);
});

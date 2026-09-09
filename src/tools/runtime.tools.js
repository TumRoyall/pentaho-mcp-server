import { existsSync, readFileSync, readdirSync, realpathSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { detectPdi } from '../runtime/detect.js';
import { runPdi } from '../runtime/run.js';

const str = description => ({ type: 'string', description });

const runProperties = {
  artifact: str('KJB/KTR path relative to KETTLE_ROOT'),
  parameters: { type: 'object', additionalProperties: { type: 'string' } },
  timeoutMs: { type: 'integer', minimum: 1 },
};

function artifactPath(ctx, value) {
  const artifact = ctx.resolveRead(value);
  if (!/\.(kjb|ktr)$/i.test(artifact)) {
    throw new Error('Runtime artifact must end in .kjb or .ktr');
  }
  return artifact;
}

const LOGS_SUBDIR = ['.pentaho-mcp', 'runtime-logs'];
const MAX_LOG_BYTES = 256 * 1024;
const LOG_RETENTION = 100;

function logsDirFor(ctx) {
  return path.join(ctx.root, ...LOGS_SUBDIR);
}

function runContext(ctx) {
  return {
    pentahoHome: ctx.pentahoHome,
    logsDir: logsDirFor(ctx),
    executeEnabled: ctx.executeEnabled,
  };
}

function readLogFile(logsDir, name) {
  // Canonical containment per file: resolve the requested log through its real
  // path and refuse anything that escapes the logs directory (e.g. via `..`
  // or a symlink), then bound the returned bytes to the tail.
  const target = path.resolve(logsDir, name);
  const rel = path.relative(logsDir, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Log name escapes the runtime logs directory: ${name}`);
  }
  const canonical = existsSync(target) ? realpathSync(target) : target;
  const canonicalRel = path.relative(realpathSync(logsDir), canonical);
  if (canonicalRel.startsWith('..') || path.isAbsolute(canonicalRel)) {
    throw new Error(`Log file resolves outside the runtime logs directory: ${name}`);
  }
  const buffer = readFileSync(canonical);
  const bounded = buffer.length > MAX_LOG_BYTES ? buffer.subarray(buffer.length - MAX_LOG_BYTES) : buffer;
  return bounded.toString('utf8');
}

function pruneLogs(logsDir) {
  if (!existsSync(logsDir)) return;
  const names = readdirSync(logsDir).filter(name => name.endsWith('.log')).sort();
  for (const stale of names.slice(0, Math.max(0, names.length - LOG_RETENTION))) {
    try { unlinkSync(path.join(logsDir, stale)); } catch { /* best effort */ }
  }
}

async function runArtifact(ctx, args, mode) {
  const artifact = artifactPath(ctx, args.artifact);
  const kind = /\.ktr$/i.test(artifact) ? 'trans' : 'job';
  const result = await runPdi({ ...args, artifact, kind, mode }, runContext(ctx));
  pruneLogs(logsDirFor(ctx));
  return result;
}

export function runtimeTools(ctx) {
  return [
    {
      name: 'kettle_runtime_detect', description: 'Detect optional local Kitchen.bat and Pan.bat beneath PENTAHO_HOME.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => detectPdi(ctx.pentahoHome),
    },
    {
      name: 'kettle_runtime_loadcheck', description: 'Statically validate and ask local Kitchen/Pan to load an artifact without deployment.',
      inputSchema: { type: 'object', properties: runProperties, required: ['artifact'] },
      handler: args => runArtifact(ctx, args, 'loadcheck'),
    },
    {
      name: 'kettle_runtime_execute', description: 'Execute with Kitchen/Pan; every execution requires confirmed=true.',
      inputSchema: { type: 'object', properties: { ...runProperties, confirmed: { type: 'boolean' } }, required: ['artifact'] },
      handler: args => runArtifact(ctx, args, 'execute'),
    },
    {
      name: 'kettle_runtime_logs', description: 'Read sanitized runtime logs stored under the active project root.',
      inputSchema: {
        type: 'object',
        properties: {
          name: str('Optional single log file name to read'),
          limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum number of newest logs to return', default: 20 },
        },
      },
      handler: (args = {}) => {
        const logsDir = logsDirFor(ctx);
        if (!existsSync(logsDir)) return { files: [] };
        if (args.name != null) {
          return { files: [{ name: args.name, content: readLogFile(logsDir, args.name) }] };
        }
        const limit = Math.min(100, Math.max(1, Number.isInteger(args.limit) ? args.limit : 20));
        const names = readdirSync(logsDir)
          .filter(name => name.endsWith('.log'))
          .sort()
          .reverse() // newest-first: timestamp-prefixed names sort lexicographically
          .slice(0, limit);
        return { files: names.map(name => ({ name, content: readLogFile(logsDir, name) })) };
      },
    },
  ];
}

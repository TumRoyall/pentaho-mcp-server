import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

function runContext(ctx) {
  return {
    pentahoHome: ctx.pentahoHome,
    logsDir: path.join(ctx.root, '.pentaho-mcp', 'runtime-logs'),
  };
}

function runArtifact(ctx, args, mode) {
  const artifact = artifactPath(ctx, args.artifact);
  const kind = /\.ktr$/i.test(artifact) ? 'trans' : 'job';
  return runPdi({ ...args, artifact, kind, mode }, runContext(ctx));
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
      inputSchema: { type: 'object', properties: {} },
      handler: () => {
        const logsDir = path.join(ctx.root, '.pentaho-mcp', 'runtime-logs');
        if (!existsSync(logsDir)) return { files: [] };
        return { files: readdirSync(logsDir).filter(name => name.endsWith('.log')).sort().map(name => ({ name, content: readFileSync(path.join(logsDir, name), 'utf8') })) };
      },
    },
  ];
}

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadProjectConfig } from '../project/config.js';
import { assertInsideRoots, resolveProjectPath } from '../project/paths.js';
import { detectPdi } from '../runtime/detect.js';
import { runPdi } from '../runtime/run.js';

const str = description => ({ type: 'string', description });
const common = {
  workspaceRoot: str('Workspace containing .pentaho-mcp.yaml'),
  requirementFolder: str('Existing REQ folder used for sanitized runtime logs'),
  artifact: str('KJB/KTR path relative to configured Pentaho root'),
  parameters: { type: 'object', additionalProperties: { type: 'string' } },
  timeoutMs: { type: 'integer', minimum: 1 },
};

function context(args) {
  const config = loadProjectConfig(args.workspaceRoot);
  const reqDir = resolveProjectPath(config, 'requirements', args.requirementFolder);
  assertInsideRoots(config, reqDir);
  const artifact = args.artifact ? resolveProjectPath(config, 'pentaho', args.artifact) : null;
  if (artifact) assertInsideRoots(config, artifact);
  return { config, reqDir, artifact, logsDir: path.join(reqDir, 'runtime-logs') };
}

export function runtimeTools() {
  return [
    {
      name: 'kettle_runtime_detect', description: 'Detect optional local Kitchen.bat and Pan.bat beneath configured pentaho.home.',
      inputSchema: { type: 'object', properties: { workspaceRoot: common.workspaceRoot }, required: ['workspaceRoot'] },
      handler: args => detectPdi(loadProjectConfig(args.workspaceRoot)),
    },
    {
      name: 'kettle_runtime_loadcheck', description: 'Statically validate and ask local Kitchen/Pan to load an artifact without deployment.',
      inputSchema: { type: 'object', properties: common, required: ['workspaceRoot', 'requirementFolder', 'artifact'] },
      handler: args => { const ctx = context(args); return runPdi({ ...args, artifact: ctx.artifact, kind: /\.ktr$/i.test(ctx.artifact) ? 'trans' : 'job', mode: 'loadcheck' }, ctx); },
    },
    {
      name: 'kettle_runtime_execute', description: 'Execute with Kitchen/Pan; DEV/TEST auto-allow, every other environment requires confirmed=true.',
      inputSchema: { type: 'object', properties: { ...common, confirmed: { type: 'boolean' } }, required: ['workspaceRoot', 'requirementFolder', 'artifact'] },
      handler: args => { const ctx = context(args); return runPdi({ ...args, artifact: ctx.artifact, kind: /\.ktr$/i.test(ctx.artifact) ? 'trans' : 'job', mode: 'execute' }, ctx); },
    },
    {
      name: 'kettle_runtime_logs', description: 'Read sanitized logs stored for one requirement workflow.',
      inputSchema: { type: 'object', properties: { workspaceRoot: common.workspaceRoot, requirementFolder: common.requirementFolder }, required: ['workspaceRoot', 'requirementFolder'] },
      handler: args => {
        const { logsDir } = context(args);
        if (!existsSync(logsDir)) return { files: [] };
        return { files: readdirSync(logsDir).filter(name => name.endsWith('.log')).sort().map(name => ({ name, content: readFileSync(path.join(logsDir, name), 'utf8') })) };
      },
    },
  ];
}

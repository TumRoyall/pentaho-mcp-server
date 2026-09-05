import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjectConfig } from '../project/config.js';
import { assertInsideRoots, resolveProjectPath } from '../project/paths.js';
import { decideNextStage, inspectWorkflow } from '../workflow/inspect.js';
import { writeWorkflowState } from '../workflow/state.js';
import { withWorkflowLock } from '../workflow/lock.js';
import { validateRequirement } from '../lifecycle/requirement-validator.js';
import { validateDesign } from '../lifecycle/design-validator.js';
import { writeDesignDiagrams } from '../lifecycle/diagram-renderer.js';
import { hashBytes, writeArtifactSet } from '../lifecycle/artifact-write.js';
import { loadDesignPackage } from '../lifecycle/design-loader.js';
import { generateProject, planGeneration } from '../generation/generate.js';
import { loadModel } from '../core/model.js';
import { diffRuntimeDesign } from '../sync/diff-runtime-design.js';
import { applyDesignDelta } from '../sync/apply-design-delta.js';
import { finalizeWorkflow } from '../lifecycle/finalize.js';

const str = description => ({ type: 'string', description });
const baseProperties = {
  workspaceRoot: str('Workspace containing .pentaho-mcp.yaml'),
  requirementFolder: str('Existing REQ_<ID>_<UPPER_SNAKE> folder name'),
};
const baseSchema = extra => ({
  type: 'object',
  properties: { ...baseProperties, ...extra },
  required: ['workspaceRoot', 'requirementFolder'],
});

function resolveScope(args) {
  const config = loadProjectConfig(args.workspaceRoot);
  const reqDir = resolveProjectPath(config, 'requirements', args.requirementFolder);
  assertInsideRoots(config, reqDir);
  return { config, reqDir };
}

function inspect(args) {
  const { config, reqDir } = resolveScope(args);
  const inspection = inspectWorkflow(config, reqDir);
  return { config, reqDir, inspection, decision: decideNextStage(inspection) };
}

function fileHashes(directory) {
  const result = {};
  if (!existsSync(directory)) return result;
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) result[file] = hashBytes(readFileSync(file));
    }
  };
  walk(directory);
  return result;
}

function statusPayload(args) {
  const result = inspect(args);
  return {
    project: { code: result.config.projectCode, environment: result.config.environment, paths: result.config.paths },
    inspection: result.inspection,
    decision: result.decision,
    expectedHashes: {
      ...fileHashes(result.reqDir),
      ...(result.inspection.artifacts.runtimeDir ? fileHashes(result.inspection.artifacts.runtimeDir) : {}),
    },
  };
}

function nextState(inspection, stage, validation) {
  return {
    schema_version: 1,
    mcp_version: '0.1.0',
    input_hash: inspection.input.hash,
    artifact_hashes: inspection.artifactHashes,
    current_stage: stage,
    last_completed_stage: stage,
    updated_at: new Date().toISOString(),
    validation,
  };
}

function validateRequirementContent(reqDir, content) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'pentaho-requirement-stage-'));
  const staged = path.join(tempRoot, path.basename(reqDir));
  mkdirSync(staged);
  try {
    writeFileSync(path.join(staged, 'requirement.md'), content, 'utf8');
    return validateRequirement(staged);
  } finally { rmSync(tempRoot, { recursive: true, force: true }); }
}

function collectFiles(directory) {
  const result = [];
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) result.push(file);
    }
  };
  walk(directory);
  return result;
}

export function lifecycleTools() {
  return [
    {
      name: 'pentaho_project_inspect',
      description: 'Inspect configured project roots and recover the current lifecycle stage from workspace bytes.',
      inputSchema: baseSchema({}),
      handler: statusPayload,
    },
    {
      name: 'pentaho_workflow_start',
      description: 'Start or resume one existing BA request after inspecting all current artifacts.',
      inputSchema: baseSchema({}),
      handler: args => ({ ...statusPayload(args), resources: ['dte-pentaho://skills/developing-pentaho-jobs'] }),
    },
    {
      name: 'pentaho_workflow_status',
      description: 'Reconstruct current workflow status; saved state is advisory and invalid state is reported, not trusted.',
      inputSchema: baseSchema({}),
      handler: statusPayload,
    },
    {
      name: 'pentaho_requirement_write',
      description: 'Validate and atomically write agent-authored requirement.md using expected file hashes.',
      inputSchema: baseSchema({
        content: str('Complete requirement.md content'),
        expectedHashes: { type: 'object', additionalProperties: { type: ['string', 'null'] } },
      }),
      handler: async args => {
        const { config, reqDir, inspection } = inspect(args);
        if (inspection.input.unsupported.length) throw new Error(`Unsupported input: ${inspection.input.unsupported.join(', ')}`);
        const report = validateRequirementContent(reqDir, args.content);
        if (!report.ok) throw new Error(`Requirement validation failed: ${JSON.stringify(report.errors)}`);
        const target = assertInsideRoots(config, path.join(reqDir, 'requirement.md'), { write: true });
        return withWorkflowLock(reqDir, () => {
          const write = writeArtifactSet([{ path: target, content: args.content }], args.expectedHashes ?? {});
          const updated = inspectWorkflow(config, reqDir);
          writeWorkflowState(reqDir, nextState(updated, 'REQUIREMENT', report));
          return { write, validation: report, next: decideNextStage(updated) };
        });
      },
    },
    {
      name: 'pentaho_design_write',
      description: 'Stage, render, validate, and atomically write a complete design package using expected file hashes.',
      inputSchema: baseSchema({
        files: { type: 'object', additionalProperties: { type: 'string' }, description: 'Paths relative to design/ mapped to complete content' },
        expectedHashes: { type: 'object', additionalProperties: { type: ['string', 'null'] } },
      }),
      handler: async args => {
        const { config, reqDir } = inspect(args);
        const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'pentaho-design-stage-'));
        const staged = path.join(tempRoot, 'design');
        mkdirSync(staged);
        try {
          for (const [relative, content] of Object.entries(args.files ?? {})) {
            const file = path.resolve(staged, relative);
            if (!file.startsWith(`${staged}${path.sep}`)) throw new Error(`Design path outside design directory: ${relative}`);
            mkdirSync(path.dirname(file), { recursive: true });
            writeFileSync(file, content, 'utf8');
          }
          if (!existsSync(path.join(staged, 'design.md')) || !existsSync(path.join(staged, 'manifest.yaml'))) {
            throw new Error('Design validation failed: design.md and manifest.yaml are required');
          }
          try { writeDesignDiagrams(staged); }
          catch (error) { throw new Error(`Design validation failed: ${error.message}`); }
          const report = validateDesign(staged);
          if (!report.ok) throw new Error(`Design validation failed: ${JSON.stringify(report.errors)}`);
          const designDir = assertInsideRoots(config, path.join(reqDir, 'design'), { write: true });
          const writes = collectFiles(staged).map(file => ({
            path: assertInsideRoots(config, path.join(designDir, path.relative(staged, file)), { write: true }),
            content: readFileSync(file),
          }));
          return await withWorkflowLock(reqDir, () => {
            const write = writeArtifactSet(writes, args.expectedHashes ?? {});
            const updated = inspectWorkflow(config, reqDir);
            writeWorkflowState(reqDir, nextState(updated, 'DESIGN', report));
            return { write, validation: report, next: decideNextStage(updated) };
          });
        } finally { rmSync(tempRoot, { recursive: true, force: true }); }
      },
    },
    {
      name: 'pentaho_generate',
      description: 'Generate and statically validate the complete Pentaho project from the current validated design package.',
      inputSchema: baseSchema({
        expectedHashes: { type: 'object', additionalProperties: { type: ['string', 'null'] } },
      }),
      handler: async args => {
        const { config, reqDir, inspection } = inspect(args);
        if (!inspection.artifacts.designExists) throw new Error('Design package is missing');
        const plan = planGeneration(config, loadDesignPackage(inspection.artifacts.designDir));
        return withWorkflowLock(reqDir, () => {
          const result = generateProject(plan, args.expectedHashes ?? {});
          const updated = inspectWorkflow(config, reqDir);
          writeWorkflowState(reqDir, nextState(updated, 'GENERATION', result.validation));
          return { ...result, next: decideNextStage(updated) };
        });
      },
    },
    {
      name: 'pentaho_sync_changes',
      description: 'Compare manually edited KJB/KTR with design, ignore visual-only drift, and synchronize safe technical deltas.',
      inputSchema: baseSchema({
        expectedHashes: { type: 'object', additionalProperties: { type: ['string', 'null'] } },
      }),
      handler: async args => {
        const { config, reqDir, inspection } = inspect(args);
        if (!inspection.artifacts.designExists || !inspection.artifacts.runtimeDir) throw new Error('Design or runtime project is missing');
        const pkg = loadDesignPackage(inspection.artifacts.designDir);
        const declarations = [...(pkg.manifest.components?.jobs ?? []), ...(pkg.manifest.components?.transformations ?? [])];
        const models = declarations.map(row => loadModel(path.join(inspection.artifacts.runtimeDir, row.artifact_name)));
        const deltas = diffRuntimeDesign(pkg, models);
        if (!deltas.length) return { status: 'UNCHANGED', deltas };
        return withWorkflowLock(reqDir, () => {
          const result = applyDesignDelta(inspection.artifacts.designDir, deltas, args.expectedHashes ?? {});
          if (result.status === 'SYNCED') {
            const updated = inspectWorkflow(config, reqDir);
            writeWorkflowState(reqDir, nextState(updated, 'MODIFYING', { ok: true, deltas: deltas.length }));
          }
          return { ...result, deltas };
        });
      },
    },
    {
      name: 'pentaho_validate_project',
      description: 'Aggregate requirement, design, generated artifact, static Kettle, reconciliation, and optional PDI status.',
      inputSchema: baseSchema({}),
      handler: args => { const { config, reqDir } = resolveScope(args); return finalizeWorkflow(config, reqDir); },
    },
    {
      name: 'pentaho_finalize',
      description: 'Reinspect all current bytes, return the final report, and mark workflow complete only when required checks pass.',
      inputSchema: baseSchema({}),
      handler: async args => {
        const { config, reqDir } = resolveScope(args);
        return withWorkflowLock(reqDir, () => {
          const report = finalizeWorkflow(config, reqDir);
          if (report.status === 'COMPLETE') {
            const updated = inspectWorkflow(config, reqDir);
            writeWorkflowState(reqDir, nextState(updated, 'COMPLETE', report.checks));
          }
          return report;
        });
      },
    },
  ];
}

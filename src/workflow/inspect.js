import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { assertInsideRoots, resolveProjectPath } from '../project/paths.js';
import { hashTree } from './hash.js';
import { readWorkflowState } from './state.js';

const REQ_PATTERN = /^REQ_\d{3,}_[A-Z][A-Z0-9_]*$/;

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  const result = [];
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) result.push(full);
    }
  };
  walk(directory);
  return result.sort((a, b) => a.localeCompare(b, 'en'));
}

function hashFiles(files, root) {
  return files.length === 0 ? null : hashTree(files, { root });
}

function manifestProjectPath(manifestFile) {
  if (!existsSync(manifestFile)) return null;
  const document = parseDocument(readFileSync(manifestFile, 'utf8'), { uniqueKeys: true });
  if (document.errors.length > 0) return null;
  return document.toJS()?.pentaho?.project_path ?? null;
}

export function inspectWorkflow(config, reqDir) {
  const requirementDir = assertInsideRoots(config, reqDir);
  const relativeReq = path.relative(config.paths.requirements, requirementDir);
  if (relativeReq.includes(path.sep) || !REQ_PATTERN.test(path.basename(requirementDir))) {
    throw new Error(`Requirement folder must be a direct child named REQ_<ID>_<UPPER_SNAKE_CASE_SLUG>: ${reqDir}`);
  }
  if (!existsSync(requirementDir) || !statSync(requirementDir).isDirectory()) throw new Error(`Requirement folder does not exist: ${reqDir}`);

  const inputDir = path.join(requirementDir, 'input');
  const inputFiles = filesUnder(inputDir);
  const supported = inputFiles.filter(file => path.extname(file).toLowerCase() === '.md');
  const unsupported = inputFiles.filter(file => path.extname(file).toLowerCase() !== '.md');
  const requirementFile = path.join(requirementDir, 'requirement.md');
  const designDir = path.join(requirementDir, 'design');
  const manifestFile = path.join(designDir, 'manifest.yaml');
  const projectPath = manifestProjectPath(manifestFile);
  let runtimeDir = null;
  if (typeof projectPath === 'string' && projectPath.trim() !== '') {
    runtimeDir = resolveProjectPath(config, 'pentaho', projectPath);
  }
  const designFiles = filesUnder(designDir);
  const runtimeFiles = runtimeDir == null ? [] : filesUnder(runtimeDir);
  const artifactHashes = {
    requirement: existsSync(requirementFile) ? hashTree([requirementFile], { root: requirementDir }) : null,
    design: hashFiles(designFiles, requirementDir),
    runtime: runtimeDir == null ? null : hashFiles(runtimeFiles, config.paths.pentaho),
  };

  let state = null;
  let stateError = null;
  try { state = readWorkflowState(requirementDir); }
  catch (error) { stateError = error.message; }

  return {
    workflowId: path.basename(requirementDir),
    requirementDir,
    input: {
      directory: inputDir,
      files: supported,
      unsupported,
      hash: hashFiles(inputFiles, inputDir),
    },
    artifacts: {
      requirementFile,
      requirementExists: existsSync(requirementFile),
      designDir,
      designExists: existsSync(manifestFile),
      runtimeDir,
      runtimeFiles,
    },
    artifactHashes,
    state,
    stateError,
  };
}

function decision(stage, reason, blockers = [], staleArtifacts = []) {
  return { stage, reason, blockers, staleArtifacts };
}

export function decideNextStage(inspection) {
  if (inspection.input.unsupported.length > 0) {
    return decision('BLOCKED', 'UNSUPPORTED_INPUT', inspection.input.unsupported.map(file => `Unsupported input file: ${path.basename(file)}`));
  }
  if (inspection.input.files.length === 0) return decision('BLOCKED', 'INPUT_EMPTY', ['input/ must contain at least one Markdown file']);

  const { state, artifactHashes, artifacts } = inspection;
  if (state?.input_hash && state.input_hash !== inspection.input.hash) {
    return decision('REQUIREMENT', 'INPUT_CHANGED', [], ['requirement', 'design', 'runtime']);
  }
  if (!artifacts.requirementExists) return decision('REQUIREMENT', 'REQUIREMENT_MISSING');

  if (state?.artifact_hashes?.requirement && state.artifact_hashes.requirement !== artifactHashes.requirement) {
    return decision('DESIGN', 'REQUIREMENT_CHANGED', [], ['design', 'runtime']);
  }
  if (!artifacts.designExists) return decision('DESIGN', 'DESIGN_MISSING');

  if (state?.artifact_hashes?.design && state.artifact_hashes.design !== artifactHashes.design) {
    return decision('GENERATION', 'DESIGN_CHANGED', [], ['runtime']);
  }
  if (artifacts.runtimeDir == null || artifacts.runtimeFiles.length === 0) {
    return decision('GENERATION', 'RUNTIME_MISSING');
  }
  if (state?.artifact_hashes?.runtime && state.artifact_hashes.runtime !== artifactHashes.runtime) {
    return decision('MODIFYING', 'RUNTIME_CHANGED', [], ['design']);
  }
  if (state?.current_stage === 'COMPLETE') return decision('COMPLETE', 'UNCHANGED_COMPLETE');
  return decision('VALIDATING', 'ARTIFACTS_PRESENT');
}

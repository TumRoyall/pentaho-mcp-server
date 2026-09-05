import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { validateAll } from '../core/validate.js';
import { loadModel } from '../core/model.js';
import { inspectWorkflow, decideNextStage } from '../workflow/inspect.js';
import { validateRequirement } from './requirement-validator.js';
import { validateDesign } from './design-validator.js';
import { loadDesignPackage } from './design-loader.js';
import { diffRuntimeDesign } from '../sync/diff-runtime-design.js';
import { detectPdi } from '../runtime/detect.js';

function inventory(directory) {
  const files = [];
  if (!directory || !existsSync(directory)) return files;
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file); else if (entry.isFile()) files.push(file);
    }
  };
  walk(directory);
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

const check = (status, detail = null) => ({ status, detail });

export function finalizeWorkflow(config, reqDir) {
  const inspection = inspectWorkflow(config, reqDir);
  const decision = decideNextStage(inspection);
  const blockers = [...decision.blockers];
  const artifacts = [...inventory(reqDir), ...inventory(inspection.artifacts.runtimeDir)]
    .sort((a, b) => a.localeCompare(b, 'en'));

  const requirementReport = inspection.artifacts.requirementExists ? validateRequirement(reqDir) : null;
  const requirement = requirementReport?.ok ? check('PASS', requirementReport) : check(inspection.artifacts.requirementExists ? 'FAIL' : 'MISSING', requirementReport);
  if (requirement.status !== 'PASS') blockers.push('Requirement is missing or invalid');

  let designReport = null; let pkg = null;
  if (inspection.artifacts.designExists) {
    designReport = validateDesign(inspection.artifacts.designDir);
    if (designReport.ok) pkg = loadDesignPackage(inspection.artifacts.designDir);
  }
  const design = designReport?.ok ? check('PASS', designReport) : check(inspection.artifacts.designExists ? 'FAIL' : 'MISSING', designReport);
  if (design.status !== 'PASS') blockers.push('Design package is missing or invalid');

  let kettleStatic = check('NOT_RUN');
  if (inspection.artifacts.runtimeDir && existsSync(inspection.artifacts.runtimeDir)) {
    const report = validateAll(inspection.artifacts.runtimeDir);
    kettleStatic = check(report.summary.errors ? 'FAIL' : 'PASS', report);
    if (report.summary.errors) blockers.push('Kettle static validation failed');
  } else blockers.push('Pentaho runtime project is missing');

  const marker = inspection.artifacts.runtimeDir && path.join(inspection.artifacts.runtimeDir, '.pentaho-mcp-generated.json');
  const generation = marker && existsSync(marker) ? check('PASS') : check('MISSING');
  if (generation.status !== 'PASS') blockers.push('Generation marker is missing');

  let reconciliation = check('NOT_RUN');
  if (pkg && inspection.artifacts.runtimeDir) {
    try {
      const declarations = [...(pkg.manifest.components?.jobs ?? []), ...(pkg.manifest.components?.transformations ?? [])];
      const models = declarations.map(row => loadModel(path.join(inspection.artifacts.runtimeDir, row.artifact_name)));
      const deltas = diffRuntimeDesign(pkg, models);
      reconciliation = check(deltas.length ? 'FAIL' : 'PASS', { deltas });
      if (deltas.length) blockers.push('Runtime and design are not synchronized');
    } catch (error) {
      reconciliation = check('FAIL', { error: error.message }); blockers.push('Runtime/design reconciliation failed');
    }
  }

  let pdi;
  try {
    const detected = detectPdi(config);
    pdi = check(detected.available ? 'AVAILABLE' : 'UNAVAILABLE', detected);
  } catch (error) { pdi = check('UNAVAILABLE', { error: error.message }); }
  const execution = check('NOT_RUN');
  const complete = [requirement, design, kettleStatic, generation, reconciliation].every(item => item.status === 'PASS');
  return {
    status: complete ? 'COMPLETE' : 'INCOMPLETE',
    workflowId: inspection.workflowId,
    decision,
    blockers: [...new Set(blockers)],
    checks: { requirement, design, generation, kettleStatic, reconciliation, pdi, execution },
    artifacts,
    versions: { mcp: '0.1.0', pdi: pdi.detail?.version ?? null },
    inspection,
    nextAction: complete ? 'Workflow artifacts are complete; optional DEV/TEST execution may follow.' : decision.reason,
  };
}

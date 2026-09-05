import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assertInsideRoots, resolveProjectPath } from '../project/paths.js';
import { validateDesign } from '../lifecycle/design-validator.js';
import { writeArtifactSet } from '../lifecycle/artifact-write.js';
import { generateJobXml } from './job.js';
import { generateTransformationXml } from './transformation.js';
import { generateDdl, generateProperties, generateSharedXml, launchers } from './infrastructure.js';
import { validateGeneration } from './validate-generation.js';

export function planGeneration(config, designPackage) {
  const report = validateDesign(designPackage.designDir);
  if (!report.ok) throw new Error(`Design validation failed: ${JSON.stringify(report.errors)}`);
  const projectPath = designPackage.manifest.pentaho?.project_path;
  const targetDir = resolveProjectPath(config, 'pentaho', projectPath);
  assertInsideRoots(config, targetDir, { write: true });
  const marker = path.join(targetDir, '.pentaho-mcp-generated.json');
  if (existsSync(targetDir) && readdirSync(targetDir).length && !existsSync(marker)) {
    throw new Error(`Refusing non-empty unmanaged target directory: ${targetDir}`);
  }

  const outputs = new Map();
  for (const row of designPackage.manifest.components?.jobs ?? []) {
    outputs.set(path.join(targetDir, row.artifact_name), generateJobXml(designPackage.jobs.get(row.id), designPackage.manifest));
  }
  for (const row of designPackage.manifest.components?.transformations ?? []) {
    outputs.set(path.join(targetDir, row.artifact_name), generateTransformationXml(designPackage.transformations.get(row.id), designPackage.manifest));
  }
  outputs.set(path.join(targetDir, '.kettle', 'shared.xml'), generateSharedXml(designPackage.manifest.connections));
  outputs.set(path.join(targetDir, '.kettle', 'kettle.properties'), generateProperties(designPackage.manifest));
  const entrypoint = (designPackage.manifest.components?.jobs ?? []).find(row => row.id === designPackage.manifest.pentaho?.entrypoint_job)?.artifact_name;
  if (!entrypoint) throw new Error('Entrypoint job does not resolve to an artifact');
  for (const [relative, content] of Object.entries(launchers(entrypoint))) outputs.set(path.join(targetDir, relative), content);
  for (const [relative, content] of Object.entries(generateDdl(designPackage))) outputs.set(path.join(targetDir, relative), content);
  outputs.set(marker, `${JSON.stringify({ schema_version: 1, design_id: designPackage.manifest.design.id, design_version: designPackage.manifest.design.version }, null, 2)}\n`);
  return {
    config, designPackage, targetDir, outputs,
    inventory: [...outputs.keys()].sort((a, b) => a.localeCompare(b, 'en')),
    changelog: path.join(path.dirname(designPackage.designDir), 'changelog.md'),
  };
}

export function generateProject(plan, expectedHashes = {}) {
  const validation = validateGeneration(plan);
  if (!validation.ok) throw new Error(`Generation validation failed: ${validation.errors.join('; ')}`);
  const change = `---\nartifact_type: pentaho-changelog\n---\n# Changelog\n\n## CHG-001 — Initial generation\n\n- Mode: Initial Generation\n- Design: ${plan.designPackage.manifest.design.id} version ${plan.designPackage.manifest.design.version}\n- Validation: PASS\n`;
  const files = [...plan.outputs].map(([file, content]) => ({ path: file, content }));
  files.push({ path: plan.changelog, content: change });
  const result = writeArtifactSet(files, expectedHashes);
  return { ...result, validation, targetDir: plan.targetDir };
}

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadDesignPackage } from './design-loader.js';
import { unifiedDiff } from '../core/edit.js';

const begin = '<!-- BEGIN GENERATED DIAGRAMS -->';
const end = '<!-- END GENERATED DIAGRAMS -->';
const rows = value => Array.isArray(value) ? value : [];
const node = value => String(value ?? 'UNKNOWN').replace(/[^A-Za-z0-9_]/g, '_');
const label = value => String(value ?? '?').replace(/[<>"`]/g, '').replace(/\|/g, '/');

function graph(title, lines) {
  return `### ${title}\n\n\`\`\`mermaid\nflowchart LR\n${lines.map(line => `  ${line}`).join('\n')}\n\`\`\``;
}

export function renderDesignDiagrams(pkg) {
  const overview = [];
  for (const [jobId, doc] of pkg.jobs) {
    overview.push(`${node(jobId)}["${label(jobId)}"]`);
    for (const entry of rows(doc.job?.entries)) {
      if (entry.component_ref && pkg.transformations.has(entry.component_ref)) {
        overview.push(`${node(jobId)} -->|${label(entry.display_name)}| ${node(entry.component_ref)}`);
      }
    }
  }
  for (const transId of pkg.transformations.keys()) overview.push(`${node(transId)}["${label(transId)}"]`);

  const parts = [graph('Overview', overview)];
  for (const [jobId, doc] of pkg.jobs) {
    const job = doc.job ?? {};
    const lines = rows(job.entries).map(entry => `${node(entry.id)}["${label(entry.display_name)}"]`);
    for (const hop of rows(job.hops)) {
      const arrow = hop.enabled === false ? '-.->|disabled|' : '-->';
      lines.push(`${node(hop.from)} ${arrow} ${node(hop.to)}`);
    }
    parts.push(graph(`Job ${jobId}`, lines));
  }
  for (const [transId, doc] of pkg.transformations) {
    const trans = doc.transformation ?? {};
    const lines = [];
    for (const input of rows(trans.inputs)) lines.push(`${node(input.id)}["${label(input.object ?? input.id)}"]`);
    for (const output of rows(trans.outputs)) lines.push(`${node(output.id)}["${label(output.object ?? output.id)}"]`);
    for (const step of rows(trans.steps)) {
      lines.push(`${node(step.id)}["${label(step.display_name)}"]`);
      for (const input of rows(step.reads_inputs)) lines.push(`${node(input)} --> ${node(step.id)}`);
      for (const output of rows(step.writes_outputs)) lines.push(`${node(step.id)} --> ${node(output)}`);
    }
    for (const hop of rows(trans.hops)) lines.push(`${node(hop.from)} ${hop.enabled === false ? '-.->|disabled|' : '-->'} ${node(hop.to)}`);
    for (const hop of rows(trans.error_hops)) lines.push(`${node(hop.from)} -.->|row error| ${node(hop.to)}`);
    parts.push(graph(`Transformation ${transId}`, lines));
  }
  return parts.join('\n\n');
}

export function areDesignDiagramsCurrent(designDir, pkg = loadDesignPackage(designDir)) {
  const content = readFileSync(path.join(designDir, 'design.md'), 'utf8');
  const start = content.indexOf(begin);
  const finish = content.indexOf(end);
  if (start < 0 || finish < start) return false;
  const existing = content.slice(start + begin.length, finish).trim();
  return existing === renderDesignDiagrams(pkg).trim();
}

export function writeDesignDiagrams(designDir) {
  const file = path.join(designDir, 'design.md');
  const before = readFileSync(file, 'utf8');
  const start = before.indexOf(begin);
  const finish = before.indexOf(end);
  if (start < 0 || finish < start) throw new Error('design.md is missing generated diagram markers');
  const section = renderDesignDiagrams(loadDesignPackage(designDir));
  const after = `${before.slice(0, start + begin.length)}\n${section}\n${before.slice(finish)}`;
  if (after === before) return { changed: false, diff: '' };
  const temp = `${file}.tmp`;
  writeFileSync(temp, after, 'utf8');
  renameSync(temp, file);
  return { changed: true, diff: unifiedDiff(before, after, file) };
}

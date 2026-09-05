import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateFile } from '../core/validate.js';

export function validateGeneration(plan) {
  const errors = [];
  const text = [...plan.outputs.values()].join('\n');
  if (/\{\{[^{}]*\}\}/.test(text)) errors.push('placeholder token remains');
  if (/(?:password|secret|token)\s*[=:>]\s*(?!\$\{|<)[^\r\n<]+/i.test(text)) errors.push('possible literal secret');
  const temp = mkdtempSync(path.join(os.tmpdir(), 'pentaho-generation-validate-'));
  const reports = [];
  try {
    for (const [file, content] of plan.outputs) {
      const relative = path.relative(plan.targetDir, file);
      const staged = path.join(temp, relative);
      mkdirSync(path.dirname(staged), { recursive: true });
      writeFileSync(staged, content, 'utf8');
    }
    for (const file of plan.outputs.keys()) {
      if (!/\.(?:kjb|ktr)$/i.test(file)) continue;
      const report = validateFile(path.join(temp, path.relative(plan.targetDir, file)));
      reports.push(report);
      if (report.summary.errors) errors.push(...report.issues.filter(issue => issue.severity === 'error').map(issue => `${path.basename(file)}: ${issue.message}`));
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
  return { ok: errors.length === 0, errors, reports };
}

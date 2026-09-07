import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.join(here, '..', 'skills', 'developing-pentaho-jobs');
const read = (...p) => readFileSync(path.join(skillDir, ...p), 'utf8');

test('SKILL.md declares the knowledge-first, Superpowers-gated contract', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /^---[\s\S]*name:\s*developing-pentaho-jobs[\s\S]*---/);
  assert.match(skill, /superpowers:brainstorming/);
  assert.match(skill, /superpowers:writing-plans/);
  assert.match(skill, /kettle_knowledge_get/);
  assert.match(skill, /kettle_create_file/);
  assert.match(skill, /kettle_validate/);
  assert.match(skill, /references\/pentaho-spec-template\.md/);
  assert.doesNotMatch(skill, /pentaho_workflow_|pentaho_generate|REQ_</);
  assert.match(skill, /must not invoke runtime tools/i);
  assert.match(skill, /must not generate testcases/i);
  assert.match(skill, /must not access databases/i);
  assert.match(skill, /must not deploy/i);
});

test('specification template contains the six required contract sections', () => {
  const template = read('references', 'pentaho-spec-template.md');
  for (const heading of [
    '## Objective and boundaries',
    '## Artifact inventory',
    '## Variables, parameters, and connections',
    '## Job definitions',
    '## Transformation definitions',
    '## Static acceptance criteria',
  ]) {
    assert.ok(template.includes(heading), `missing heading: ${heading}`);
  }
});

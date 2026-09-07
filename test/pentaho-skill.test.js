import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.join(here, '..', 'skills', 'developing-pentaho-jobs');
const read = (...p) => readFileSync(path.join(skillDir, ...p), 'utf8');

test('SKILL.md declares the five-phase, Superpowers-gated contract', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /^---[\s\S]*name:\s*developing-pentaho-jobs[\s\S]*---/);
  // Every Superpowers reasoning/approval/planning/execution skill is reused.
  assert.match(skill, /superpowers:brainstorming/);
  assert.match(skill, /superpowers:writing-plans/);
  assert.match(skill, /superpowers:executing-plans/);
  // Knowledge-first + edit + validate primitives stay named.
  assert.match(skill, /kettle_knowledge_get/);
  assert.match(skill, /kettle_create_file/);
  assert.match(skill, /kettle_validate/);
  // Both reference templates are discoverable from SKILL.md.
  assert.match(skill, /references\/pentaho-spec-template\.md/);
  assert.match(skill, /references\/pentaho-plan-template\.md/);
  // No BA lifecycle tools or requirement-folder surface.
  assert.doesNotMatch(skill, /pentaho_workflow_|pentaho_generate|REQ_</);
});

test('SKILL.md gates edit mutations on BOTH spec AND plan approval', () => {
  const skill = read('SKILL.md');
  // The mutation gate must require the written specification AND the plan,
  // not design approval alone.
  assert.match(skill, /specification/i);
  assert.match(skill, /\bplan\b/i);
  assert.match(skill, /no (mcp )?edit tool/i);
  assert.match(skill, /both[\s\S]{0,80}(specification|spec)[\s\S]{0,80}plan/i);
  // Read/knowledge tools are explicitly allowed before implementation.
  assert.match(skill, /kettle_summary/);
  assert.match(skill, /kettle_knowledge_list/);
  // Knowledge lookup required before each distinct type.
  assert.match(skill, /before[\s\S]{0,80}(each|every) distinct[\s\S]{0,40}type/i);
});

test('SKILL.md phase-gates runtime tools instead of banning them', () => {
  const skill = read('SKILL.md');
  // The absolute prohibition must be gone.
  assert.doesNotMatch(skill, /must not invoke runtime tools/i);
  // Runtime tools are named and part of the surface.
  for (const tool of [
    'kettle_runtime_detect',
    'kettle_runtime_loadcheck',
    'kettle_runtime_execute',
    'kettle_runtime_logs',
  ]) {
    assert.ok(skill.includes(tool), `SKILL.md must name ${tool}`);
  }
  // Runtime forbidden during design/spec/planning/construction phases.
  assert.match(skill, /forbidden[\s\S]{0,160}(brainstorm|specification|planning|construction)/i);
  // Loadcheck permitted only after static validation.
  assert.match(skill, /loadcheck[\s\S]{0,120}(after|only after) static validation/i);
  // Execute requires explicit user approval.
  assert.match(skill, /execute[\s\S]{0,160}(explicit )?(user )?approval/i);
});

test('SKILL.md requires per-artifact and whole-tree static validation', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /after (every|each) (changed )?artifact/i);
  assert.match(skill, /(whole|complete|entire)[- ]?tree/i);
  assert.match(skill, /zero structural errors?/i);
});

test('SKILL.md keeps safety prohibitions but drops the runtime ban', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /must not[\s\S]{0,40}credential/i);
  assert.match(skill, /must not[\s\S]{0,40}deploy/i);
  assert.match(skill, /(git|Git)/);
  assert.match(skill, /(invent|fabricate)[\s\S]{0,40}xml/i);
});

test('specification template contains the required contract sections including runtime acceptance', () => {
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
  // The design now separates static from runtime acceptance criteria.
  assert.match(template, /## Runtime acceptance criteria/);
});

test('plan template is artifact-oriented and names the MCP call contract', () => {
  const plan = read('references', 'pentaho-plan-template.md');
  // Artifact task shape.
  assert.match(plan, /Artifact:/);
  assert.match(plan, /Knowledge lookups:/);
  assert.match(plan, /kettle_knowledge_get/);
  // Ordered MCP edit calls / tool intent.
  assert.match(plan, /kettle_create_file|MCP edit call/);
  // Normal and error hops.
  assert.match(plan, /[Nn]ormal hops?/);
  assert.match(plan, /[Ee]rror hops?/);
  // Focused verification with expected result.
  assert.match(plan, /kettle_validate/);
  assert.match(plan, /[Ee]xpected/);
  // Artifact ordering: leaf .ktr first, orchestration .kjb last.
  assert.match(plan, /leaf[\s\S]{0,40}\.ktr[\s\S]{0,200}\.kjb/i);
});

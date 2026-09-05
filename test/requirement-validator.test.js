import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateRequirement } from '../src/lifecycle/requirement-validator.js';

const body = `# Sample

## 1. Objective and scope
Load rates. Evidence: SRC-001.
## 2. Source contract
| ID | Object | Evidence |
|---|---|---|
| R01 | ODS.RATE | SRC-001 |
## 3. Target contract
Target RPT.RATE per R01.
## 4. Mapping and transformation rules
Keep RATE unchanged (R01, SRC-001).
## 5. Load and operating behaviour
Daily as required by R01.
## 6. Controls, error handling and security
Log counts per R01.
## 7. Acceptance criteria
| ID | Then | Requirement | Evidence |
|---|---|---|---|
| AC01 | Target populated | R01 | SRC-001 |
## 8. Decisions
None.
## 9. Open questions
| Question ID | Blocking | Question | Decision owner |
|---|---|---|---|
## 10. Evidence
| Evidence ID | Input file | Locator | Status |
|---|---|---|---|
| SRC-001 | input/request.md | heading 1 | SUPPORTED |
`;

function makeRequirement(content = body, openQuestions = 0) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'req-validator-'));
  const req = path.join(root, 'REQ_001_SAMPLE');
  mkdirSync(req);
  writeFileSync(path.join(req, 'requirement.md'), `---
artifact_type: etl-requirement
requirement_id: REQ_001_SAMPLE
status: READY_FOR_DESIGN
revision: 1
open_questions: ${openQuestions}
---
${content}`, 'utf8');
  return req;
}

test('valid requirement is READY without human handoff metadata', () => {
  const report = validateRequirement(makeRequirement());
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.equal(report.status, 'READY');
  assert.deepEqual(report.errors, []);
});

test('requirement validator catches missing sections, placeholders, and dangling evidence', () => {
  const broken = body
    .replace('## 3. Target contract', '## Target omitted')
    .replace('SRC-001.\n## 2', 'SRC-999 and {{TODO}}.\n## 2');
  const report = validateRequirement(makeRequirement(broken));
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'SECTION_MISSING'));
  assert.ok(report.errors.some(error => error.code === 'PLACEHOLDER_LEFT'));
  assert.ok(report.errors.some(error => error.code === 'EVIDENCE_UNDEFINED'));
});

test('READY requirement cannot retain a blocking open question', () => {
  const changed = body.replace(
    '|---|---|---|---|\n## 10.',
    '|---|---|---|---|\n| Q01 | YES | Which business key? | BA |\n## 10.',
  );
  const report = validateRequirement(makeRequirement(changed, 1));
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.errors.some(error => error.code === 'BLOCKING_QUESTION'));
});

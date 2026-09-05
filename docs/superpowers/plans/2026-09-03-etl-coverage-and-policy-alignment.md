# ETL Coverage And Policy Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Pentaho lifecycle skills and MCP scaffolding to one safe catalog policy, add guided unknown-type intake and coverage reporting, and document the component types already evidenced in the workspace.

**Architecture:** Keep XML parsing and aggregation in focused pure core modules, expose them through the existing knowledge tool factory, and keep `catalog.yaml` as the only type inventory. Scaffolding consults catalog eligibility before any write; unknown XML intake remains read-only and returns a reviewable candidate rather than mutating shared knowledge.

**Tech Stack:** Node.js 20+ ESM, `fast-xml-parser`, MCP SDK, Node `node:test`, Markdown/YAML knowledge files, Python 3/PyYAML lifecycle validation.

**Spec:** `docs/superpowers/specs/2026-09-03-etl-coverage-and-policy-alignment-design.md`

## Global Constraints

- Do not execute Pan, Kitchen, Spoon, Carte, or production ETL.
- Do not modify production `.kjb`/`.ktr`, BA inputs, requirements, design packages, or project changelogs.
- Preserve unrelated user changes in the dirty parent worktree.
- `kettle-mcp-dte/src/knowledge/pentaho/catalog.yaml` is the sole component inventory.
- Unknown types are read-only-compatible but cannot be newly scaffolded or generated.
- Observed types require explicit opt-in and exactly one `MANUAL_REVIEW` marker.
- Every newly documented type remains `status: observed` and `generator_eligible: false` in this work.
- User-supplied XML is never written to shared knowledge without a separate confirmation.
- Use `apply_patch` for manual file edits and keep changes ASCII unless an edited file already uses Vietnamese text.
- Run Node/npm commands from `DTE-WORKSPACE/kettle-mcp-dte`; run cross-project Python and Git commands from `DTE-WORKSPACE`.

---

### Task 1: Restore A Clean Test Baseline

**Files:**
- Modify: `test/edit.test.js:60`
- Modify: `test/edit2.test.js:144`

**Interfaces:**
- Consumes: existing `setField()` and `cloneFile()` behavior.
- Produces: platform-independent regression assertions; no production API change.

- [ ] **Step 1: Make the missing-child assertion line-ending independent**

Replace the literal LF assertion with normalization of the file under test:

```js
const normalized = after.replaceAll('\r\n', '\n');
assert.ok(normalized.includes('\n    <execute_each_row>Y</execute_each_row>\n  </step>'));
```

- [ ] **Step 2: Make the clone replacement independent of fixture EOL**

Derive the replacement from the fixture's actual EOL and assert that the replacement matched:

```js
const source = readFileSync(src, 'utf8');
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const find = `<connection>conn_a</connection>${eol}    <sql>`;
assert.ok(source.includes(find));
const replacements = [{
  find,
  replace: `<connection>conn_missing</connection>${eol}    <sql>`,
}];
```

- [ ] **Step 3: Run the two focused test files**

Run: `node --test test/edit.test.js test/edit2.test.js`

Expected: both files pass; the clone test reports an undefined connection in the returned validation object.

- [ ] **Step 4: Run the complete MCP suite**

Run: `npm test`

Expected: 102 passing tests and one platform-permission skip, with zero failures before adding new tests.

- [ ] **Step 5: Commit the baseline repair**

```powershell
git add -- kettle-mcp-dte/test/edit.test.js kettle-mcp-dte/test/edit2.test.js
git commit -m "test: make edit assertions newline independent"
```

---

### Task 2: Enforce Catalog Eligibility During Element Scaffolding

**Files:**
- Modify: `src/core/edit.js:15`
- Modify: `src/core/edit.js:173`
- Modify: `src/tools/edit.tools.js:21`
- Modify: `test/add-element.test.js`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Consumes: `findByXmlType(kind, xmlType)` and `isGeneratorEligible(kind, xmlType)` from `src/knowledge/loader.js`.
- Produces: `addElement(filePath, xmlType, name, { x, y, templateXml, allowObserved }) -> { diff, catalogStatus, manualReviewRequired }` and MCP input `allowObserved:boolean`.

- [ ] **Step 1: Write policy tests before changing implementation**

Add tests that prove canonical insertion has no comment, observed insertion is byte-preserving when refused, observed insertion succeeds only with opt-in, and a custom template cannot bypass unknown-type rejection:

```js
test('addElement refuses observed knowledge unless explicitly allowed', () => {
  const before = '<transformation><info><name>x</name></info><order/></transformation>';
  const file = write('observed.ktr', before);
  assert.throws(
    () => edit.addElement(file, 'WriteToLog', 'Log'),
    /status="observed".*allowObserved/,
  );
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('addElement marks explicitly allowed observed knowledge', () => {
  const file = write('observed.ktr', '<transformation><info><name>x</name></info><order/></transformation>');
  const out = edit.addElement(file, 'WriteToLog', 'Log', { allowObserved: true });
  const xml = readFileSync(file, 'utf8');
  assert.equal(out.catalogStatus, 'observed');
  assert.equal(out.manualReviewRequired, true);
  assert.equal((xml.match(/MANUAL_REVIEW/g) || []).length, 1);
});
```

Update existing direct-call tests to read `out.diff` instead of treating the return value as a string.

- [ ] **Step 2: Run the focused tests and observe the intended failures**

Run: `node --test test/add-element.test.js test/smoke.test.js`

Expected: failures show that observed types are currently inserted without opt-in and `addElement` currently returns a string.

- [ ] **Step 3: Add the policy gate before reading or writing the target file**

Import catalog helpers and resolve the catalog row at the start of `addElement`:

```js
import { findByXmlType, getReference, isGeneratorEligible } from '../knowledge/loader.js';

const catalogEntry = findByXmlType(kind, xmlType);
if (!catalogEntry) {
  throw new Error(`No knowledge entry for ${kind} type "${xmlType}"`);
}
const eligible = isGeneratorEligible(kind, catalogEntry.xml_type);
if (!eligible && opts.allowObserved !== true) {
  throw new Error(
    `${kind} type "${catalogEntry.xml_type}" has status="${catalogEntry.status}" and is not generator-eligible; pass allowObserved:true to insert it with MANUAL_REVIEW`,
  );
}
```

This lookup runs even when `templateXml` is supplied, closing the custom-template bypass.

- [ ] **Step 4: Insert one deterministic marker for observed types and return metadata**

Before insertion, prefix the prepared component block using the target file's dominant EOL:

```js
const manualReviewRequired = !eligible;
const marker = `<!-- MANUAL_REVIEW: ${catalogEntry.xml_type} is observed-only; verify in Spoon before production -->`;
const renderedTemplate = manualReviewRequired ? `${marker}${eol}${template}` : template;
```

Return:

```js
return {
  diff: commitEdit(filePath, xml, newXml),
  catalogStatus: catalogEntry.status,
  manualReviewRequired,
};
```

- [ ] **Step 5: Expose the opt-in and preserve the MCP response contract**

Add `allowObserved` to `kettle_add_element.inputSchema.properties` and change its handler to return the core result directly:

```js
allowObserved: {
  type: 'boolean',
  description: 'Allow an observed/ineligible catalog type and add a MANUAL_REVIEW marker',
},
```

```js
handler: a => addElement(resolve(a.path), a.type, a.name, {
  x: a.x,
  y: a.y,
  allowObserved: a.allowObserved === true,
}),
```

- [ ] **Step 6: Run focused and complete tests**

Run: `node --test test/add-element.test.js test/smoke.test.js`

Expected: all policy and smoke tests pass.

Run: `npm test`

Expected: zero failures.

- [ ] **Step 7: Commit the policy enforcement**

```powershell
git add -- kettle-mcp-dte/src/core/edit.js kettle-mcp-dte/src/tools/edit.tools.js kettle-mcp-dte/test/add-element.test.js kettle-mcp-dte/test/smoke.test.js
git commit -m "feat: enforce catalog policy when adding elements"
```

---

### Task 3: Add Read-Only Unknown XML Intake

**Files:**
- Create: `src/core/knowledge-intake.js`
- Modify: `src/tools/knowledge.tools.js`
- Create: `test/knowledge-intake.test.js`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Consumes: `parseModel`, `findAllSpans`, `innerText`, `unescapeXml`, `findByXmlType`, and `XMLValidator`.
- Produces: `analyzeKnowledgeXml(input) -> KnowledgeCandidateReport` and MCP tool `kettle_knowledge_analyze_xml`.

- [ ] **Step 1: Write intake tests for block, artifact, ambiguity, kind, and sensitive values**

Cover these concrete cases:

```js
const report = analyzeKnowledgeXml({
  kind: 'trans',
  xml: '<step><name>CSV source</name><type>CsvInput</type><filename>C:\\drop\\x.csv</filename><password>secret</password></step>',
  pdiVersion: '9.4',
  verification: 'spoon_loaded',
});
assert.equal(report.candidate.xmlType, 'CsvInput');
assert.equal(report.candidate.status, 'observed');
assert.equal(report.candidate.generatorEligible, false);
assert.ok(report.findings.some(x => x.code === 'ABSOLUTE_PATH'));
assert.ok(report.findings.some(x => x.code === 'POSSIBLE_SECRET'));
```

Also assert that a complete transformation with exactly one unknown type selects it, two unknown types return `requiresElementName: true`, `elementName` resolves that ambiguity, root/kind mismatch throws, and no knowledge/catalog file changes during analysis.

- [ ] **Step 2: Run the new test file and observe the missing-module failure**

Run: `node --test test/knowledge-intake.test.js`

Expected: fail because `src/core/knowledge-intake.js` does not exist.

- [ ] **Step 3: Implement component extraction without rebuilding XML**

Export this function:

```js
export function analyzeKnowledgeXml({
  kind,
  xml,
  elementName,
  sourceArtifact,
  pdiVersion,
  plugin,
  verification = 'unverified',
})
```

Validate `kind` and `verification`; use `XMLValidator` first. For a single block, wrap it in a minimal in-memory job/transformation document only for model parsing. For a complete artifact, parse all top-level elements and select by `elementName`, or automatically select the sole element whose type is missing from the catalog. Extract the original component bytes with `findAllSpans` so field order is preserved.

- [ ] **Step 4: Implement deterministic review findings**

Return findings with stable codes:

```js
const SENSITIVE_TAGS = /^(password|passwd|token|secret|apikey|api_key)$/i;
const ABSOLUTE_WINDOWS_PATH = /^[A-Za-z]:[\\/]/;
const ABSOLUTE_UNC_PATH = /^\\\\/;
const URL_VALUE = /^https?:\/\//i;
const IPV4_VALUE = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/;
```

Do not redact or silently alter supplied XML. Report exact tag names but mask sensitive values in findings. Return `missingInformation` for absent PDI version, plugin metadata on non-core-looking types, and provenance.

- [ ] **Step 5: Register the MCP tool**

Add `kettle_knowledge_analyze_xml` to `knowledgeTools()` with enum schemas for `kind` and `verification`, required `kind` and `xml`, and a handler that returns `analyzeKnowledgeXml(a)`.

- [ ] **Step 6: Update smoke expectations and run tests**

Update the expected tool count from 16 to 17 at this checkpoint and assert the new tool name exists.

Run: `node --test test/knowledge-intake.test.js test/smoke.test.js`

Expected: all tests pass.

Run: `npm test`

Expected: zero failures.

- [ ] **Step 7: Commit unknown-type intake**

```powershell
git add -- kettle-mcp-dte/src/core/knowledge-intake.js kettle-mcp-dte/src/tools/knowledge.tools.js kettle-mcp-dte/test/knowledge-intake.test.js kettle-mcp-dte/test/smoke.test.js
git commit -m "feat: analyze unknown Kettle XML for catalog intake"
```

---

### Task 4: Add Knowledge Coverage Reporting

**Files:**
- Create: `src/core/knowledge-coverage.js`
- Modify: `src/tools/knowledge.tools.js`
- Create: `test/knowledge-coverage.test.js`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Consumes: `walkKettleFiles(root)`, `loadModel(file)`, `findByXmlType(kind, type)`, and `isGeneratorEligible(kind, type)`.
- Produces: `knowledgeCoverage(root, { includeExamples = true }) -> CoverageReport` and MCP tool `kettle_knowledge_coverage`.

- [ ] **Step 1: Write coverage aggregation tests**

Build a temporary directory containing one canonical `Dummy`, one observed `WriteToLog`, one missing `CustomStep`, one job entry, and one malformed file. Assert:

```js
assert.deepEqual(report.summary, {
  files: 5,
  parsedFiles: 4,
  scanIssues: 1,
  typeUsages: 4,
  distinctTypes: 4,
  canonical: 2,
  observed: 1,
  missing: 1,
});
assert.equal(report.types.find(x => x.xmlType === 'CustomStep').uses, 1);
assert.equal(report.issues.length, 1);
```

Add a nested field `<type>String</type>` inside a step and prove it is not counted.

- [ ] **Step 2: Run the new test and observe the missing-module failure**

Run: `node --test test/knowledge-coverage.test.js`

Expected: fail because `src/core/knowledge-coverage.js` does not exist.

- [ ] **Step 3: Implement resilient aggregation**

Export:

```js
export function knowledgeCoverage(root, { includeExamples = true } = {})
```

Iterate `walkKettleFiles(root)`, call `loadModel`, and aggregate only `model.elements`. Key rows by `${kind}\0${type}`. Sort output by status priority `missing`, `observed`, `canonical`, then usage descending and XML type ascending. A parse/read failure increments `scanIssues` and appends `{ file, error }` without aborting.

- [ ] **Step 4: Register the read-only MCP tool with root resolution**

Change the factory signature to `knowledgeTools({ resolve, root } = {})` and add:

```js
{
  name: 'kettle_knowledge_coverage',
  description: 'Report canonical, observed, and missing step/entry type usage under KETTLE_ROOT',
  inputSchema: {
    type: 'object',
    properties: {
      directory: str('Directory under KETTLE_ROOT to scan'),
      includeExamples: { type: 'boolean' },
    },
  },
  handler: a => knowledgeCoverage(resolve(a.directory) ?? root, {
    includeExamples: a.includeExamples !== false,
  }),
}
```

- [ ] **Step 5: Update smoke expectations and run tests**

Update expected tool count to 18 and assert both new knowledge tools are present.

Run: `node --test test/knowledge-coverage.test.js test/knowledge.test.js test/smoke.test.js`

Expected: all pass.

Run: `npm test`

Expected: zero failures.

- [ ] **Step 6: Commit coverage reporting**

```powershell
git add -- kettle-mcp-dte/src/core/knowledge-coverage.js kettle-mcp-dte/src/tools/knowledge.tools.js kettle-mcp-dte/test/knowledge-coverage.test.js kettle-mcp-dte/test/smoke.test.js
git commit -m "feat: report Kettle catalog coverage"
```

---

### Task 5: Add Evidence-Backed Catalog Types

**Files:**
- Modify: `src/knowledge/pentaho/catalog.yaml`
- Create: `src/knowledge/pentaho/trans/BlockUntilStepsFinish.md`
- Create: `src/knowledge/pentaho/trans/CsvInput.md`
- Create: `src/knowledge/pentaho/trans/PropertyInput.md`
- Create: `src/knowledge/pentaho/trans/StringCut.md`
- Create: `src/knowledge/pentaho/trans/RandomValue.md`
- Create: `src/knowledge/pentaho/trans/ProcessFiles.md`
- Create: `src/knowledge/pentaho/trans/DataGrid.md`
- Create: `src/knowledge/pentaho/trans/JobExecutor.md`
- Create: `src/knowledge/pentaho/trans/XMLOutput.md`
- Create: `src/knowledge/pentaho/trans/OraBulkLoader.md`
- Create: `src/knowledge/pentaho/trans/SetSessionVariableStep.md`
- Create: `src/knowledge/pentaho/trans/TypeExitExcelWriterStep.md`
- Create: `src/knowledge/pentaho/trans/Sequence.md`
- Create: `src/knowledge/pentaho/job/EVAL_FILES_METRICS.md`
- Create: `src/knowledge/pentaho/job/CHECK_DB_CONNECTIONS.md`
- Create: `src/knowledge/pentaho/job/FILES_EXIST.md`
- Create: `src/knowledge/pentaho/job/DELETE_FOLDERS.md`
- Create: `src/knowledge/pentaho/job/DELETE_FILES.md`
- Create: `src/knowledge/pentaho/job/DELAY.md`
- Create: `src/knowledge/pentaho/job/XSLT.md`
- Create: `src/knowledge/pentaho/job/EXPORT_REPOSITORY.md`
- Modify: `test/knowledge.test.js`

**Interfaces:**
- Consumes: real source artifact blocks and the existing five-section knowledge format.
- Produces: 21 catalog rows resolvable by aliases and XML types, all observed and ineligible.

- [ ] **Step 1: Add catalog integrity tests before adding rows**

Add a test that iterates both kinds, checks unique aliases and XML types within each kind, resolves every reference file, extracts the first fenced XML block, and verifies it is one valid `<entry>` or `<step>` root. Add explicit assertions for all 21 XML types and for `generator_eligible === false`.

- [ ] **Step 2: Run the knowledge test and observe missing-type failures**

Run: `node --test test/knowledge.test.js`

Expected: fail on the first absent catalog type.

- [ ] **Step 3: Extract the first-cohort transformation blocks from exact evidence**

Use top-level step extraction from these source artifacts; do not copy sibling steps or shared connection definitions:

```text
BlockUntilStepsFinish -> ../old_src/trans/etl_trans_fin_smb_pnl_trans_monthly.ktr
CsvInput              -> ../old_src/trans/trans_file_gl_ap_tamung_chitiet.ktr
PropertyInput         -> test/fixtures/bcqt_kpcs/trans_load_from_input.ktr
StringCut             -> ../old_src/trans/trans_mbg_get_variable_prd_m.ktr
RandomValue           -> ../old_src/trans/etl_trans_ftp_dieuchinh_call_api_t24.ktr
ProcessFiles          -> ../old_src/trans/etl_trans_ftp_dieuchinh_rename_file.ktr
DataGrid              -> ../old_src/trans/trans_ftp_cus_revert_gen_params.ktr
JobExecutor           -> ../old_src/trans/etl_trans_loop_date_ods_cal_hhmg_fx.ktr
XMLOutput             -> ../old_src/trans/trans_gen_xml_daily_warning.ktr
```

For each file, create the five required sections and replace project-specific names, paths,
credentials, endpoints, schemas, and values with descriptive placeholders documented in the
YAML-to-XML table. Record the exact source artifact and `source PDI version: not established` when
the file does not establish it.

- [ ] **Step 4: Extract first-cohort job blocks from exact evidence**

```text
EVAL_FILES_METRICS -> ../old_src/job/job_file_ftp_ref_tyle_phanra.kjb
CHECK_DB_CONNECTIONS -> ../old_src/job/Job_canhbao_connection.kjb
FILES_EXIST -> ../old_src/job/job_file_gl_fa_trans_tscd.kjb
DELETE_FOLDERS -> ../old_src/job/job_run_export_job_tran_to_file.kjb
DELETE_FILES -> ../old_src/job/job_combine_and_send_email.kjb
DELAY -> ../old_src/job_dba/job/etl_job_engine_tckt_ftp_tt2_bieulaisuat.kjb
XSLT -> ../old_src/job/job_combine_and_send_email.kjb
```

Apply the same five-section, sanitization, and provenance rules.

- [ ] **Step 5: Extract compatibility-sensitive blocks**

```text
OraBulkLoader -> ../old_src/trans/trans_ftp_f1_rdf.ktr
SetSessionVariableStep -> ../old_src/trans/etl_trans_f2b_get_token.ktr
TypeExitExcelWriterStep -> ../dte-etl-pentaho/xuat_user_active/etl_trans_ods_users_active_excel_export.ktr
Sequence -> ../kettle-mcp/examples/sample_kettle_files/sample_transformation.ktr
EXPORT_REPOSITORY -> ../old_src/job/job_backup_repo_tckt.kjb
```

Record plugin identity only when visible in the artifact or accompanying repository evidence;
otherwise state that the plugin is not established. Never infer PDI 11 compatibility.

- [ ] **Step 6: Add catalog rows with one uniform safety state**

Each row follows this shape:

```yaml
- {type: BLOCK_UNTIL_STEPS_FINISH, xml_type: BlockUntilStepsFinish, file: trans/BlockUntilStepsFinish.md, status: observed, generator_eligible: false}
```

Use unambiguous uppercase aliases for all remaining rows, retain existing ordering by kind, and do not change existing statuses.

- [ ] **Step 7: Run catalog tests and a coverage comparison**

Run: `node --test test/knowledge.test.js test/knowledge-intake.test.js test/knowledge-coverage.test.js`

Expected: every row resolves and every new template is valid.

Run `kettle_knowledge_coverage` against the workspace fixture tree and verify the newly added XML types move from `missing` to `observed`; no type becomes canonical.

- [ ] **Step 8: Commit catalog expansion**

```powershell
git add -- kettle-mcp-dte/src/knowledge/pentaho/catalog.yaml kettle-mcp-dte/src/knowledge/pentaho/job kettle-mcp-dte/src/knowledge/pentaho/trans kettle-mcp-dte/test/knowledge.test.js
git commit -m "feat: document observed Kettle component types"
```

---

### Task 6: Align Lifecycle Skills To The MCP Catalog

**Files:**
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/SKILL.md`
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/references/entry-type-catalog.md`
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/references/generation-process.md`
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/references/kjb-xml-standard.md`
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/references/ktr-xml-standard.md`
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/references/mcp-generation.md`
- Modify: `../dte-ai-context/skills/generating-pentaho-from-design/SKILL.mcp-draft.md`
- Modify: `../dte-ai-context/skills/modifying-pentaho-jobs/SKILL.md`
- Modify: `../dte-ai-context/skills/modifying-pentaho-jobs/references/xml-patch-rules.md`
- Modify: `../dte-ai-context/skills/learning-from-mistakes/SKILL.md`
- Modify: `../dte-ai-context/skills/learning-from-mistakes/references/knowledge-update-protocol.md`
- Modify: `../dte-ai-context/skills/designing-pentaho-solutions/SKILL.md`
- Modify: `../dte-ai-context/skills/designing-pentaho-solutions/references/design-readiness-checklist.md`
- Create: `../dte-ai-context/tests/test_skill_catalog_contract.py`

**Interfaces:**
- Consumes: the MCP catalog path and `kettle_knowledge_analyze_xml` behavior from Tasks 3 and 5.
- Produces: one consistent unknown/observed workflow across active lifecycle skills.

- [ ] **Step 1: Write a deterministic documentation contract test**

The test reads active skill/reference files and asserts:

```python
REMOVED_PATH = "dte-ai-context/knowledge/pentaho"
ACTIVE_FILES = [
    "skills/generating-pentaho-from-design/SKILL.md",
    "skills/modifying-pentaho-jobs/SKILL.md",
    "skills/learning-from-mistakes/SKILL.md",
]

for relative in ACTIVE_FILES:
    text = (ROOT / relative).read_text(encoding="utf-8")
    assert REMOVED_PATH not in text
    assert "kettle-mcp-dte/src/knowledge/pentaho" in text
```

Also assert that active generation guidance contains `CATALOG_GAP`,
`kettle_knowledge_analyze_xml`, and “unknown types stop generation”; observed guidance contains
known-gap authorization and `MANUAL_REVIEW`.

- [ ] **Step 2: Run the contract test and observe failures on stale paths/policies**

Run: `python -m unittest dte-ai-context/tests/test_skill_catalog_contract.py`

Expected: fail because generation, modification, and learning skills still contain the removed path.

- [ ] **Step 3: Update the design skill with catalog-gap intake**

When a required type is absent, require the agent to request a working artifact or complete XML block plus PDI/plugin/verification metadata, call `kettle_knowledge_analyze_xml`, present the candidate, and wait for confirmation before adding an observed row. Keep the design blocked as `CATALOG_GAP` until `validate_types.py` resolves the type.

- [ ] **Step 4: Update generation and modification policies**

Generation must stop on unknown types instead of best-effort generation. It may generate an observed type only when the approved design has the matching known-gap technical decision, and it must emit one review marker. Modification may preserve existing unknown XML but cannot add another unknown type; adding one uses the same catalog-gap intake.

- [ ] **Step 5: Move learning references to embedded knowledge**

Change lessons and knowledge-update destinations to:

```text
kettle-mcp-dte/src/knowledge/pentaho/lessons-learned.md
kettle-mcp-dte/src/knowledge/pentaho/catalog.yaml
kettle-mcp-dte/src/knowledge/pentaho/job/<TYPE>.md
kettle-mcp-dte/src/knowledge/pentaho/trans/<TYPE>.md
```

Retain append-only lesson IDs and provenance rules.

- [ ] **Step 6: Remove the duplicated inventory from the quick catalog**

Keep field mapping rules 1-8, but replace static job/trans tables with instructions to call
`kettle_knowledge_list`/`kettle_knowledge_get` or read `catalog.yaml`. This makes
`entry-type-catalog.md` a convention guide, not a second inventory.

- [ ] **Step 7: Retire obsolete MCP guidance from the active path**

Add a top-of-file legacy notice to `SKILL.mcp-draft.md` and `mcp-generation.md` stating that their
`save_kettle_*`, `validate_kettle_*`, and `execute_kettle_*` APIs belong to another MCP and must not
be used with `kettle-mcp-dte`. Remove `mcp-generation.md` from any active required-reading list.

- [ ] **Step 8: Run skill and type validation tests**

Run: `python -m unittest dte-ai-context/tests/test_skill_catalog_contract.py`

Expected: pass.

Run: `python dte-ai-context/validation/validate_types.py --help`

Expected: exit 0, show command usage and document the `--catalog` override without import errors.

- [ ] **Step 9: Commit lifecycle alignment**

```powershell
git add -- dte-ai-context/skills dte-ai-context/tests/test_skill_catalog_contract.py
git commit -m "docs: align ETL skills with Kettle MCP catalog"
```

---

### Task 7: Update Public Documentation And Run Final Verification

**Files:**
- Modify: `README.md`
- Modify: `src/knowledge/pentaho/README.md`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Consumes: all public tool schemas and policies from Tasks 2-6.
- Produces: accurate documentation for 18 MCP tools and the catalog-gap workflow.

- [ ] **Step 1: Update README tool inventory and safety semantics**

Change the tool count to 18, list `kettle_knowledge_analyze_xml` and
`kettle_knowledge_coverage`, document `allowObserved`, and state that unknown types are accepted for
read/validation but rejected by scaffolding until catalog intake completes.

- [ ] **Step 2: Update the embedded knowledge workflow**

Document the evidence order, analyzer output, required user confirmation, observed default, PDI
target requirement for canonical promotion, and the prohibition on copying secrets/endpoints/local
paths into templates.

- [ ] **Step 3: Verify exact tool registration through stdio**

Ensure `test/smoke.test.js` asserts 18 tools and explicitly includes:

```js
assert.ok(list.result.tools.some(t => t.name === 'kettle_knowledge_analyze_xml'));
assert.ok(list.result.tools.some(t => t.name === 'kettle_knowledge_coverage'));
```

Run: `node --test test/smoke.test.js`

Expected: pass with exactly 18 tools.

- [ ] **Step 4: Run all automated verification**

Run: `npm test`

Expected: zero failures.

Run: `python -m unittest dte-ai-context/tests/test_skill_catalog_contract.py`

Expected: zero failures.

Run: `git diff --check`

Expected: no whitespace errors in files changed by this implementation.

- [ ] **Step 5: Inspect the final diff for scope and secrets**

Run: `git diff --stat f775f08`

Expected: changes are limited to `kettle-mcp-dte`, the listed lifecycle skill/reference files, and
the new deterministic skill contract test. Inspect new knowledge templates for credentials,
absolute paths, real endpoints, and accidental edits to production Kettle artifacts.

- [ ] **Step 6: Commit documentation**

```powershell
git add -- kettle-mcp-dte/README.md kettle-mcp-dte/src/knowledge/pentaho/README.md kettle-mcp-dte/test/smoke.test.js
git commit -m "docs: document Kettle catalog intake and coverage"
```

- [ ] **Step 7: Report completion with explicit runtime limitation**

Report the new tool count, catalog totals, test totals, and skill contract result. State explicitly
that newly added types remain observed because no Spoon/PDI 11 runtime validation was performed.

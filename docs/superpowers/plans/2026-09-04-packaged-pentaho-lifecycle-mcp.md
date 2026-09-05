# Packaged Pentaho Lifecycle MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a versioned Windows-local Kiro MCP that resumes a BA-folder workflow, writes requirement and design artifacts, generates/synchronizes Pentaho artifacts, optionally validates with Kitchen/Pan, and ships as a self-contained executable release.

**Architecture:** Keep Kiro as the reasoning agent and extend the current Node MCP with prompts/resources plus high-level lifecycle tools. New pure modules own project configuration, workflow recovery, documentation contracts, generation, synchronization, and runtime execution; existing span-based Kettle tools remain the low-level XML layer. Package the production profile as a Windows executable with immutable embedded knowledge and no learning/promotion surface.

**Tech Stack:** Node.js ESM, `@modelcontextprotocol/sdk`, `fast-xml-parser`, `yaml`, Node test runner, Node child processes, Windows PowerShell, Node Single Executable Application tooling.

**Spec:** `kettle-mcp-dte/docs/superpowers/specs/2026-09-04-packaged-pentaho-lifecycle-mcp-design.md`

## Global Constraints

- Target Windows 10/11 and Kiro IDE/CLI through local stdio MCP.
- Accept only Markdown files under BA-owned `input/`; never mutate `input/`.
- Resolve project paths only from committed `.pentaho-mcp.yaml`; never hard-code `dte-*` names.
- Never invent business facts; return a structured blocker when evidence is missing or conflicting.
- Do not require human approval for requirement or design readiness.
- Never overwrite existing artifacts blindly; inspect, hash, validate, and choose resume/patch or request a decision.
- Git is read-only unless the user explicitly requests a Git mutation. This plan performs no commits.
- Production knowledge is read-only and excludes learning/catalog-promotion tools.
- Kitchen/Pan may auto-execute only in `DEV` or `TEST`; unknown and other environments require confirmation.
- Every task finishes with tests and a reviewable diff; no task commits changes.

---

### Task 1: Project Configuration and Safe Workspace Paths

**Files:**
- Create: `kettle-mcp-dte/src/project/config.js`
- Create: `kettle-mcp-dte/src/project/paths.js`
- Create: `kettle-mcp-dte/test/project-config.test.js`
- Modify: `kettle-mcp-dte/package.json`

**Interfaces:**
- Produces: `loadProjectConfig(workspaceRoot) -> ProjectConfig`
- Produces: `resolveProjectPath(config, key, ...segments) -> string`
- Produces: `assertInsideRoots(config, targetPath, { write, input }) -> string`
- `ProjectConfig` contains `{ workspaceRoot, file, schemaVersion, projectCode, paths, environment, pentahoHome }`.

- [x] **Step 1: Add failing configuration tests**

Cover valid YAML, missing config, unknown keys, absolute configured paths, `..` escapes, case-insensitive Windows containment, an `input/` write refusal, and project-specific names such as `abc-docs`.

```js
assert.equal(loadProjectConfig(root).paths.requirements, path.join(root, 'abc-docs'));
assert.throws(() => assertInsideRoots(cfg, inputFile, { write: true }), /input.*read-only/i);
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `node --test test/project-config.test.js`
Expected: FAIL because `src/project/config.js` does not exist.

- [x] **Step 3: Add YAML dependency and implement strict parsing**

Add `yaml` to dependencies. Parse exactly one mapping document, require `schema_version: 1`,
`project.code`, `paths.requirements`, and `paths.pentaho`, and reject absolute or escaping paths.
Treat `paths.ai_context` and `pentaho.home` as optional. Environment defaults to `UNKNOWN`.

- [x] **Step 4: Implement canonical boundary checks**

Resolve paths with `path.resolve`, compare case-insensitively on Windows, use `realpathSync` for
existing ancestors, and reject writes under any `<REQ>/input` subtree.

- [x] **Step 5: Run focused and full tests**

Run: `node --test test/project-config.test.js && node --test`
Expected: all tests pass.

### Task 2: Workflow Inspection, State, Locking, and Resume Decisions

**Files:**
- Create: `kettle-mcp-dte/src/workflow/hash.js`
- Create: `kettle-mcp-dte/src/workflow/state.js`
- Create: `kettle-mcp-dte/src/workflow/inspect.js`
- Create: `kettle-mcp-dte/src/workflow/lock.js`
- Create: `kettle-mcp-dte/test/workflow-state.test.js`
- Create: `kettle-mcp-dte/test/workflow-inspect.test.js`

**Interfaces:**
- Consumes: `ProjectConfig` and safe-path helpers from Task 1.
- Produces: `hashTree(files) -> sha256 string` using sorted workspace-relative paths and bytes.
- Produces: `readWorkflowState(reqDir)`, `writeWorkflowState(reqDir, state)`.
- Produces: `inspectWorkflow(config, reqDir) -> WorkflowInspection`.
- Produces: `decideNextStage(inspection) -> { stage, reason, blockers, staleArtifacts }`.
- Produces: `withWorkflowLock(reqDir, callback, options)`.

- [x] **Step 1: Write failing state/recovery tests**

Fixtures cover no prior state, requirement-only, design-only invalidity, partial generation,
unchanged completion, changed input, manual XML change, stale state, live lock, stale lock, and
concurrent file modification.

```js
assert.deepEqual(decideNextStage(changedInput), {
  stage: 'REQUIREMENT', reason: 'INPUT_CHANGED', blockers: [],
  staleArtifacts: ['requirement', 'design', 'runtime'],
});
```

- [x] **Step 2: Verify focused tests fail**

Run: `node --test test/workflow-state.test.js test/workflow-inspect.test.js`
Expected: FAIL on missing workflow modules.

- [x] **Step 3: Implement deterministic hashes and atomic state writes**

Write `workflow-state.yaml.tmp`, fsync/close, then rename. Store schema version, MCP version,
input hash, artifact hashes/revisions, current/last-completed stage, timestamp, and validation
summary. Never treat the state file as stronger evidence than current artifact bytes.

- [x] **Step 4: Implement inspection and stage decision table**

Inventory supported input, docs, design YAML, changelog, declared runtime project, and Git diff via
read-only `git status --porcelain` when Git exists. Return `USER_DECISION_REQUIRED` only for
irreconcilable divergent changes; otherwise resume the earliest stale/incomplete stage.

- [x] **Step 5: Implement per-requirement locking**

Use exclusive creation of `.pentaho-workflow.lock`, include PID/session/timestamp, refresh while a
mutation is active, and recover a stale lock only after reinspection. Always release in `finally`.

- [x] **Step 6: Run focused and full tests**

Run: `node --test test/workflow-state.test.js test/workflow-inspect.test.js && node --test`
Expected: all tests pass.

### Task 3: MCP Prompts, Resources, and Lifecycle Registry

**Files:**
- Create: `kettle-mcp-dte/src/lifecycle/catalog.js`
- Create: `kettle-mcp-dte/src/lifecycle/resources.js`
- Create: `kettle-mcp-dte/src/lifecycle/prompts.js`
- Create: `kettle-mcp-dte/src/lifecycle/developing-pentaho-jobs.md`
- Copy/adapt: active deployed guidance and required assets from `dte-ai-context/skills/`
- Modify: `kettle-mcp-dte/src/server.js`
- Create: `kettle-mcp-dte/test/lifecycle-surface.test.js`
- Modify: `kettle-mcp-dte/test/smoke.test.js`

**Interfaces:**
- Produces: `listLifecycleResources()`, `readLifecycleResource(uri)`.
- Produces: `listLifecyclePrompts()`, `getLifecyclePrompt(name, args)`.
- Produces MCP prompt `develop-pentaho-job` with required `requirementFolder` argument.
- Resources use stable URIs such as `dte-pentaho://skills/writing-etl-requirements`.

- [x] **Step 1: Write failing MCP capability tests**

Assert initialize advertises tools/prompts/resources; `prompts/list`, `prompts/get`,
`resources/list`, and `resources/read` return deployed lifecycle content; assert learning and
promotion guidance are absent.

- [x] **Step 2: Verify tests fail**

Run: `node --test test/lifecycle-surface.test.js test/smoke.test.js`
Expected: FAIL because the server currently advertises tools only.

- [x] **Step 3: Implement an immutable deployed resource catalog**

Embed the orchestrator, requirement, design, generation, modification, templates, and references
needed at runtime. Rewrite approval-gate and single-phase language to match the approved spec.
Keep business-fact safeguards and catalog-gap behavior. Do not expose filesystem paths outside the
package.

- [x] **Step 4: Register MCP prompts/resources**

Use SDK request schemas for listing/getting prompts and listing/reading resources. Return concise
orchestrator instructions that require project inspection first and call high-level lifecycle
tools rather than writing unvalidated files directly.

- [x] **Step 5: Run focused and full tests**

Run: `node --test test/lifecycle-surface.test.js test/smoke.test.js && node --test`
Expected: all tests pass and the original 18 Kettle tools remain present.

### Task 4: JavaScript Requirement and Design Validation

**Files:**
- Create: `kettle-mcp-dte/src/lifecycle/requirement-validator.js`
- Create: `kettle-mcp-dte/src/lifecycle/design-loader.js`
- Create: `kettle-mcp-dte/src/lifecycle/design-validator.js`
- Create: `kettle-mcp-dte/src/lifecycle/diagram-renderer.js`
- Create: `kettle-mcp-dte/test/requirement-validator.test.js`
- Create: `kettle-mcp-dte/test/design-validator.test.js`
- Create: `kettle-mcp-dte/test/diagram-renderer.test.js`

**Interfaces:**
- Produces: `validateRequirement(reqDir) -> ValidationReport`.
- Produces: `loadDesignPackage(designDir) -> { manifest, jobs, transformations }`.
- Produces: `validateDesign(designDir, catalog) -> ValidationReport`.
- Produces: `renderDesignDiagrams(designPackage) -> string` and
  `writeDesignDiagrams(designDir) -> { changed, diff }`.

- [x] **Step 1: Port existing Python behavior into failing parity tests**

Reuse fixtures and assertions from `dte-ai-context/tests`. Remove human approval requirements,
retain sections, evidence references, ID integrity, placeholder checks, graph integrity, catalog
eligibility, known-gap markers, traceability, and stale-diagram detection.

- [x] **Step 2: Verify parity tests fail**

Run: `node --test test/requirement-validator.test.js test/design-validator.test.js test/diagram-renderer.test.js`
Expected: FAIL on missing modules.

- [x] **Step 3: Implement requirement validation in Node**

Parse front matter and Markdown tables without executing content. Require the ten artifact
sections, source/requirement references, open-question consistency, and zero blocking questions
for `READY`; allow technical readiness metadata in place of human handoff fields.

- [x] **Step 4: Implement design loading, validation, and diagrams**

Use `yaml.parseAllDocuments`, enforce one mapping per file, resolve declared components safely,
validate IDs/hops/references/types/traceability/secrets, and port deterministic Mermaid rendering.
Update only the marked generated diagram region.

- [x] **Step 5: Run parity and full tests**

Run: `node --test test/requirement-validator.test.js test/design-validator.test.js test/diagram-renderer.test.js && node --test`
Expected: all tests pass without Python or PyYAML.

### Task 5: High-Level Inspect, Status, Requirement, and Design Tools

**Files:**
- Create: `kettle-mcp-dte/src/tools/lifecycle.tools.js`
- Create: `kettle-mcp-dte/src/lifecycle/artifact-write.js`
- Modify: `kettle-mcp-dte/src/tools/registry.js`
- Create: `kettle-mcp-dte/test/lifecycle-tools.test.js`

**Interfaces:**
- Consumes: config, inspection/state/lock, and validators from Tasks 1-4.
- Produces tools `pentaho_project_inspect`, `pentaho_workflow_start`,
  `pentaho_workflow_status`, `pentaho_requirement_write`, and `pentaho_design_write`.
- `writeArtifactSet(files, expectedHashes) -> { files, diffs, hashes }` performs compare-and-swap
  atomic writes.

- [x] **Step 1: Write failing tool-contract tests**

Assert schemas require `workspaceRoot` and `requirementFolder`; writes reject unsupported input,
input mutation, missing evidence, stale expected hashes, invalid design, and out-of-root paths.
Assert status reconstructs state when `workflow-state.yaml` is wrong.

- [x] **Step 2: Verify tests fail**

Run: `node --test test/lifecycle-tools.test.js`
Expected: FAIL because lifecycle tool factory is not registered.

- [x] **Step 3: Implement compare-and-swap artifact writes**

Every mutating call receives expected hashes from the preceding inspection. Re-read before rename;
if bytes changed, return `CONCURRENT_CHANGE` without writing. Return per-file unified diffs and
updated hashes.

- [x] **Step 4: Implement and register the five lifecycle tools**

Write supplied agent-authored Markdown/YAML only after deterministic validation. Requirement write
sets technical readiness; design write validates the full set and regenerates diagrams. Update
workflow state only after all files in a stage are consistent.

- [x] **Step 5: Run focused and full tests**

Run: `node --test test/lifecycle-tools.test.js test/smoke.test.js && node --test`
Expected: all tests pass and tool listing contains both original and lifecycle tools.

### Task 6: Deterministic Design-to-Kettle Generation

**Files:**
- Create: `kettle-mcp-dte/src/generation/generate.js`
- Create: `kettle-mcp-dte/src/generation/job.js`
- Create: `kettle-mcp-dte/src/generation/transformation.js`
- Create: `kettle-mcp-dte/src/generation/infrastructure.js`
- Create: `kettle-mcp-dte/src/generation/validate-generation.js`
- Create: `kettle-mcp-dte/test/generation.test.js`
- Add fixtures: `kettle-mcp-dte/test/fixtures/lifecycle/ready-design/`
- Modify: `kettle-mcp-dte/src/tools/lifecycle.tools.js`

**Interfaces:**
- Produces: `planGeneration(config, designPackage) -> GenerationPlan`.
- Produces: `generateProject(plan, expectedHashes) -> GenerationResult`.
- Produces tool `pentaho_generate`.

- [x] **Step 1: Write a failing vertical generation test**

Use a ready design containing a job and TableInput-to-TableOutput transformation. Assert exact file
inventory, names, SQL escaping, fields, hops, connections, parameter propagation, relative paths,
deterministic coordinates, no placeholders/secrets, and successful `kettle_validate` reports.

- [x] **Step 2: Verify generation test fails**

Run: `node --test test/generation.test.js`
Expected: FAIL on missing generation module.

- [x] **Step 3: Implement a no-write generation plan**

Load all catalog references before writing. Reject absent types; require an explicit known-gap
decision before observed types and emit exactly one `MANUAL_REVIEW` marker. Refuse a non-empty
unmanaged target directory and compute the full expected inventory.

- [x] **Step 4: Implement atomic job/transformation generation**

Use catalog XML templates and existing XML helpers. Translate only values present in design YAML,
apply documented boolean/file/schema/field rules, and generate job hops, transformation hops, and
error handling deterministically.

- [x] **Step 5: Implement infrastructure and generation reconciliation**

Generate variable-only shared connections/properties, launchers, optional DDL/advisory, and initial
changelog. Validate artifact counts, internal names, references, graph equality, fields, SQL,
secrets, absolute paths, and placeholders before promoting temporary output.

- [x] **Step 6: Expose `pentaho_generate` and run all tests**

Run: `node --test test/generation.test.js && node --test`
Expected: all tests pass; failure leaves diagnostic temporary output marked incomplete.

### Task 7: Manual-Edit Detection and Delta Synchronization

**Files:**
- Create: `kettle-mcp-dte/src/sync/diff-runtime-design.js`
- Create: `kettle-mcp-dte/src/sync/apply-design-delta.js`
- Create: `kettle-mcp-dte/src/sync/changelog.js`
- Create: `kettle-mcp-dte/test/sync-changes.test.js`
- Modify: `kettle-mcp-dte/src/tools/lifecycle.tools.js`

**Interfaces:**
- Produces: `diffRuntimeDesign(designPackage, artifactModels) -> RuntimeDesignDelta[]`.
- Produces: `applyDesignDelta(designDir, deltas, expectedHashes) -> SyncResult`.
- Produces tool `pentaho_sync_changes`.

- [x] **Step 1: Write failing synchronization scenarios**

Cover SQL, field, connection, name, hop, visual-coordinate-only, unknown XML, and business-semantic
changes. Assert visual-only changes do not rewrite design; technical changes patch only affected
YAML/Markdown/diagram regions; semantic conflicts return `USER_DECISION_REQUIRED`.

- [x] **Step 2: Verify tests fail**

Run: `node --test test/sync-changes.test.js`
Expected: FAIL on missing sync modules.

- [x] **Step 3: Implement normalized runtime/design comparison**

Use existing Kettle models and catalog mapping to compare names, types, critical configuration,
SQL, fields, and topology. Ignore coordinates and irrelevant serialization differences. Return
stable paths and old/new values rather than prose-only differences.

- [x] **Step 4: Implement targeted YAML/design/changelog patches**

Patch affected design nodes, regenerate impacted diagram blocks, increment design revision once,
and prepend one append-only `CHG-NNN`. Update requirement only when a caller explicitly supplies an
evidence-backed business change.

- [x] **Step 5: Expose the tool and run all tests**

Run: `node --test test/sync-changes.test.js && node --test`
Expected: all tests pass with minimal diffs.

### Task 8: Optional Kitchen/Pan Runtime Adapter

**Files:**
- Create: `kettle-mcp-dte/src/runtime/detect.js`
- Create: `kettle-mcp-dte/src/runtime/policy.js`
- Create: `kettle-mcp-dte/src/runtime/run.js`
- Create: `kettle-mcp-dte/src/runtime/redact.js`
- Create: `kettle-mcp-dte/src/tools/runtime.tools.js`
- Create: `kettle-mcp-dte/test/runtime.test.js`
- Add fixtures: `kettle-mcp-dte/test/fixtures/fake-pdi/`
- Modify: `kettle-mcp-dte/src/tools/registry.js`

**Interfaces:**
- Produces: `detectPdi(config) -> RuntimeDetection`.
- Produces: `executionPolicy(environment, confirmed) -> ALLOW | CONFIRM_REQUIRED`.
- Produces: `runPdi({ kind, artifact, parameters, mode, timeoutMs }, context) -> RuntimeReport`.
- Produces tools `kettle_runtime_detect`, `kettle_runtime_loadcheck`,
  `kettle_runtime_execute`, and `kettle_runtime_logs`.

- [x] **Step 1: Write failing fake-runtime and security tests**

Assert executable resolution stays beneath PDI home; arguments preserve spaces without shell
concatenation; DEV/TEST auto-run; PROD/UNKNOWN require confirmation; timeout/cancel/exit codes are
reported; credentials and sensitive parameters are redacted.

- [x] **Step 2: Verify tests fail**

Run: `node --test test/runtime.test.js`
Expected: FAIL on missing runtime modules.

- [x] **Step 3: Implement detection and policy**

Resolve `Kitchen.bat` and `Pan.bat` beneath configured PDI home, run help/version probes with
argument arrays and `shell: false`, cache by home/version, and distinguish unavailable from failed.

- [x] **Step 4: Implement loadcheck and controlled execution**

Run static validation first. Use supported list/load behavior detected from the installed PDI
version for loadcheck. Execute only after policy allows it; constrain working directory, parameters,
environment, output size, and timeout. Persist sanitized logs inside the workflow artifact area.

- [x] **Step 5: Register runtime tools and run all tests**

Run: `node --test test/runtime.test.js test/smoke.test.js && node --test`
Expected: all tests pass without a real Pentaho installation.

### Task 9: Finalization Report and End-to-End Resume Workflow

**Files:**
- Create: `kettle-mcp-dte/src/lifecycle/finalize.js`
- Create: `kettle-mcp-dte/test/lifecycle-e2e.test.js`
- Add fixtures: `kettle-mcp-dte/test/fixtures/lifecycle/`
- Modify: `kettle-mcp-dte/src/tools/lifecycle.tools.js`

**Interfaces:**
- Produces: `finalizeWorkflow(config, reqDir) -> FinalizationReport`.
- Produces tool `pentaho_validate_project` and `pentaho_finalize`.

- [x] **Step 1: Write failing end-to-end tests**

Test a complete Markdown-input workflow, interruption after each phase, changed input, manual job
edit, absent PDI, passing fake PDI, runtime failure, unchanged rerun, and dirty unrelated Git files.
Assert docs and runtime artifacts exist, state resumes correctly, Git is unmodified, and completion
claims match validation evidence.

- [x] **Step 2: Verify tests fail**

Run: `node --test test/lifecycle-e2e.test.js`
Expected: FAIL on missing finalization and tools.

- [x] **Step 3: Implement validation aggregation and final report**

Aggregate requirement, design, generation, Kettle static, reconciliation, PDI load, and execution
states without collapsing `NOT_RUN` into pass. Return artifact inventory, changed paths, concise
diffs, blockers, MCP/PDI versions, and next safe action.

- [x] **Step 4: Register tools and run all tests**

Run: `node --test test/lifecycle-e2e.test.js && node --test`
Expected: all tests pass and no test creates a Git commit.

### Task 10: Production Profile and Windows Executable Release

**Files:**
- Create: `kettle-mcp-dte/scripts/build-release.mjs`
- Create: `kettle-mcp-dte/scripts/verify-production-profile.mjs`
- Create: `kettle-mcp-dte/packaging/sea-config.json`
- Create: `kettle-mcp-dte/packaging/install.ps1`
- Create: `kettle-mcp-dte/packaging/uninstall.ps1`
- Create: `kettle-mcp-dte/packaging/doctor.ps1`
- Create: `kettle-mcp-dte/packaging/config.example.yaml`
- Create: `kettle-mcp-dte/test/packaging.test.js`
- Modify: `kettle-mcp-dte/package.json`
- Modify: `kettle-mcp-dte/README.md`
- Modify: `kettle-mcp-dte/docs/install.md`

**Interfaces:**
- Produces: `npm run build:release -- --version <semver>`.
- Produces: `dist/dte-pentaho-mcp-<semver>-win-x64.zip` and `checksums.sha256`.
- `doctor.ps1` exits nonzero for an invalid install/config/handshake and reports optional PDI
  status separately.

- [ ] **Step 1: Write failing packaging/profile tests**

Assert the production tool/resource list excludes learning/promotion, the executable starts and
answers initialize/tools/prompts/resources on a clean environment, scripts contain no machine
paths, checksum matches, and ZIP inventory is exact.

- [ ] **Step 2: Verify packaging tests fail**

Run: `node --test test/packaging.test.js`
Expected: FAIL because release scripts and executable do not exist.

- [ ] **Step 3: Build a bundled entry and Windows SEA executable**

Bundle ESM and immutable text assets into one generated entry module, create a Node SEA blob, copy
the approved Node executable, inject the blob, and verify the resulting executable before zipping.
Fail with a clear prerequisite message if signing/injection tools are unavailable; do not silently
fall back to a release that requires system Node.

- [ ] **Step 4: Implement install, uninstall, and doctor scripts**

Install writes a user-level Kiro stdio entry after backing up the JSON config, preserves unrelated
servers, and never sets `autoApprove: ["*"]`. Uninstall removes only this server entry. Doctor
starts the executable, performs MCP handshake/list calls, validates `.pentaho-mcp.yaml`, and probes
optional PDI.

- [ ] **Step 5: Add versioned release assembly and documentation**

Require semver, generate exact ZIP layout, changelog/version metadata, and SHA-256 checksums. Update
README/install docs with offline installation, project config, Kiro use, upgrades, troubleshooting,
execution safety, and the no-auto-commit policy.

- [ ] **Step 6: Run complete verification**

Run: `node --test`
Expected: all tests pass.

Run: `node scripts/build-release.mjs --version 1.0.0`
Expected: versioned ZIP and checksum are created.

Run: `node --test test/packaging.test.js`
Expected: packaged executable and installer tests pass.

Run: `git status --short`
Expected: only intentional implementation, test, documentation, and release-output paths are
listed; no commits or unrelated modifications exist.


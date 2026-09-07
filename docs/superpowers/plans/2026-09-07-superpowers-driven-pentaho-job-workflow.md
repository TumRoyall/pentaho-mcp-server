# Superpowers-Driven Pentaho Job Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BA-specific production lifecycle surface with a knowledge-first Superpowers workflow that turns an approved idea/spec/plan into workspace-bounded, statically validated `.kjb` and `.ktr` artifacts.

**Architecture:** Superpowers owns brainstorming, design approval, specification, and implementation planning. The MCP exposes 22 Pentaho primitive/runtime tools; the new companion skill orchestrates only read, knowledge, edit, and static-validation primitives, while the legacy lifecycle implementation remains on disk but unregistered. A shared workspace-boundary adapter validates every production read/write path before calling filesystem-oriented core functions.

**Tech Stack:** Node.js ESM, Node test runner, Model Context Protocol SDK, PowerShell packaging scripts, Markdown-based Codex/Superpowers skill.

**Spec:** `docs/superpowers/specs/2026-09-07-superpowers-driven-pentaho-job-workflow-design.md`

## Global Constraints

- Read the approved spec before changing code.
- The prerequisite commits `98a5b99` and `5d32156` already remove `kettle_set_sql` and document the 31-tool intermediate surface; do not reimplement or revert them.
- Final production surface: exactly 22 tools — 4 read, 9 edit, 1 validate, 4 knowledge, 4 runtime.
- Remove all nine `pentaho_*` lifecycle tools from `tools/list` without deleting their implementation modules in this refactor.
- Stop advertising MCP prompts and resources; retain legacy lifecycle source for reference only.
- The new Pentaho development skill must not call runtime tools.
- Runtime implementation and tests remain behaviorally unchanged.
- No testcase generation, Docker/database fixture, data assertion, Kitchen/Pan execution, or deployment work belongs in this plan.
- All production read and write paths must remain inside `KETTLE_ROOT`; when it is unset, enforce `process.cwd()` as the root.
- Do not modify, move, delete, scan, stage, or package anything under `source_old/`.
- Do not add new runtime dependencies.
- Preserve existing XML escaping, CRLF preservation, validation-before-write, catalog policy, and unified diffs.
- Do not mutate Git except for the narrowly scoped commits listed in each task.

---

### Task 1: Implement a canonical workspace boundary

**Files:**
- Create: `src/workspace/boundary.js`
- Create: `test/workspace-boundary.test.js`

**Interfaces:**
- Produces: `createWorkspaceBoundary(rootInput) -> { root, resolveRead(inputPath), resolveWrite(inputPath) }`.
- `root`, `resolveRead`, and `resolveWrite` are consumed by `makeContext` and tool factories in Task 2.

- [ ] **Step 1: Write unit tests for in-root resolution and default-path behavior**

  Create `test/workspace-boundary.test.js` with temporary directories registered for cleanup. Cover relative paths, absolute in-root paths, and a missing destination whose deepest existing ancestor is inside the root:

  ```js
  import { afterEach, test } from 'node:test';
  import assert from 'node:assert/strict';
  import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
  import os from 'node:os';
  import path from 'node:path';
  import { createWorkspaceBoundary } from '../src/workspace/boundary.js';

  const roots = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function workspace() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-boundary-'));
    roots.push(root);
    mkdirSync(path.join(root, 'etl'));
    return root;
  }

  test('resolves relative and absolute paths inside the canonical workspace', () => {
    const root = workspace();
    const boundary = createWorkspaceBoundary(root);
    assert.equal(boundary.root, realpathSync(root));
    assert.equal(boundary.resolveRead(), realpathSync(root));
    assert.equal(boundary.resolveRead('etl'), realpathSync(path.join(root, 'etl')));
    assert.equal(boundary.resolveWrite(path.join(root, 'etl', 'new.ktr')), path.join(realpathSync(root), 'etl', 'new.ktr'));
  });
  ```

- [ ] **Step 2: Write unit tests for traversal and sibling-prefix rejection**

  Add tests which create a sibling directory named `${root}-outside` and assert that all of these throw an error matching `/outside KETTLE_ROOT/i`:

  ```js
  boundary.resolveRead(path.join(root, '..', path.basename(root) + '-outside'));
  boundary.resolveWrite(path.join(root, '..', 'escape.ktr'));
  boundary.resolveRead(path.resolve(root, '..', 'outside.kjb'));
  ```

  Also assert non-string and empty-string inputs throw `/path must be/i`; `undefined` remains the documented request for the workspace root.

- [ ] **Step 3: Write a symlink/junction escape test**

  Add a platform-tolerant test that creates an outside directory and an in-root link named `external`. Use `junction` on Windows and `dir` elsewhere. If link creation fails with `EPERM`, `EACCES`, or `UNKNOWN`, call `t.skip()`; otherwise assert both resolvers reject `external/file.ktr`:

  ```js
  test('rejects a link inside the workspace that resolves outside it', t => {
    // Arrange root, outside directory, and link using symlinkSync.
    // Skip only for the named platform permission errors.
    assert.throws(() => boundary.resolveRead(path.join('external', 'file.ktr')), /outside KETTLE_ROOT/i);
    assert.throws(() => boundary.resolveWrite(path.join('external', 'new.ktr')), /outside KETTLE_ROOT/i);
  });
  ```

  Implement the arrange code explicitly in the test; do not leave the comments above as executable test content.

- [ ] **Step 4: Run the new test and verify it fails because the module is absent**

  Run:

  ```powershell
  node --test test/workspace-boundary.test.js
  ```

  Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/workspace/boundary.js`.

- [ ] **Step 5: Implement `createWorkspaceBoundary`**

  Create `src/workspace/boundary.js` with the following behavior:

  ```js
  import { existsSync, realpathSync, statSync } from 'node:fs';
  import path from 'node:path';

  function canonicalizeExistingPrefix(target) {
    const suffix = [];
    let current = path.resolve(target);
    while (!existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) break;
      suffix.unshift(path.basename(current));
      current = parent;
    }
    const canonical = existsSync(current) ? realpathSync(current) : current;
    return path.resolve(canonical, ...suffix);
  }

  function isInside(root, target) {
    const relative = path.relative(root, target);
    return relative === '' || (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  }

  function checkedInput(value) {
    if (value == null) return '.';
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error('Path must be a non-empty string');
    }
    return value;
  }

  export function createWorkspaceBoundary(rootInput) {
    if (typeof rootInput !== 'string' || rootInput.trim() === '') {
      throw new Error('KETTLE_ROOT must be a non-empty string');
    }
    const requestedRoot = path.resolve(rootInput);
    if (!existsSync(requestedRoot) || !statSync(requestedRoot).isDirectory()) {
      throw new Error(`KETTLE_ROOT must be an existing directory: ${rootInput}`);
    }
    const root = realpathSync(requestedRoot);
    const resolveInside = inputPath => {
      const input = checkedInput(inputPath);
      const requested = path.isAbsolute(input) ? path.resolve(input) : path.resolve(root, input);
      const target = canonicalizeExistingPrefix(requested);
      if (!isInside(root, target)) {
        throw new Error(`Path is outside KETTLE_ROOT (${root}): ${inputPath}`);
      }
      return target;
    };
    return { root, resolveRead: resolveInside, resolveWrite: resolveInside };
  }
  ```

  Keep the two named resolver functions even though their first implementation shares containment logic; tool adapters need the access intent to remain explicit.

- [ ] **Step 6: Run boundary tests**

  Run:

  ```powershell
  node --test test/workspace-boundary.test.js
  ```

  Expected: all tests pass, with only the link test possibly skipped for an explicit platform permission error.

- [ ] **Step 7: Commit the boundary module**

  ```powershell
  git add src/workspace/boundary.js test/workspace-boundary.test.js
  git commit -m "feat: enforce canonical MCP workspace boundary"
  ```

---

### Task 2: Route every primitive file operation through the boundary

**Files:**
- Modify: `src/server.js:21-30`
- Modify: `src/tools/read.tools.js`
- Modify: `src/tools/edit.tools.js`
- Modify: `src/tools/validate.tools.js`
- Modify: `src/tools/knowledge.tools.js:18,81-92`
- Modify: `src/core/edit.js:42-57` and every `assertWritable` call
- Modify: `test/edit.test.js:7-99`
- Create: `test/tool-boundary.test.js`
- Test: `test/smoke.test.js`

**Interfaces:**
- Consumes: `createWorkspaceBoundary(rootInput)` from Task 1.
- Produces: `makeContext(options?) -> { root, resolveRead, resolveWrite }`, where `options.root` may override the environment/default root for tests.
- Produces: all retained read/edit/validate/coverage tool handlers rejecting out-of-root paths before core filesystem access.

- [ ] **Step 1: Write tool-adapter boundary tests**

  Create `test/tool-boundary.test.js`. Build a temporary workspace containing copies of `test/fixtures/mini.ktr` and `mini.kjb`, plus a second outside directory. Construct tools using:

  ```js
  const context = createWorkspaceBoundary(root);
  const tools = new Map(buildTools(context).map(tool => [tool.name, tool]));
  ```

  Add assertions that:

  - `kettle_summary` succeeds for relative `mini.ktr`.
  - `kettle_summary` rejects an absolute outside fixture path.
  - `kettle_list`, `kettle_search`, `kettle_validate`, and `kettle_knowledge_coverage` reject an outside directory/path.
  - `kettle_set_field` rejects an outside file and leaves its bytes unchanged.
  - `kettle_create_file` rejects an outside destination and creates no file.
  - `kettle_clone` rejects an outside source and independently rejects an outside destination.

  Match `/outside KETTLE_ROOT/i` for every rejection and compare bytes before/after for mutation cases.

- [ ] **Step 2: Run the adapter test and verify current absolute paths escape the root**

  Run:

  ```powershell
  node --test test/tool-boundary.test.js
  ```

  Expected: FAIL because current tool factories use the permissive `resolve` function and core edit protection depends directly on `process.env.KETTLE_ROOT`.

- [ ] **Step 3: Make server context use the shared boundary**

  In `src/server.js`, remove `node:path` and import `createWorkspaceBoundary`. Replace `makeContext` with:

  ```js
  export function makeContext({ root = process.env.KETTLE_ROOT ?? process.cwd() } = {}) {
    return createWorkspaceBoundary(root);
  }
  ```

  Do not change tool-call result envelopes in this task.

- [ ] **Step 4: Update read, validate, and coverage tool factories**

  Apply these exact resolver rules:

  ```text
  kettle_list:               resolveRead(directory)
  kettle_summary:            resolveRead(path)
  kettle_get_element:        resolveRead(path)
  kettle_search:             resolveRead(directory)
  kettle_validate file:      resolveRead(path)
  kettle_validate whole tree: root
  kettle_knowledge_coverage: resolveRead(directory)
  ```

  Use `resolveRead()` when the optional directory is absent so it resolves to the canonical root. Update path descriptions from “absolute, or relative to KETTLE_ROOT” to “workspace-relative, or an absolute path contained by KETTLE_ROOT”.

- [ ] **Step 5: Update edit tool adapters with explicit read/write intent**

  Change `editTools` to accept `{ resolveRead, resolveWrite }`. Apply:

  ```text
  create_file path:       resolveWrite
  add_element path:       resolveWrite
  set_field path:         resolveWrite
  set_field_path path:    resolveWrite
  set_fields path:        resolveWrite
  edit_hops path:         resolveWrite
  add_error_hop path:     resolveWrite
  rename_element path:    resolveWrite
  clone sourcePath:       resolveRead
  clone destPath:         resolveWrite
  ```

  Leave input schema names and core function signatures unchanged.

- [ ] **Step 6: Remove environment-dependent protection from the core edit module**

  In `src/core/edit.js`:

  - Delete the exported `assertWritable` function.
  - Delete every `assertWritable(filePath)` and `assertWritable(destPath)` call.
  - Keep XML validation and atomic single-file writes unchanged.

  In `test/edit.test.js`, remove `assertWritable` from the import and remove the three tests that directly manipulate `process.env.KETTLE_ROOT`. Their security contract is replaced by `test/workspace-boundary.test.js` and `test/tool-boundary.test.js` at the production adapter boundary.

- [ ] **Step 7: Run focused boundary and regression tests**

  Run:

  ```powershell
  node --test test/workspace-boundary.test.js test/tool-boundary.test.js test/edit.test.js test/search.test.js test/validate.test.js test/knowledge-coverage.test.js test/smoke.test.js
  ```

  Expected: all tests pass; the smoke test still advertises the intermediate 31-tool surface until Task 3.

- [ ] **Step 8: Commit tool-boundary integration**

  ```powershell
  git add src/server.js src/tools/read.tools.js src/tools/edit.tools.js src/tools/validate.tools.js src/tools/knowledge.tools.js src/core/edit.js test/edit.test.js test/tool-boundary.test.js test/smoke.test.js
  git commit -m "refactor: route MCP file access through workspace policy"
  ```

---

### Task 3: Remove the BA lifecycle from the production MCP surface

**Files:**
- Modify: `src/tools/registry.js:13-16`
- Modify: `src/server.js:13-24,42-55`
- Modify: `test/smoke.test.js`
- Modify: `scripts/verify-production-profile.mjs`
- Modify: `scripts/build-release.mjs:93-105,196-217`
- Modify: `packaging/doctor.ps1:32-89`
- Modify: `test/packaging.test.js:22-51`
- Keep unchanged: `src/tools/lifecycle.tools.js`, `src/lifecycle/**`, `test/lifecycle-*.test.js`, `test/lifecycle-e2e.test.js`

**Interfaces:**
- Consumes: retained primitive tool factories using the Task 2 context.
- Produces: MCP initialize capability `{ tools: {} }`, exactly 22 tools, no registered prompt/resource handlers, and no lifecycle tools in `tools/list`.

- [ ] **Step 1: Change smoke tests to the approved surface**

  In `test/smoke.test.js`:

  - Rename the test to `stdio smoke: initialize, 22 tools, and tool calls`.
  - Send only initialize, `tools/list`, and the existing tool calls; remove prompt/resource requests.
  - Assert exactly 22 tools.
  - Assert every advertised name starts with `kettle_`.
  - Assert no advertised name starts with `pentaho_`.
  - Assert initialize has `capabilities.tools` and does not own `prompts` or `resources` properties.
  - Preserve summary success/error-envelope and observed-element edit assertions.

  Use these concrete assertions:

  ```js
  assert.equal(list.result.tools.length, 22);
  assert.ok(list.result.tools.every(tool => tool.name.startsWith('kettle_')));
  assert.equal(list.result.tools.some(tool => tool.name.startsWith('pentaho_')), false);
  assert.ok(Object.hasOwn(initialized.result.capabilities, 'tools'));
  assert.equal(Object.hasOwn(initialized.result.capabilities, 'prompts'), false);
  assert.equal(Object.hasOwn(initialized.result.capabilities, 'resources'), false);
  ```

- [ ] **Step 2: Run smoke test and verify it fails on the 31-tool lifecycle surface**

  Run:

  ```powershell
  node --test test/smoke.test.js
  ```

  Expected: FAIL because the server still advertises 31 tools plus prompt/resource capabilities.

- [ ] **Step 3: Unregister lifecycle tools**

  In `src/tools/registry.js`, remove the `lifecycleTools` import and remove it from `FACTORIES`. Keep this order:

  ```js
  const FACTORIES = [readTools, editTools, validateTools, knowledgeTools, runtimeTools];
  ```

  Do not delete lifecycle source or direct lifecycle tests.

- [ ] **Step 4: Remove prompt/resource MCP capabilities and handlers**

  In `src/server.js`:

  - Remove prompt/resource request schema imports.
  - Remove lifecycle prompt/resource imports.
  - Set capabilities to `{ tools: {} }`.
  - Delete prompt/resource handler registrations.
  - Leave tool handlers and stdio transport unchanged.

- [ ] **Step 5: Rewrite production-profile verification for the 22-tool surface**

  In `scripts/verify-production-profile.mjs`:

  - Remove lifecycle prompt/resource imports and checks.
  - Set `EXPECTED_TOOL_COUNT = 22`.
  - Assert no tool name begins with `pentaho_`.
  - Retain the forbidden learning/promotion tool-name scan.
  - Print exactly:

  ```text
  production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface
  ```

- [ ] **Step 6: Update release executable verification**

  In `scripts/build-release.mjs`:

  - Stop embedding `src/lifecycle/*.md` assets; keep embedded Pentaho knowledge assets.
  - During executable verification send initialize and `tools/list` only.
  - Require 22 tools and reject any `pentaho_` name.
  - Require initialize capabilities to omit prompts and resources.
  - Remove checks for `develop-pentaho-job` and lifecycle resources.

- [ ] **Step 7: Update doctor and packaging tests**

  In `packaging/doctor.ps1`, send initialize and `tools/list` only, require 22 tools, reject a returned `pentaho_*` tool, and remove prompt/resource result checks.

  In `test/packaging.test.js`, make the packaged executable smoke send initialize and `tools/list` only and assert the same 22-tool/no-prompt/no-resource contract as `test/smoke.test.js`.

- [ ] **Step 8: Run focused surface verification**

  Run:

  ```powershell
  node --test test/smoke.test.js test/lifecycle-surface.test.js test/lifecycle-tools.test.js
  node scripts/verify-production-profile.mjs
  ```

  Expected:

  - Smoke test passes on the new public surface.
  - Direct legacy lifecycle module tests still pass, proving source was retained.
  - Production profile prints the exact 22-tool message.

- [ ] **Step 9: Commit the production-surface change**

  ```powershell
  git add src/tools/registry.js src/server.js test/smoke.test.js scripts/verify-production-profile.mjs scripts/build-release.mjs packaging/doctor.ps1 test/packaging.test.js
  git commit -m "refactor: remove BA lifecycle from MCP surface"
  ```

---

### Task 4: Create the knowledge-first Pentaho development skill

**Required implementation skills:** Invoke `skill-creator` and `superpowers:writing-skills` before creating or validating this skill.

**Files:**
- Create: `skills/developing-pentaho-jobs/SKILL.md`
- Create: `skills/developing-pentaho-jobs/references/pentaho-spec-template.md`
- Create: `test/pentaho-skill.test.js`

**Interfaces:**
- Consumes: Superpowers brainstorming and writing-plans workflows plus the 18 non-runtime primitive tools retained in Task 3.
- Produces: a discoverable `developing-pentaho-jobs` companion skill and a complete Markdown specification template.

- [ ] **Step 1: Write the skill contract test**

  Create `test/pentaho-skill.test.js` to read both new files and assert:

  ```js
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
  ```

  Assert the template contains these exact second-level headings:

  ```text
  ## Objective and boundaries
  ## Artifact inventory
  ## Variables, parameters, and connections
  ## Job definitions
  ## Transformation definitions
  ## Static acceptance criteria
  ```

- [ ] **Step 2: Run the test and verify the skill files are missing**

  Run:

  ```powershell
  node --test test/pentaho-skill.test.js
  ```

  Expected: FAIL with a missing-file error.

- [ ] **Step 3: Create the specification template**

  Write `references/pentaho-spec-template.md` with the six required headings. Include fill-in tables whose columns are concrete contracts:

  ```text
  Artifact inventory: Path | Kind | Internal name | Purpose | Called by
  Variables: Name | Type/format | Required/default | Consumers | Value source
  Connections: Logical name | Technology | Host variable | Port variable | Database variable | User variable | Password variable
  Job entries: ID | Display name | Pentaho type | Purpose | Component reference | Configuration
  Job hops: From | To | Enabled | Condition
  Transformation steps: ID | Display name | Pentaho type | Purpose | Configuration | Input fields | Output fields
  Transformation hops: From | To | Enabled | Error route
  ```

  The template must state that paths are workspace-relative, credential values are external variables, unresolved decisions block implementation, and runtime/data correctness is not part of static acceptance.

- [ ] **Step 4: Create `SKILL.md` with a hard-gated workflow**

  Use this front matter:

  ```yaml
  ---
  name: developing-pentaho-jobs
  description: Turn an idea or approved Pentaho requirement into statically validated KJB/KTR artifacts using Superpowers for design/planning and pentaho-mcp-server for knowledge-first XML implementation.
  ---
  ```

  The instructions must require this sequence:

  1. Read `references/pentaho-spec-template.md` completely.
  2. Invoke `superpowers:brainstorming`; do not mutate artifacts before design approval.
  3. Write and obtain approval for a specification containing every template section.
  4. Invoke `superpowers:writing-plans` after spec approval.
  5. For each distinct entry/step type, call `kettle_knowledge_get` before adding or configuring it.
  6. If a type is missing, observed, or ineligible, stop that artifact task and report the exact limitation instead of inventing XML.
  7. Implement leaf `.ktr` files first and the orchestration `.kjb` last using retained edit tools.
  8. Call `kettle_validate` after each artifact and once on the complete target directory.
  9. Finish with artifact inventory, validation evidence, catalog/manual-review warnings, and deferred runtime verification.

  Include these exact prohibitions so the contract is machine-checkable:

  ```text
  You must not invoke runtime tools in this workflow.
  You must not generate testcases in this workflow.
  You must not access databases in this workflow.
  You must not deploy Pentaho artifacts in this workflow.
  You must not mutate Git unless the user explicitly requests it.
  You must not write literal credentials.
  You must not read from or modify source_old.
  ```

  Also forbid the unregistered lifecycle tools by category without listing their obsolete names as callable instructions.

- [ ] **Step 5: Run the skill contract test and the skill-specific validation prescribed by `skill-creator`**

  Run:

  ```powershell
  node --test test/pentaho-skill.test.js
  ```

  Then run the exact validator/check command provided by the installed `skill-creator` instructions. Record its command and output in the implementation handoff.

  Expected: the Node contract passes and the skill validator reports a valid skill package with no unresolved placeholders.

- [ ] **Step 6: Commit the companion skill**

  ```powershell
  git add skills/developing-pentaho-jobs/SKILL.md skills/developing-pentaho-jobs/references/pentaho-spec-template.md test/pentaho-skill.test.js
  git commit -m "feat: add knowledge-first Pentaho development skill"
  ```

---

### Task 5: Package the companion skill and rewrite current documentation

**Files:**
- Modify: `package.json:16-20`
- Modify: `scripts/build-release.mjs:25-28,220-244`
- Modify: `test/packaging.test.js:30-51`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/tools-reference.md`
- Rewrite: `docs/workflow-guide.md`
- Modify: `docs/development.md`
- Modify: `docs/operations.md`
- Modify: `docs/install.md`
- Modify: `docs/documentation-facts.md`

**Interfaces:**
- Consumes: 22-tool surface, workspace boundary, and companion skill from Tasks 1-4.
- Produces: npm and Windows release artifacts containing the companion skill files plus current docs matching the approved architecture.

- [ ] **Step 1: Add packaging assertions for the skill**

  Update `test/packaging.test.js` so the ZIP inventory includes:

  ```text
  skills/developing-pentaho-jobs/SKILL.md
  skills/developing-pentaho-jobs/references/pentaho-spec-template.md
  ```

  Preserve exact-inventory checking: update the expected list to include directory entries emitted by `tar.exe` as observed from the build, rather than weakening the assertion to “contains”. Also add a package metadata assertion that `package.json.files` contains `skills`.

- [ ] **Step 2: Run the packaging test to verify the release omits the skill**

  Run:

  ```powershell
  node --test test/packaging.test.js
  ```

  Expected: FAIL because the current release staging and package file list do not include `skills/`. If the build is blocked by sandbox filesystem restrictions before inventory validation, retain the failing assertion and continue implementation; final release verification must run in an unrestricted Windows environment.

- [ ] **Step 3: Add the skill to package and release staging**

  In `package.json`, add `"skills"` to `files`.

  In `scripts/build-release.mjs`, import `cpSync` from `node:fs` and recursively copy the repository `skills` directory into `build/release/skills` during `assembleRelease`:

  ```js
  cpSync(path.join(root, 'skills'), path.join(staging, 'skills'), { recursive: true });
  ```

  Keep `source_old`, legacy lifecycle source, tests, and planning documents outside the Windows release inventory.

- [ ] **Step 4: Rewrite the README around the new workflow**

  Make the README state:

  - 22 production tools with counts from the spec.
  - Superpowers is the recommended reasoning workflow, while primitive MCP tools remain directly callable by other clients.
  - Idea → approved spec → approved plan → knowledge-first KJB/KTR editing → static validation.
  - Runtime execution and automated testcase generation are outside this workflow and scheduled for later hardening.
  - `KETTLE_ROOT` defaults to `process.cwd()` and is always enforced.
  - The companion skill path and manual discovery/install instructions for a Superpowers-compatible agent.
  - No current claim that lifecycle prompts/resources or `pentaho_*` tools are exposed.

- [ ] **Step 5: Synchronize architecture, configuration, tool reference, and workflow guide**

  Apply the following exact documentation contracts:

  - `docs/architecture.md`: show Superpowers outside the MCP, remove lifecycle registry edges, document `src/workspace/boundary.js`, and mark legacy lifecycle modules unregistered.
  - `docs/configuration.md`: document enforced root fallback and canonical containment; retain current runtime-only `.pentaho-mcp.yaml` documentation with a warning that runtime refactor is deferred.
  - `docs/tools-reference.md`: contain exactly the 22 tools; remove all nine lifecycle sections and prompt/resource descriptions.
  - `docs/workflow-guide.md`: replace the BA lifecycle playbook with the approved idea-to-static-job workflow and specification contract; do not mention `REQ_*`, workflow state, generation marker, Docker, or runtime execution steps.
  - `docs/development.md`: update registry/profile/release counts and explain legacy lifecycle code is deliberately unregistered.
  - `docs/operations.md` and `docs/install.md`: update doctor/profile/release inventory and companion-skill discovery.
  - `docs/documentation-facts.md`: replace the 31-tool/lifecycle facts with 22-tool/no-prompt/no-resource facts and authoritative source references.

- [ ] **Step 6: Scan current production contracts for stale lifecycle claims**

  Run only across current production/docs paths and explicitly exclude historical plans/specs and `source_old`:

  ```powershell
  rg -n "31 tool|31 tools|Lifecycle \| 9|pentaho_workflow_|pentaho_requirement_write|pentaho_design_write|pentaho_generate|pentaho_finalize|develop-pentaho-job|dte-pentaho://skills|5 resources|1 prompt" README.md docs/*.md src/server.js src/tools/registry.js scripts packaging test/smoke.test.js test/packaging.test.js
  ```

  Expected: no stale public-surface claim. References that explicitly describe unregistered legacy code or historical migration are allowed only when labeled as legacy.

- [ ] **Step 7: Run documentation, profile, skill, smoke, and packaging verification**

  Run:

  ```powershell
  node --test test/pentaho-skill.test.js test/smoke.test.js test/packaging.test.js
  node scripts/verify-production-profile.mjs
  git diff --check
  ```

  Expected: skill and smoke tests pass; profile prints the exact 22-tool message; packaging passes in an unrestricted Windows build environment; diff check emits no output.

- [ ] **Step 8: Commit packaging and documentation**

  ```powershell
  git add package.json scripts/build-release.mjs test/packaging.test.js README.md docs/architecture.md docs/configuration.md docs/tools-reference.md docs/workflow-guide.md docs/development.md docs/operations.md docs/install.md docs/documentation-facts.md
  git commit -m "docs: adopt Superpowers-driven Pentaho workflow"
  ```

---

### Task 6: End-to-end static workflow and final verification

**Files:**
- Create: `test/idea-to-job-workflow.test.js`
- Modify only if the new test reveals a defect: the smallest relevant file from Tasks 1-5

**Interfaces:**
- Consumes: approved 22-tool registry, companion skill contract, canonical workspace boundary, embedded knowledge, primitive editors, and static validator.
- Produces: executable evidence that a knowledge-first primitive sequence creates a statically valid transformation and orchestration job without lifecycle or runtime tools.

- [ ] **Step 1: Write an end-to-end primitive workflow test**

  Create a temporary workspace and build tools with `createWorkspaceBoundary(root)`. Through tool handlers, perform this exact flow:

  1. Call `kettle_knowledge_get` for transformation `RowGenerator`, transformation `Dummy`, job `SPECIAL`, and job `TRANS`.
  2. Create `load_customer.ktr` and `main.kjb` using `kettle_create_file`.
  3. Add `GENERATE_CUSTOMER` (`RowGenerator`) and `PASS_CUSTOMER` (`Dummy`) to the transformation.
  4. Configure `GENERATE_CUSTOMER` with `kettle_set_field` using `field: "limit"` and `value: "2"`.
  5. Add the normal transformation hop.
  6. Add a `TRANS` entry named `LOAD_CUSTOMER` to the job and configure its filename field according to the returned catalog reference.
  7. Add the START → LOAD_CUSTOMER job hop.
  8. Call `kettle_validate` for both files and for the complete workspace.

  Assert all knowledge calls resolve, both files exist inside root, both file reports contain zero structural errors, the tree report contains zero structural errors, and the registry contains no lifecycle tool.

  Do not call `kettle_runtime_*`, access a database, or use any file under `source_old`.

- [ ] **Step 2: Run the end-to-end test**

  Run:

  ```powershell
  node --test test/idea-to-job-workflow.test.js
  ```

  Expected: PASS. If catalog-specific field names differ from the example flow, derive the exact field names from the returned `kettle_knowledge_get` content and encode those verified names in the test; do not invent an XML layout.

- [ ] **Step 3: Run the complete test and profile suite**

  Run:

  ```powershell
  node --test
  node scripts/verify-production-profile.mjs
  git diff --check
  git status --short
  ```

  Expected:

  - All applicable Node tests pass.
  - Only an explicitly platform-permission-dependent symlink test may skip.
  - Profile reports 22 tools and no lifecycle prompt/resource surface.
  - Diff check emits no output.
  - `source_old` state is unchanged from preflight and is not staged.
  - A packaging failure may be reported as environmental only when its output specifically shows the known sandbox/esbuild filesystem restriction; otherwise fix it before completion.

- [ ] **Step 4: Review the implementation against the approved spec**

  Verify each Section 16 completion criterion in `docs/superpowers/specs/2026-09-07-superpowers-driven-pentaho-job-workflow-design.md` and record evidence for each item. Confirm the implementation did not introduce runtime execution, testcase generation, deployment behavior, lifecycle deletion, or any `source_old` mutation.

- [ ] **Step 5: Commit the end-to-end evidence**

  ```powershell
  git add test/idea-to-job-workflow.test.js
  git commit -m "test: verify idea-to-static-Pentaho workflow"
  ```

---

## Final Agent Handoff Requirements

The implementing agent's final response must include:

- Commit IDs and concise purpose for each commit.
- Final list/count of advertised tools.
- Confirmation that prompts/resources and lifecycle tools are not advertised.
- Boundary tests performed, including whether link escape coverage passed or skipped.
- Skill validation command and result.
- Full Node suite and production-profile outputs.
- Windows SEA ZIP/checksum/inventory evidence, or the exact environment-specific blocker without a false passing claim.
- Explicit confirmation that runtime behavior was not redesigned and automated tests were not added to the product workflow.
- Explicit confirmation that `source_old` was not touched or staged.

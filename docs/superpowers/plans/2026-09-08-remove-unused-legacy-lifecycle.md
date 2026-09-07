# Remove Unused Legacy Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the production-unreachable BA lifecycle implementation, its exclusive tests and stale assets, while preserving the current 22-tool MCP and deferred runtime behavior.

**Architecture:** Treat the old lifecycle as one dependency island rather than deleting `src/lifecycle` alone. A test-first absence guard defines the forbidden legacy paths; the implementation then removes the whole island atomically, updates current documentation, and verifies both the source and packaged production surfaces.

**Tech Stack:** Node.js 20+ ESM, Node test runner, MCP SDK, PowerShell packaging scripts, esbuild + Node SEA release pipeline.

**Spec:** `docs/superpowers/specs/2026-09-08-remove-unused-legacy-lifecycle-design.md`

## Global Constraints

- Read the approved spec completely before changing files.
- Do not modify the public 22-tool list or any retained tool schema.
- Do not modify runtime behavior, runtime authorization, `.pentaho-mcp.yaml`, `src/project/**`, or `src/runtime/**`.
- Do not modify workspace-boundary behavior.
- Do not delete current Pentaho catalog/type references, `src/knowledge/pentaho/patterns/hops.md`, or `src/knowledge/pentaho/README.md`.
- Historical documents under `docs/superpowers/specs/**` and `docs/superpowers/plans/**` are records and may retain old lifecycle terminology.
- Do not read, modify, move, delete, stage, scan as an input, or package `source_old/**`.
- Preserve all unrelated user changes and untracked files.
- Use `git rm` only with the exact paths listed in this plan; never target a parent such as `src`, `test`, or the repository root.
- Keep commits focused and do not use `git add -A` or `git add .`.

---

### Task 1: Establish the deletion contract with a failing guard

**Files:**
- Create: `test/legacy-removal.test.js`

**Interfaces:**
- Consumes: repository filesystem rooted one directory above `test/`.
- Produces: a Node test that asserts the complete top-level legacy source island and two stale knowledge files remain absent.

- [ ] **Step 1: Record preflight state without touching user files**

Run:

```powershell
git status --short
git log --oneline --decorate -10
git diff --name-status 5d32156..HEAD
```

Expected:

- The current implementation commits remain at HEAD.
- The existing untracked Superpowers documents may be present.
- `source_old/pentaho_src_java/` remains untracked and must stay unchanged.

- [ ] **Step 2: Confirm production does not register lifecycle tools**

Run:

```powershell
rg -n "lifecycleTools|pentaho_" src/tools/registry.js src/server.js
node scripts/verify-production-profile.mjs
```

Expected:

- `registry.js` and `server.js` contain no lifecycle registration.
- Profile prints `production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface`.

- [ ] **Step 3: Write the failing absence guard**

Create `test/legacy-removal.test.js` with this exact content:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const forbidden = [
  'src/lifecycle',
  'src/generation',
  'src/sync',
  'src/workflow',
  'src/tools/lifecycle.tools.js',
  'src/knowledge/pentaho/ddl-from-design.md',
  'src/knowledge/pentaho/lessons-learned.md',
];

test('unregistered BA lifecycle implementation is absent from distributable source', () => {
  const present = forbidden.filter(relative => existsSync(path.join(root, relative)));
  assert.deepEqual(present, []);
});
```

- [ ] **Step 4: Run the guard and verify RED**

Run:

```powershell
node --test test/legacy-removal.test.js
```

Expected: FAIL. The assertion output must list all seven forbidden paths. If it
fails for syntax, path-root calculation, or another reason, fix the test and
rerun until the failure proves the legacy paths are still present.

---

### Task 2: Remove the complete legacy dependency island

**Files:**
- Delete: `src/lifecycle/**`
- Delete: `src/tools/lifecycle.tools.js`
- Delete: `src/generation/**`
- Delete: `src/sync/**`
- Delete: `src/workflow/**`
- Delete: `src/knowledge/pentaho/ddl-from-design.md`
- Delete: `src/knowledge/pentaho/lessons-learned.md`
- Delete: `test/design-validator.test.js`
- Delete: `test/diagram-renderer.test.js`
- Delete: `test/generation.test.js`
- Delete: `test/lifecycle-e2e.test.js`
- Delete: `test/lifecycle-surface.test.js`
- Delete: `test/lifecycle-tools.test.js`
- Delete: `test/requirement-validator.test.js`
- Delete: `test/sync-changes.test.js`
- Delete: `test/workflow-inspect.test.js`
- Delete: `test/workflow-state.test.js`
- Delete: `test/fixtures/design-package.js`
- Test: `test/legacy-removal.test.js`

**Interfaces:**
- Consumes: the failing forbidden-path contract from Task 1.
- Produces: a source tree containing only production-reachable MCP subsystems plus their tests.

- [ ] **Step 1: Verify every deletion target resolves inside the repository**

Run these read-only commands from the repository root:

```powershell
Resolve-Path -LiteralPath src/lifecycle
Resolve-Path -LiteralPath src/generation
Resolve-Path -LiteralPath src/sync
Resolve-Path -LiteralPath src/workflow
Resolve-Path -LiteralPath src/tools/lifecycle.tools.js
Resolve-Path -LiteralPath test/fixtures/design-package.js
```

Expected: every printed absolute path starts with
`C:\Users\nguye\Documents\GitHub\pentaho-mcp-server\`. Stop if any path
resolves elsewhere.

- [ ] **Step 2: Remove exact legacy production paths**

Run:

```powershell
git rm -r -- src/lifecycle src/generation src/sync src/workflow
git rm -- src/tools/lifecycle.tools.js src/knowledge/pentaho/ddl-from-design.md src/knowledge/pentaho/lessons-learned.md
```

Do not add a replacement, compatibility shim, or empty directory.

- [ ] **Step 3: Remove exact legacy test paths**

Run:

```powershell
git rm -- test/design-validator.test.js test/diagram-renderer.test.js test/generation.test.js test/lifecycle-e2e.test.js test/lifecycle-surface.test.js test/lifecycle-tools.test.js test/requirement-validator.test.js test/sync-changes.test.js test/workflow-inspect.test.js test/workflow-state.test.js test/fixtures/design-package.js
```

- [ ] **Step 4: Run the guard and verify GREEN**

Run:

```powershell
node --test test/legacy-removal.test.js
```

Expected: PASS, 1 test, 0 failures.

- [ ] **Step 5: Scan remaining current source and tests for broken imports**

Run:

```powershell
rg -n "lifecycle/|lifecycleTools|generation/|sync/|workflow/|lifecycle\.tools" src test --glob "*.js"
```

Expected: no matches. Do not scan or modify historical Superpowers documents or
`source_old` for this step.

- [ ] **Step 6: Run the remaining non-packaging suite**

Run:

```powershell
node --test --test-skip-pattern="versioned Windows release"
```

Expected: all remaining applicable tests pass; only a test explicitly skipped
because the platform cannot create a symlink may be skipped.

- [ ] **Step 7: Review the staged deletion set**

Run:

```powershell
git add -- test/legacy-removal.test.js
git diff --cached --name-status
git status --short -- source_old
```

Expected:

- The staged changes are exactly the source/test deletions listed in Task 2
  plus `test/legacy-removal.test.js`.
- `source_old` remains untracked and is not staged.

- [ ] **Step 8: Commit the deletion island**

```powershell
git commit -m "refactor: remove unused BA lifecycle implementation"
```

---

### Task 3: Synchronize current documentation and product metadata

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/development.md`
- Modify: `docs/documentation-facts.md`
- Modify: `docs/workflow-guide.md`
- Modify: `package.json`
- Modify: `src/index.js`
- Modify: `scripts/build-release.mjs`
- Modify: `packaging/install.ps1`
- Modify: `packaging/uninstall.ps1`
- Modify: `packaging/doctor.ps1`

**Interfaces:**
- Consumes: the post-cleanup source tree from Task 2 and the unchanged 22-tool/runtime contract.
- Produces: current documentation that contains no claim that legacy implementation remains on disk and metadata that truthfully describes optional runtime execution.

- [ ] **Step 1: Update README architecture and cleanup wording**

In `README.md`:

- Remove the Mermaid `Legacy` node and its class definition.
- Replace the paragraph saying `src/lifecycle/**` and
  `src/tools/lifecycle.tools.js` remain on disk with a concise statement that
  the BA lifecycle surface and implementation were removed; historical design
  records remain under `docs/superpowers/`.
- Preserve the 22-tool count, no-prompt/no-resource statement, runtime deferral,
  knowledge-first workflow, workspace boundary, and `source_old` exclusion.

- [ ] **Step 2: Update architecture and maintainer documentation**

In `docs/architecture.md`, remove the legacy module row and change retained
legacy wording to removed implementation wording.

In `docs/development.md`, remove lifecycle test groups from the test inventory
and delete instructions describing direct legacy tests as intentionally kept.

In `docs/documentation-facts.md`, remove the fact claiming legacy source remains
on disk. Replace it with a fact that current production source has no BA
lifecycle implementation, supported by `test/legacy-removal.test.js` and
`src/tools/registry.js`. Do not claim `scripts/verify-production-profile.mjs`
checks filesystem absence; it checks only the advertised tool surface.

- [ ] **Step 3: Update workflow and configuration wording**

In `docs/workflow-guide.md`, replace “unregistered lifecycle tools” wording
with “removed BA lifecycle surface”; keep the prohibition against attempting
obsolete requirement/design/generate/finalize calls.

In `docs/configuration.md`, remove the claim that lifecycle implementation is
retained. Preserve the runtime-only explanation for `.pentaho-mcp.yaml`,
`workspaceRoot`, `requirementFolder`, `paths.requirements`, and `paths.pentaho`,
because the four runtime tools still consume that configuration.

- [ ] **Step 4: Correct stale runtime metadata without changing behavior**

Change `package.json.description` to exactly:

```json
"description": "MCP server for knowledge-first Pentaho Kettle job/transformation inspection, editing, static validation, and optional local PDI runtime tools."
```

In `src/index.js`, replace “no PDI install and no execution” with
“optional local PDI runtime tools remain outside the recommended static workflow.”

Do not change dependency versions, scripts, package version, runtime code, or
tool schemas.

- [ ] **Step 5: Remove lifecycle branding from active packaging comments**

Update only synopsis/comments and human-facing descriptions in:

- `scripts/build-release.mjs`
- `packaging/install.ps1`
- `packaging/uninstall.ps1`
- `packaging/doctor.ps1`

Use “Pentaho MCP” or “Pentaho Kettle MCP”, not “Pentaho lifecycle MCP”. Do not
change installation paths, RPC requests, process behavior, or release inventory.

- [ ] **Step 6: Scan current product paths for stale implementation claims**

Run:

```powershell
rg -n -i "legacy.*(remain|retain|keep|on disk)|lifecycle implementation remains|lifecycle MCP|src/lifecycle|lifecycle\.tools|no execution" README.md docs/architecture.md docs/configuration.md docs/development.md docs/documentation-facts.md docs/install.md docs/operations.md docs/tools-reference.md docs/workflow-guide.md package.json src/index.js scripts packaging skills
```

Expected: no stale current claim. A sentence saying the BA lifecycle surface
was removed is allowed, but it must not name deleted source as current code.

- [ ] **Step 7: Run focused documentation/profile tests**

Run:

```powershell
node --test --test-name-pattern="production profile excludes|package metadata ships|SKILL|specification|stdio smoke|unregistered BA lifecycle" test/legacy-removal.test.js test/pentaho-skill.test.js test/smoke.test.js test/packaging.test.js
node scripts/verify-production-profile.mjs
git diff --check
```

Expected: selected tests pass, profile reports 22 tools, and diff check emits no
output. If Node's test-name filter does not select the intended files on the
installed Node version, run the four named test files without the filter.

- [ ] **Step 8: Stage only current documentation and metadata**

```powershell
git add -- README.md docs/architecture.md docs/configuration.md docs/development.md docs/documentation-facts.md docs/workflow-guide.md package.json src/index.js scripts/build-release.mjs packaging/install.ps1 packaging/uninstall.ps1 packaging/doctor.ps1
git diff --cached --check
git status --short -- source_old
```

Expected: no historical Superpowers document and no `source_old` path is staged.

- [ ] **Step 9: Commit documentation synchronization**

```powershell
git commit -m "docs: remove obsolete lifecycle references"
```

---

### Task 4: Verify source, MCP surface, npm contents, and Windows release

**Files:**
- Modify only if verification exposes a cleanup defect: the smallest relevant current source, test, documentation, or packaging file

**Interfaces:**
- Consumes: cleaned source and synchronized documentation from Tasks 1-3.
- Produces: reproducible evidence that cleanup changed no supported behavior and ships no legacy implementation.

- [ ] **Step 1: Verify forbidden paths and imports are absent**

Run:

```powershell
node --test test/legacy-removal.test.js
rg -n "lifecycle/|lifecycleTools|generation/|sync/|workflow/|lifecycle\.tools" src test --glob "*.js"
```

Expected: guard passes and ripgrep returns no matches.

- [ ] **Step 2: Verify the exact advertised surface**

Run:

```powershell
node scripts/verify-production-profile.mjs
node -e "import('./src/server.js').then(async ({makeContext})=>{const {buildTools}=await import('./src/tools/registry.js');const tools=buildTools(makeContext());console.log(tools.length);console.log(tools.map(t=>t.name).join('\n'));})"
```

Expected:

- Count is 22.
- Names are the existing 4 read, 9 edit, 1 validate, 4 knowledge, and 4 runtime tools.
- No name starts with `pentaho_` and `kettle_set_sql` is absent.

- [ ] **Step 3: Run the complete Node suite**

Run:

```powershell
node --test
```

Expected: all applicable tests pass. If only the Windows packaging test fails
with an explicit sandbox/esbuild access-denied error, record that exact output
and execute Step 4 in an unrestricted Windows environment. Any other failure is
a product defect and must be fixed before proceeding.

- [ ] **Step 4: Verify the real Windows release**

Run in an environment that permits esbuild, SEA blob creation, executable
injection, and `tar.exe`:

```powershell
node --test test/packaging.test.js
```

Expected: 3 tests pass, including executable handshake, ZIP exact inventory,
and checksum verification.

- [ ] **Step 5: Inspect npm package contents**

Run:

```powershell
npm pack --dry-run --json
```

Expected:

- Package contains `src/core`, `src/knowledge`, `src/project`, `src/runtime`,
  `src/tools` without `lifecycle.tools.js`, `src/workspace`, docs, README, and
  the companion skill.
- Package contains no `src/lifecycle`, `src/generation`, `src/sync`,
  `src/workflow`, `source_old`, `ddl-from-design.md`, or `lessons-learned.md`.

If `npm` itself is unavailable or broken in the execution environment, record
the exact error; do not replace this with an unverified package-content claim.

- [ ] **Step 6: Verify user-owned paths and final diff**

Run:

```powershell
git status --short
git status --short -- source_old
git diff --check 5d32156..HEAD
git log --oneline --decorate -10
```

Expected:

- `source_old/pentaho_src_java/` has the same untracked status as preflight and
  was never staged.
- Pre-existing untracked Superpowers documents remain untouched unless the
  owner explicitly asks to commit them.
- No whitespace errors.
- The cleanup and documentation commits are visible with focused contents.

- [ ] **Step 7: Review against every completion criterion**

Read `docs/superpowers/specs/2026-09-08-remove-unused-legacy-lifecycle-design.md`
again and report evidence for each completion criterion. Explicitly report:

- deleted source/test groups;
- final tool count and capability surface;
- full-suite/profile/release/npm results;
- unchanged runtime boundary;
- unchanged and unstaged `source_old` state;
- any environment-specific verification limitation without converting it into
  a passing claim.

---

## Final Agent Handoff Requirements

The implementing agent must return:

- Commit IDs and purpose for the cleanup and documentation commits.
- Exact deleted source/test groups.
- Exact final tool count and confirmation of no prompt/resource capability.
- Full Node test, production-profile, Windows packaging, and npm dry-run results.
- Confirmation that runtime code and behavior were not changed.
- Confirmation that historical Superpowers records were preserved.
- Confirmation that `source_old` was neither touched nor staged.

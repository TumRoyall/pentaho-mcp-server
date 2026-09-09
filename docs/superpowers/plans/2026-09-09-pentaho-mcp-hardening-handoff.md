# Pentaho MCP Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing local Pentaho MCP for trustworthy PDI generation, safe optional runtime execution, bounded tool results, correct XML edits, and the missing artifact-level operations.

**Architecture:** Preserve the MCP 2025 stdio server and its `tools -> core/knowledge/runtime -> workspace` layering. Execute disjoint workstreams in isolated worktrees, integrate them through explicit wave gates, then perform the cross-cutting MCP contract and release cleanup only after the tool surface is stable.

**Tech Stack:** Node.js 20+, ESM, `node:test`, `@modelcontextprotocol/sdk` v1, `fast-xml-parser`, PowerShell packaging, esbuild, Node SEA.

**Spec:** `docs/superpowers/specs/2026-09-09-pentaho-mcp-hardening-design.md`

## Global Constraints

- Keep the server on MCP 2025 stdio and `@modelcontextprotocol/sdk` v1; do not add HTTP or MCP 2026 support.
- Keep production knowledge immutable at runtime.
- Keep every caller-selected path inside canonical `KETTLE_ROOT`.
- Keep Kitchen/Pan optional and require both server opt-in and per-call confirmation for execution.
- Treat PDI 9.4 as the only product target in this plan; never invent target-version evidence or copy plaintext credentials into knowledge/connection XML.
- Preserve span-based minimal diffs and the source file's dominant line ending.
- Use test-first development and one reviewable commit per task.
- Run `git diff --check` immediately before every task commit.
- Parallel workers use separate git worktrees created with `superpowers:using-git-worktrees`.
- The coordinator owns merges, production-profile count/name updates, final docs reconciliation, and full-suite verification.

---

## Coordinator Handoff

### Concurrency map

The root coordinator occupies one of four slots. Dispatch no more than three workers at once.

```text
Wave 1a
  Agent A: Task 1 — catalog version truth
  Agent B: Task 2 — runtime safety and bounded logs
  Agent C: Task 3 — bounded search

Wave 1b
  Agent D: Task 4 — direct-child XML and enabled-hop correctness
  Start when any Wave 1a worker finishes and a slot becomes available.

Wave 1 integration
  Coordinator: Task 5

Wave 2
  Agent E: Task 6 — artifact parameters and connection copy
  Agent F: Task 7 — element and error-hop removal
  These use separate new core files; Agent F must consume the direct-child API from Task 4.

Wave 2 integration
  Coordinator: Task 8

Wave 3
  Agent G: Task 9 — MCP contract, annotations, validation, version identity
  Agent H: Task 10 — packaging, dependency and CI hygiene
  Agent H must not edit `src/server.js`, tool definitions, or production-profile logic.

Final integration
  Coordinator: Task 11
```

### Branch naming

Use these exact branches/worktree labels:

```text
codex/harden-knowledge-truth
codex/harden-runtime
codex/bound-search
codex/fix-xml-graph
codex/artifact-parameters-connections
codex/artifact-removal
codex/mcp-contract
codex/release-hygiene
```

### Worker response contract

Every worker returns:

1. Root cause or design summary.
2. Files changed.
3. Focused test commands with pass/fail counts.
4. Commit hash.
5. Known limitations and any integration-sensitive decision.

Workers do not merge, rebase, modify unrelated files, or rewrite another worker's changes.

---

### Task 1: Catalog Target-Version Truth — Agent A

**Files:**
- Modify: `src/knowledge/loader.js`
- Modify: `src/knowledge/pentaho/catalog.yaml`
- Modify: `src/knowledge/pentaho/README.md`
- Modify: `src/tools/knowledge.tools.js`
- Modify: `test/knowledge.test.js`
- Modify: `test/knowledge-coverage.test.js`
- Create: `docs/pdi94-evidence-report.md`

**Interfaces:**
- Consumes: existing `loadCatalog()`, `findByXmlType()`, `isGeneratorEligible()`.
- Produces: `verifiedVersions(entry) -> string[]`; catalog fields `source_version`, `verified_versions`, `verification`; knowledge tool results exposing those fields.

- [ ] **Step 1: Write failing eligibility tests**

Add tests proving a canonical row is not generator-eligible when its `verified_versions` does not include catalog `pdi_version`, and is eligible when it does:

```js
assert.equal(isGeneratorEligible('trans', 'LegacyOnly'), false);
assert.equal(isGeneratorEligible('trans', 'VerifiedTarget'), true);
```

Create the temporary catalog rows with `pdi_version: "9.4"`, `verified_versions: "9.3"` and `verified_versions: "9.3|9.4"` respectively. Update the existing catalog assertion from `11` to `9.4`.

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```powershell
node --test test/knowledge.test.js test/knowledge-coverage.test.js
```

Expected: FAIL because `isGeneratorEligible` does not inspect target-version evidence.

- [ ] **Step 3: Implement version evidence parsing**

Add to `src/knowledge/loader.js`:

```js
export function verifiedVersions(entry) {
  return String(entry?.verified_versions ?? '')
    .split('|')
    .map(v => v.trim())
    .filter(Boolean);
}
```

Extend `isGeneratorEligible` so the catalog target appears in that array:

```js
const target = String(loadCatalog().pdi_version ?? '').trim();
if (target && !verifiedVersions(entry).includes(target)) return false;
```

- [ ] **Step 4: Build the evidence report without inventing evidence**

For every catalog row, inspect its reference provenance. Populate:

```yaml
source_version: "9.4"
verified_versions: "9.4"
verification: source_reviewed
```

when explicit PDI 9.4 source evidence exists. Use `not_established`, an empty scalar, and
`source_reviewed` when the version is unknown. Include `9.4` only when an existing repository
source reference, Spoon-saved artifact, or runtime record explicitly identifies PDI 9.4.

Write `docs/pdi94-evidence-report.md` with counts and one row per entry:

```text
kind | xml_type | source_version | verified_versions | resulting_status | evidence
```

- [ ] **Step 5: Align status and generator eligibility**

First change the catalog-level `pdi_version` from `11` to `9.4`. For target PDI 9.4, set every row
without explicit version 9.4 evidence to:

```yaml
status: observed
generator_eligible: false
```

Do not promote any row during this task. Update the knowledge README to distinguish structural
source evidence from target-runtime verification.

- [ ] **Step 6: Expose evidence through knowledge tools and coverage**

Add `source_version`, parsed `verified_versions`, and `verification` to `kettle_knowledge_list`,
`kettle_knowledge_get`, and coverage type rows. Do not expose absolute provenance paths not already
present in a reference document.

- [ ] **Step 7: Run focused and production-profile tests**

Run:

```powershell
node --test test/knowledge.test.js test/knowledge-coverage.test.js test/knowledge-intake.test.js
npm run verify:profile
```

Expected: PASS; generator eligibility mechanically follows target-version evidence.

- [ ] **Step 8: Commit**

```powershell
git add src/knowledge src/tools/knowledge.tools.js test/knowledge.test.js test/knowledge-coverage.test.js docs/pdi94-evidence-report.md
git commit -m "fix: align catalog eligibility with target PDI evidence"
```

---

### Task 2: Runtime Safety and Bounded Logs — Agent B

**Files:**
- Create: `src/runtime/windows-args.js`
- Create: `src/runtime/tail-buffer.js`
- Modify: `src/runtime/policy.js`
- Modify: `src/runtime/run.js`
- Modify: `src/runtime/detect.js`
- Modify: `src/tools/runtime.tools.js`
- Modify: `src/server.js` only to add `executeEnabled` to context; do not alter MCP result handling
- Modify: `test/runtime.test.js`
- Modify: `test/tool-boundary.test.js`
- Modify: `docs/configuration.md`
- Modify: `docs/operations.md`

**Interfaces:**
- Produces: `assertSafeWindowsToken(value, label)`, `assertParameterName(name)`, `createTailBuffer(maxBytes)`, `executionPolicy({confirmed, executeEnabled})`.
- Preserves: `runPdi(request, context) -> RuntimeResult` status vocabulary.

- [ ] **Step 1: Write failing shell-token and policy tests**

Add cases that reject each unsafe character without starting the fake child:

```js
for (const value of ['x"y', 'x&y', 'x|y', 'x<y', 'x>y', 'x^y', 'x%PATH%', 'x!y', "x\ny"]) {
  await assert.rejects(() => runPdi(requestWith(value), context), /unsafe Windows shell token/i);
}
```

Add policy assertions:

```js
assert.equal(executionPolicy({ confirmed: true, executeEnabled: false }), 'EXECUTE_DISABLED');
assert.equal(executionPolicy({ confirmed: true, executeEnabled: true }), 'ALLOW');
```

- [ ] **Step 2: Run runtime tests and verify red**

Run:

```powershell
node --test test/runtime.test.js test/tool-boundary.test.js
```

Expected: FAIL because runtime has no server opt-in and accepts shell metacharacters.

- [ ] **Step 3: Implement conservative Windows argument validation**

Implement:

```js
const UNSAFE = /[\0\r\n"&|<>^%!]/;
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
```

Validate command, artifact argument, parameter names, and parameter values before `spawn` when
using a Windows batch launcher. Preserve spaces and ordinary path punctuation.

- [ ] **Step 4: Add the server-side execution gate**

Set context from:

```js
executeEnabled: process.env.PENTAHO_ENABLE_EXECUTE === '1'
```

Return `{status:'EXECUTE_DISABLED'}` before PDI detection/spawn unless enabled. Keep
`CONFIRM_REQUIRED` distinct when the server gate is enabled but the call lacks confirmation.

- [ ] **Step 5: Write failing bounded-output tests**

Feed more than 256 KiB in multiple stdout/stderr chunks and assert retained content is at most
256 KiB per stream and contains the tail marker, not the prefix marker.

- [ ] **Step 6: Implement streaming tail buffers**

`createTailBuffer(maxBytes)` exposes `append(chunk)` and `value()`. Bound memory on every append;
do not concatenate unbounded strings inside `execute`.

- [ ] **Step 7: Make timeout termination injectable and process-tree aware**

Add a `terminate(child)` dependency in runtime context for tests. Production Windows behavior runs:

```text
taskkill.exe /PID child.pid /T /F
```

with `shell:false`; non-Windows behavior sends `SIGTERM`, waits a short grace period, then sends
`SIGKILL` if still open. Clear timers on both `error` and `close`.

- [ ] **Step 8: Canonicalize PDI launchers and bound log access**

After existence checks, resolve `Kitchen.bat` and `Pan.bat` with `realpathSync` and re-check they
remain inside the canonical PDI home. Change `kettle_runtime_logs` input to:

```json
{"name":"optional.log","limit":20}
```

with `limit` in `1..100`, newest-first ordering, maximum 256 KiB returned per file, canonical
containment for each file, and retention of the newest 100 log files after a run.

- [ ] **Step 9: Run focused tests**

Run:

```powershell
node --test test/runtime.test.js test/tool-boundary.test.js test/server-context.test.js
```

Expected: PASS with no real Kitchen/Pan process started.

- [ ] **Step 10: Update operator documentation and commit**

Document `PENTAHO_ENABLE_EXECUTE=1`, bounded output, process-tree timeout, and log limits.

```powershell
git add src/runtime src/tools/runtime.tools.js src/server.js test/runtime.test.js test/tool-boundary.test.js test/server-context.test.js docs/configuration.md docs/operations.md
git commit -m "fix: harden optional PDI runtime execution"
```

---

### Task 3: Bounded Search Contract — Agent C

**Files:**
- Modify: `src/core/search.js`
- Modify: `src/tools/read.tools.js`
- Modify: `test/search.test.js`
- Modify: `test/smoke.test.js`
- Modify: `docs/tools-reference.md`

**Interfaces:**
- Changes: `search(root, query, kind, directory, {limit = 100}) -> SearchReport`.
- Produces: `{matches, limit, truncated, scannedFiles, scanIssues}`.

- [ ] **Step 1: Write failing blank-query and cap tests**

Add:

```js
assert.throws(() => search(root, '   ', 'text', root), /non-empty/i);
const report = search(root, 'common', 'text', root, { limit: 2 });
assert.equal(report.matches.length, 2);
assert.equal(report.limit, 2);
assert.equal(report.truncated, true);
```

Also assert read failures appear in `scanIssues`, not `matches`.

- [ ] **Step 2: Run tests and verify red**

Run:

```powershell
node --test test/search.test.js
```

Expected: FAIL because search returns an array and accepts blank queries.

- [ ] **Step 3: Implement validated bounded search**

Trim only for blank detection; retain the caller's original non-blank query semantics. Validate
`kind` against the six existing values and `limit` as an integer in `1..500`. Stop collecting once
one additional match proves truncation. Track files opened in `scannedFiles`.

- [ ] **Step 4: Update the MCP schema and handler**

Add:

```js
query: { type: 'string', minLength: 1 },
limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
```

Pass `{limit: a.limit ?? 100}` to core. Add `additionalProperties:false` only to this tool in this
task; the cross-cutting schema pass belongs to Task 9.

- [ ] **Step 5: Update smoke and documentation**

Smoke-test a search call and assert `result.content` decodes to `data.matches`. Document the
pre-1.0 response-shape change and default cap.

- [ ] **Step 6: Run focused tests and commit**

```powershell
node --test test/search.test.js test/smoke.test.js
git add src/core/search.js src/tools/read.tools.js test/search.test.js test/smoke.test.js docs/tools-reference.md
git commit -m "fix: bound MCP search results"
```

---

### Task 4: Direct-Child XML and Enabled-Hop Correctness — Agent D

**Files:**
- Modify: `src/core/span.js`
- Modify: `src/core/edit.js`
- Modify: `src/core/validate.js`
- Modify: `test/span.test.js`
- Modify: `test/edit.test.js`
- Modify: `test/set-fields.test.js`
- Modify: `test/validate.test.js`
- Modify: `test/step-refs.test.js`

**Interfaces:**
- Produces: `findDirectChildSpan(xml, parentSpan, childTag)` and `isActiveHop(hop)`.
- Preserves: existing public edit function signatures.

- [ ] **Step 1: Write failing direct-child tests**

Use a step containing nested `<fields><field>nested</field></fields>` followed by direct
`<field>direct</field>`. Assert `findDirectChildSpan` returns the latter and `setField` changes only
the direct field. Add the same-name nesting case for every segment of `setFieldPath`.

- [ ] **Step 2: Run direct-child tests and verify red**

```powershell
node --test test/span.test.js test/edit.test.js test/set-fields.test.js
```

Expected: FAIL because `findChildSpan` returns the first descendant.

- [ ] **Step 3: Implement direct-child scanning**

Implement a small tag scanner that walks from `parentSpan` start to end, tracks element depth,
skips comments, declarations, CDATA, and self-closing tags, and returns only a matching child at
depth one. Do not replace `findChildSpan` globally; migrate only APIs whose contract requires a
direct child.

- [ ] **Step 4: Validate XML tag/path arguments**

Before interpolating a tag name in `setField`, `setFieldPath`, or `setFields`, require:

```js
/^[A-Za-z_][A-Za-z0-9_.-]*$/
```

Reject invalid names before reading or writing the file.

- [ ] **Step 5: Write failing disabled-hop tests**

Cover:

1. A transformation with only `A -> B enabled=N` reports B unreachable.
2. A target-reference with only a disabled matching hop produces a warning.
3. Enabled error handling with only a disabled ordinary hop produces a warning.
4. Error handling with a missing source step produces an error.
5. `addErrorHop` changes an existing disabled A→B hop to `Y`.

- [ ] **Step 6: Implement active-hop graph semantics**

Use:

```js
export function isActiveHop(hop) {
  return hop.enabled !== 'N';
}
```

Filter graph edges and route-satisfaction sets through it. Keep endpoint validation for all saved
hops. When adding an error hop, enable a disabled existing ordinary hop in the same `commitEdit`.

- [ ] **Step 7: Run focused tests and commit**

```powershell
node --test test/span.test.js test/edit.test.js test/set-fields.test.js test/validate.test.js test/step-refs.test.js
git add src/core/span.js src/core/edit.js src/core/validate.js test/span.test.js test/edit.test.js test/set-fields.test.js test/validate.test.js test/step-refs.test.js
git commit -m "fix: target direct XML children and active hops"
```

---

### Task 5: Wave 1 Integration Gate — Coordinator

**Files:**
- Review only first; conflict resolution may touch files changed by Tasks 1–4.

**Interfaces:**
- Consumes: commits from Agents A–D.
- Produces: one integrated Wave 1 branch with all focused and full tests passing.

- [ ] **Step 1: Review each worker result before merging**

Check the returned commit diff and focused test output. Reject invented PDI evidence, permissive
shell escaping, unbounded fallback paths, or a direct-child implementation that regexes arbitrary
nested XML without depth tracking.

- [ ] **Step 2: Merge disjoint branches and resolve narrow conflicts**

Expected overlap is limited to `src/server.js`, smoke tests, and docs. Preserve Runtime Task 2's
context field and Search Task 3's search response assertions.

- [ ] **Step 3: Run full Wave 1 verification**

```powershell
npm test
npm run verify:profile
git diff --check
```

Expected: zero failing tests and a clean diff check.

- [ ] **Step 4: Commit integration-only conflict resolutions if needed**

```powershell
git add --all
git commit -m "chore: integrate MCP hardening wave one"
```

Do not create an empty commit when merges required no coordinator edits.

---

### Task 6: Artifact Parameters and Connection Copy — Agent E

**Files:**
- Create: `src/core/artifact-edit.js`
- Create: `src/tools/artifact.tools.js`
- Create: `test/artifact-edit.test.js`
- Modify: `test/tool-boundary.test.js`
- Coordinator-owned in Task 8; do not modify here: `src/tools/registry.js`, `test/smoke.test.js`, `scripts/verify-production-profile.mjs`

**Interfaces:**
- Produces: `setArtifactParameters(filePath, parameters) -> diff`.
- Produces: `copyConnection(sourcePath, destPath, sourceName, {destName, allowEncryptedPassword}) -> diff`.
- Produces factory: `artifactTools({resolveRead, resolveWrite})` with two tools.

- [ ] **Step 1: Write failing parameter edit tests**

Cover job and transformation parameter locations, duplicate/blank names, escaped text, CRLF, and
preservation of unrelated bytes. Parameter input shape:

```js
[{ name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' }]
```

- [ ] **Step 2: Run tests and verify red**

```powershell
node --test test/artifact-edit.test.js
```

Expected: FAIL because `src/core/artifact-edit.js` does not exist.

- [ ] **Step 3: Implement `setArtifactParameters`**

Use the direct-child API from Task 4 and shared edit primitives exported from `edit.js` only where
needed. Render parameters in stable `name`, `default_value`, `description` order. Replace/create the
correct artifact-level `<parameters>` container and commit one atomic minimal edit.

- [ ] **Step 4: Write failing connection-copy tests**

Cover source lookup by direct `<connection><name>`, destination collision, rename, CRLF,
source/destination kind independence, placeholder passwords, encrypted-password opt-in, and refusal
of plaintext password content.

- [ ] **Step 5: Implement `copyConnection`**

Extract the exact source connection span, change only its direct name child when renaming, and
insert it alongside existing top-level connection blocks. Password policy:

```text
empty/self-closing                 -> allowed
${VARIABLE}                        -> allowed
Encrypted ... + explicit opt-in   -> allowed
anything else                      -> rejected
```

- [ ] **Step 6: Add tool factory and boundary tests**

Expose:

```text
kettle_set_parameters
kettle_copy_connection
```

Both source and destination paths must pass the shared boundary. Do not edit the global registry
or exact surface count; the coordinator owns that integration point.

- [ ] **Step 7: Run focused tests and commit**

```powershell
node --test test/artifact-edit.test.js test/tool-boundary.test.js
git add src/core/artifact-edit.js src/tools/artifact.tools.js test/artifact-edit.test.js test/tool-boundary.test.js
git commit -m "feat: edit artifact parameters and copy connections"
```

---

### Task 7: Reference-Safe Removal Operations — Agent F

**Files:**
- Create: `src/core/remove.js`
- Create: `src/tools/remove.tools.js`
- Create: `test/remove.test.js`
- Coordinator-owned in Task 8; do not modify here: `src/tools/registry.js`, `test/smoke.test.js`, `scripts/verify-production-profile.mjs`

**Interfaces:**
- Consumes: `findDirectChildSpan`, `STEP_REFERENCE_TAGS`, active-hop semantics from Task 4.
- Produces: `removeElement(filePath, name, {removeReferences = false}) -> diff`.
- Produces: `editErrorHop(filePath, action, source) -> diff`.
- Produces factory `removeTools({resolveWrite})` with two tools.

- [ ] **Step 1: Write failing safe-removal tests**

Cover a free-standing element, an element referenced by a normal hop, a nested SwitchCase target,
an error-hop source/target, duplicate name defense, CRLF, and refusal to remove the sole START.

- [ ] **Step 2: Run tests and verify red**

```powershell
node --test test/remove.test.js
```

Expected: FAIL because removal functions do not exist.

- [ ] **Step 3: Implement `removeElement` refusal mode**

Collect references before mutation and return one error listing their kinds. With
`removeReferences:false`, do not alter the file when any reference exists.

- [ ] **Step 4: Implement atomic cascade mode**

With `removeReferences:true`, remove normal hops and error blocks in right-to-left offset order.
For each known route-reference element, replace only the matching text content with an empty
string while preserving its existing opening and closing tags. Then remove the element, validate
the final XML, and perform one atomic write.

- [ ] **Step 5: Write failing error-hop edit tests**

Cover `enable`, `disable`, and `remove`; missing source; job rejection; ordinary-hop preservation
when another explicit route uses it; and ordinary-hop removal when it exists solely for the error
route.

- [ ] **Step 6: Implement `editErrorHop` and its tool factory**

Expose:

```text
kettle_remove_element
kettle_edit_error_hop
```

Use enum actions in the schema. Do not edit the global registry or exact surface count.

- [ ] **Step 7: Run focused tests and commit**

```powershell
node --test test/remove.test.js
git add src/core/remove.js src/tools/remove.tools.js test/remove.test.js
git commit -m "feat: add reference-safe artifact removal tools"
```

---

### Task 8: Wave 2 Tool-Surface Integration — Coordinator

**Files:**
- Modify: `src/tools/registry.js`
- Modify: `test/smoke.test.js`
- Modify: `scripts/verify-production-profile.mjs`
- Modify: `README.md`
- Modify: `docs/tools-reference.md`
- Modify: `docs/architecture.md`
- Modify: `docs/documentation-facts.md`
- Modify: `docs/workflow-guide.md`

**Interfaces:**
- Consumes: `artifactTools` and `removeTools` factories.
- Produces: production surface of 26 tools and updated documentation.

- [ ] **Step 1: Merge Tasks 6 and 7 and register factories**

Add both factories to `FACTORIES`. Preserve duplicate-name detection.

- [ ] **Step 2: Replace numeric-only surface verification**

Define one sorted expected-name array containing all 26 names. Verify exact set equality and keep
the forbidden lifecycle/learning checks. Smoke tests assert the same exact set rather than only
the count.

- [ ] **Step 3: Add an end-to-end zero-to-database-shaped workflow test**

Create a transformation, set parameters, copy a placeholder-only connection from an in-root
fixture, add TableInput/TableOutput, configure their connection names, add a hop, and assert zero
structural validation errors. No database or PDI process is used.

- [ ] **Step 4: Update all current documentation facts**

Document 26 tools, the four new contracts, safe connection copying, and removal semantics. Do not
edit historical approved specs/plans.

- [ ] **Step 5: Run Wave 2 verification and commit**

```powershell
npm test
npm run verify:profile
git diff --check
git add src/tools/registry.js test/smoke.test.js scripts/verify-production-profile.mjs README.md docs test/idea-to-job-workflow.test.js
git commit -m "feat: complete artifact-level MCP editing surface"
```

Expected: all tests pass and production profile reports the exact 26-tool set.

---

### Task 9: MCP Contract and Release Identity — Agent G

**Files:**
- Create: `src/version.js`
- Create: `src/tools/schema.js`
- Modify: `src/server.js`
- Modify: every `src/tools/*.tools.js`
- Create: `test/tool-contract.test.js`
- Modify: `test/smoke.test.js`
- Modify: `scripts/build-release.mjs`

**Interfaces:**
- Produces: `validateToolArguments(tool, args)` with deterministic errors.
- Produces: MCP results with `isError:true` on tool failures.
- Produces: tool `title` and annotations.
- Produces: injected server version matching package/release version.

- [ ] **Step 1: Write failing result and annotation tests**

Assert a missing file returns `result.isError === true`; unknown tool does likewise. Assert every
tool has `title`, annotations, an object schema, and explicit `additionalProperties:false` except
the intentional runtime `parameters` map nested inside its closed parent.

- [ ] **Step 2: Run contract tests and verify red**

```powershell
node --test test/tool-contract.test.js test/smoke.test.js
```

Expected: FAIL because failures are plain successful text results and annotations are absent.

- [ ] **Step 3: Implement authoritative argument validation**

Use the SDK-compatible JSON Schema subset already used by the project. Validate object type,
required fields, enums, scalar types, string lengths, numeric bounds, arrays/items, and
`additionalProperties`. Return path-qualified messages such as:

```text
Invalid arguments for kettle_search: $.limit must be an integer between 1 and 500
```

Do not add a new runtime schema dependency unless the handwritten validator would exceed one
focused module of roughly 200 lines; if a dependency is proposed, stop and obtain coordinator
approval before adding it.

- [ ] **Step 4: Add MCP failure semantics and annotations**

Result helper shape:

```js
function textResult(payload, { isError = false } = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
  };
}
```

Mark read/search/validate/knowledge-list/get/coverage/runtime-detect/logs as read-only. Mark edit
tools destructive according to whether they mutate files, and runtime execute as destructive and
open-world. Keep confirmation behavior unchanged.

- [ ] **Step 5: Make server version injectable**

Create `src/version.js` as the only source-code version boundary:

```js
export const SERVER_VERSION =
  typeof __PENTAHO_MCP_VERSION__ === 'string' ? __PENTAHO_MCP_VERSION__ : '0.1.0';
```

Export `createServer({version = SERVER_VERSION} = {})`. In `scripts/build-release.mjs`, pass the
requested release version to esbuild through a `define` for `__PENTAHO_MCP_VERSION__`; Agent G must
not modify `package.json`. Add one source-mode test asserting the fallback equals the current
package version and one build verification asserting an EXE requested as `1.2.3` advertises
`serverInfo.version === '1.2.3'`.

- [ ] **Step 6: Run focused tests and commit**

```powershell
node --test test/tool-contract.test.js test/smoke.test.js test/packaging.test.js
git add src/version.js src/server.js src/tools test/tool-contract.test.js test/smoke.test.js scripts/build-release.mjs
git commit -m "fix: strengthen MCP tool contracts and version identity"
```

---

### Task 10: Packaging, Dependency, and CI Hygiene — Agent H

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Modify: `test/packaging.test.js`
- Modify: `docs/development.md`
- Modify: `docs/operations.md`

**Interfaces:**
- Produces: no runtime APIs.
- Constraint: do not edit `src/server.js`, `src/tools/**`, `scripts/verify-production-profile.mjs`, or `scripts/build-release.mjs`.

- [ ] **Step 1: Write failing package-content assertions**

Update packaging tests to assert npm tarball content excludes `docs/superpowers/` and still
includes current `docs/*.md`, `src/**`, and `skills/developing-pentaho-jobs/**`.

- [ ] **Step 2: Run packaging test and verify red**

```powershell
node --test test/packaging.test.js
```

Expected: FAIL because `package.json.files` currently includes all of `docs`.

- [ ] **Step 3: Remove unused YAML and upgrade esbuild**

Run:

```powershell
npm uninstall yaml
npm install --save-dev esbuild@0.28.2
```

Inspect the lockfile diff; no unrelated dependency should change except transitive dependencies
required by esbuild's platform packages.

- [ ] **Step 4: Narrow npm package files**

Replace broad `docs` inclusion with explicit current documentation files. Keep historical plans in
git but out of the published tarball.

- [ ] **Step 5: Add Windows CI**

Create `.github/workflows/ci.yml` with:

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run verify:profile
      - run: git diff --check
```

Add a separate Windows Node 20 packaging job running the release build with version `0.0.0-ci` and
uploading `dist/**` as a workflow artifact.

- [ ] **Step 6: Ignore local runtime logs and update docs**

Add `.pentaho-mcp/` to `.gitignore`. Document the CI matrix, npm package exclusions, and release
job.

- [ ] **Step 7: Verify and commit**

```powershell
npm test
npm run verify:profile
npm audit --omit=dev
npm pack --dry-run --json
npm run build:release -- --version 0.0.0-ci
git diff --check
git add package.json package-lock.json .gitignore .github test/packaging.test.js docs/development.md docs/operations.md
git commit -m "chore: tighten package and CI verification"
```

Expected: zero audit vulnerabilities, no historical plan/spec files in npm pack, and a valid
Windows ZIP/checksum.

---

### Task 11: Final Integration and Handoff — Coordinator

**Files:**
- Resolve overlaps from Tasks 9–10.
- Modify current docs only when verification reveals stale facts.

**Interfaces:**
- Consumes: reviewed commits from Agents G and H.
- Produces: release-candidate branch and final evidence report.

- [ ] **Step 1: Merge the two disjoint Wave 3 branches**

Merge Task 9, then Task 10 so packaging verification sees the final server/tool surface. Their
declared file sets do not overlap. If git reports a conflict, stop and compare the worker diff
against the declared ownership before resolving it; an overlap means one worker exceeded scope.

- [ ] **Step 2: Audit current documentation mechanically**

Search for stale tool counts, server version, old search array examples, missing execute gate,
incorrect PDI 11 target claims, and unsupported blanket PDI 9.4 verification claims:

```powershell
rg -n "22 tools|22 tool|0\.1\.0|kettle_search|PDI 11|PDI 9\.4|confirmed: true|PENTAHO_ENABLE_EXECUTE" README.md docs src/knowledge/pentaho/README.md
```

Correct only current README/operator/developer/reference docs. Historical specs and plans remain
unchanged records.

- [ ] **Step 3: Run the full final verification suite**

```powershell
npm ci
npm test
npm run verify:profile
npm audit --omit=dev
npm pack --dry-run --json
npm run build:release -- --version 0.1.0-rc.1
git diff --check
git status --short
```

Expected:

- zero failing tests;
- one platform-dependent symlink test may skip only when Windows denies symlink creation;
- exact production tool-name set passes;
- zero production dependency vulnerabilities;
- npm package excludes historical plans/specs;
- Windows release ZIP, executable smoke test, and checksum succeed;
- only intended source/docs/test changes appear in status.

- [ ] **Step 4: Perform behavioral spot checks**

Run permanent regression tests individually for blank search, nested direct field, disabled hop,
error-hop enablement, shell metacharacter rejection, bounded runtime output, PDI evidence gating,
connection copying, and safe removal. Record exact test names and outcomes in the final handoff.

- [ ] **Step 5: Prepare release notes**

Call out:

- pre-1.0 `kettle_search` response-shape change;
- catalog target correction from PDI 11 to PDI 9.4 and any rows downgraded for missing 9.4 evidence;
- new server-side execution environment gate;
- new artifact-level tools and updated exact tool count;
- `isError` behavior and closed schemas;
- no MCP 2026 migration.

- [ ] **Step 6: Commit coordinator-owned reconciliation**

If current documentation or integration wiring changed during this task, run `git diff --check`
and create one integration commit:

```powershell
git add --all
git commit -m "chore: finalize Pentaho MCP hardening"
```

Do not create an empty commit when no coordinator-owned reconciliation was required.

- [ ] **Step 7: Present integration choices to the user**

Do not push or open a PR without explicit permission. Provide the release-candidate commit list,
verification evidence, remaining observed catalog types, and either a proposed PR description or
local merge instructions.

---

## Copy/Paste Agent Prompts

### Agent A

```text
Implement Task 1 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/harden-knowledge-truth. Read the linked design spec first. Correct the catalog target from PDI 11 to PDI 9.4, never invent verification evidence, and conservatively downgrade rows lacking explicit PDI 9.4 evidence. Change only Task 1 files, follow red-green TDD, commit once, and return the worker response contract.
```

### Agent B

```text
Implement Task 2 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/harden-runtime. Read the linked design spec first. Use conservative rejection for Windows shell metacharacters, bound memory while streaming rather than after collection, and keep all real PDI execution mocked in tests. Do not change general MCP result handling. Follow red-green TDD, commit once, and return the worker response contract.
```

### Agent C

```text
Implement Task 3 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/bound-search. Read the linked design spec first. Preserve existing search semantics for non-blank queries, enforce the 1..500 cap in core as well as schema, and document the pre-1.0 response change. Change only Task 3 files, follow red-green TDD, commit once, and return the worker response contract.
```

### Agent D

```text
Implement Task 4 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/fix-xml-graph. Read the linked design spec first. Implement depth-aware direct-child selection, do not globally change descendant semantics, and treat disabled hops as saved-but-inactive. Change only Task 4 files, follow red-green TDD, commit once, and return the worker response contract.
```

### Agent E

```text
After Wave 1 integration, implement Task 6 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/artifact-parameters-connections. Read the linked design spec and consume Task 4's direct-child API. Do not edit the global registry, smoke test, or production-profile script. Never copy plaintext passwords. Follow red-green TDD, commit once, and return the worker response contract.
```

### Agent F

```text
After Wave 1 integration, implement Task 7 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/artifact-removal. Read the linked design spec and consume Task 4's direct-child/active-hop APIs. Default to refusing referenced removals and keep cascade removal atomic. Do not edit the global registry, smoke test, or production-profile script. Follow red-green TDD, commit once, and return the worker response contract.
```

### Agent G

```text
After Wave 2 integration, implement Task 9 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/mcp-contract. Read the linked design spec first. Stay on MCP 2025 SDK v1, add authoritative argument validation and isError semantics, annotate the final tool surface, and make release identity consistent. Do not migrate protocol eras. Follow red-green TDD, commit once, and return the worker response contract.
```

### Agent H

```text
After Wave 2 integration, implement Task 10 from docs/superpowers/plans/2026-09-09-pentaho-mcp-hardening-handoff.md in an isolated worktree on branch codex/release-hygiene. Read the linked design spec first. Do not edit src/server.js, src/tools/**, scripts/verify-production-profile.mjs, or scripts/build-release.mjs. Remove only the unused yaml dependency, upgrade esbuild to 0.28.2, narrow npm contents, add Windows CI, and verify the real SEA build. Follow red-green TDD, commit once, and return the worker response contract.
```

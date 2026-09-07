# Remove Redundant `kettle_set_sql` Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant public `kettle_set_sql` tool and its duplicate core implementation, while preserving SQL editing through `kettle_set_field` and making the complete public contract consistently advertise 31 tools.

**Architecture:** `kettle_set_sql` currently duplicates the existing-field branch of `setField` and adds no SQL-type or SQL-semantic validation. Remove the duplicate API rather than introducing a compatibility alias. Keep `setField(filePath, name, 'sql', sql)` as the single low-level editing path, then synchronize tests, production-profile assertions, release verification, installer diagnostics, and current public documentation.

**Tech Stack:** Node.js ESM, Node test runner, MCP SDK, PowerShell packaging scripts.

**Spec:** This document records the user-approved decision to remove `kettle_set_sql`; no separate design specification exists.

## Global Constraints

- Do not change the behavior or signature of `setField(filePath, name, field, value)`.
- Do not add a deprecated alias for `kettle_set_sql`; the tool must disappear from `tools/list`.
- SQL editing remains available by calling `kettle_set_field` with `field: "sql"`.
- Preserve XML escaping, CRLF behavior, validation-before-write, and unified diff behavior.
- The production surface after this change is exactly 31 tools: 4 read, 9 edit, 1 validate, 4 knowledge, 9 lifecycle, and 4 runtime.
- Keep the 5 lifecycle resources and 1 MCP prompt unchanged.
- Do not edit historical completed plans under `docs/superpowers/plans/` merely to rewrite their recorded historical tool counts.
- Do not modify unrelated audit findings such as filesystem boundaries, generator behavior, runtime execution, versioning, or repository cleanup in this change.

---

### Task 1: Remove the duplicate tool and core function

**Files:**
- Modify: `test/edit.test.js:8-47`
- Modify: `test/smoke.test.js:48`
- Modify: `test/packaging.test.js:49`
- Modify: `src/tools/edit.tools.js:2-58`
- Modify: `src/core/edit.js:235-245`
- Modify: `scripts/verify-production-profile.mjs:20`
- Modify: `scripts/build-release.mjs:212`
- Modify: `packaging/doctor.ps1:67-71`

**Interfaces:**
- Consumes: `setField(filePath, name, field, value) -> string` from `src/core/edit.js`.
- Produces: an MCP registry with no `kettle_set_sql` entry and exactly 31 tools.

- [ ] **Step 1: Replace the direct `setSql` tests with a failing SQL-through-`setField` contract**

  In `test/edit.test.js`, remove `setSql` from the import. Remove the three `setSql` tests and add a focused test proving the retained API updates an existing SQL node without changing its surrounding behavior:

  ```js
  test('setField updates an existing SQL block', () => {
    const file = copyFixture('mini.ktr');
    const diff = setField(file, 'in', 'sql', "SELECT id FROM t WHERE a < 'x' AND b > 1");
    const xml = readFileSync(file, 'utf8');
    assert.match(xml, /SELECT id FROM t WHERE a &lt; 'x' AND b &gt; 1/);
    assert.match(diff, /SELECT id FROM t/);
  });
  ```

  Use the fixture helper and assertion style already present in the file; do not introduce a second fixture setup pattern.

- [ ] **Step 2: Add failing public-surface assertions for the removal**

  Update `test/smoke.test.js` so the expected count is 31 and add:

  ```js
  assert.equal(list.result.tools.some(tool => tool.name === 'kettle_set_sql'), false);
  assert.ok(list.result.tools.some(tool => tool.name === 'kettle_set_field'));
  ```

  Update `test/packaging.test.js` to expect 31 advertised tools from the packaged executable.

- [ ] **Step 3: Run focused tests and verify the new surface assertion fails**

  Run:

  ```powershell
  node --test test/edit.test.js test/smoke.test.js
  ```

  Expected: `test/edit.test.js` passes through `setField`; the smoke test fails because `kettle_set_sql` is still advertised and the registry still contains 32 tools.

- [ ] **Step 4: Remove the public tool and duplicate implementation**

  In `src/tools/edit.tools.js`:

  - Remove `setSql` from the import list.
  - Delete the complete tool object whose name is `kettle_set_sql`.
  - Leave the `kettle_set_field` schema and handler unchanged.

  In `src/core/edit.js`, delete the complete exported `setSql(filePath, name, sql)` function. Do not make `setField` reject creation of a missing `<sql>` field; that would be an unrelated behavioral change.

- [ ] **Step 5: Synchronize executable/profile/doctor tool-count assertions**

  Apply these exact contract changes:

  - `scripts/verify-production-profile.mjs`: set `EXPECTED_TOOL_COUNT = 31`.
  - `scripts/build-release.mjs`: require `tools.length === 31` and report `expected 31`.
  - `packaging/doctor.ps1`: retain its existing `31` check and message; verify both are 31 rather than changing them.
  - `test/smoke.test.js`: update its count comment to `18 low-level + 9 lifecycle + 4 runtime`.

- [ ] **Step 6: Run focused tests and production-profile verification**

  Run:

  ```powershell
  node --test test/edit.test.js test/smoke.test.js
  node scripts/verify-production-profile.mjs
  ```

  Expected: all focused tests pass and the profile prints `production profile OK: 31 tools, 5 resources, 1 prompt(s), no learning/promotion surface`.

- [ ] **Step 7: Run the full test suite**

  Run:

  ```powershell
  node --test
  ```

  Expected: all non-platform-skipped tests pass. If the Windows SEA packaging test fails only because the execution environment blocks esbuild filesystem access, record that exact environmental failure and run the release verification later in an unrestricted Windows environment; do not claim the release artifact passed.

- [ ] **Step 8: Commit the behavior change**

  ```powershell
  git add src/core/edit.js src/tools/edit.tools.js scripts/verify-production-profile.mjs scripts/build-release.mjs packaging/doctor.ps1 test/edit.test.js test/smoke.test.js test/packaging.test.js
  git commit -m "refactor: remove redundant set sql tool"
  ```

---

### Task 2: Update the current public contract and usage guidance

**Files:**
- Modify: `README.md:9-14,64,132`
- Modify: `docs/tools-reference.md:1-70,243`
- Modify: `docs/architecture.md:100`
- Modify: `docs/development.md:19-26,69,78`
- Modify: `docs/install.md:71`
- Modify: `docs/operations.md:21`
- Modify: `docs/documentation-facts.md:5-45,130`

**Interfaces:**
- Consumes: the 31-tool registry delivered by Task 1.
- Produces: current documentation that directs SQL edits through `kettle_set_field` with `field: "sql"` and contains no current claim of 32 tools or 10 edit tools.

- [ ] **Step 1: Update README counts and edit-tool inventory**

  Change the production surface to 31 tools and the Edit group to 9 tools. Remove `kettle_set_sql` from the inventory. Where SQL editing is described, use this concrete example:

  ```json
  {
    "path": "etl/load_customer.ktr",
    "name": "Read customer",
    "field": "sql",
    "value": "SELECT * FROM CUSTOMER"
  }
  ```

- [ ] **Step 2: Remove the standalone tool section from the tool reference**

  Delete the `### kettle_set_sql` section in `docs/tools-reference.md`. Amend the `kettle_set_field` section to explicitly say that SQL is an ordinary child field and show `field: "sql"`. Change the selection table row from:

  ```text
  | Sửa SQL | kettle_set_sql |
  ```

  to:

  ```text
  | Sửa SQL trong element có `<sql>` | `kettle_set_field` với `field: "sql"` |
  ```

- [ ] **Step 3: Synchronize architecture, development, install, operations, and facts**

  Apply these contract updates everywhere in current documentation:

  - `32 tools` → `31 tools`.
  - `Edit 10` → `Edit 9`.
  - Remove `setSql`/`kettle_set_sql` from current inventories.
  - Document SQL editing as `setField(..., 'sql', value)` or the corresponding MCP arguments.
  - In `docs/documentation-facts.md`, resolve the stale row claiming README differs from the implementation; do not leave it saying the mismatch is unfixed.

- [ ] **Step 4: Scan for stale current-contract references**

  Run:

  ```powershell
  rg -n "kettle_set_sql|32 tool|32 tools|Edit \| 10|Nhóm edit \(10\)" README.md docs src test scripts packaging -g "!docs/superpowers/plans/2026-09-0[346]-*"
  ```

  Expected: no current production code, test, packaging, README, or current reference document advertises `kettle_set_sql`, 32 tools, or 10 edit tools. Historical implementation plans may retain their historical statements.

- [ ] **Step 5: Verify registry and all tests**

  Run:

  ```powershell
  node --input-type=module -e "import {buildTools} from './src/tools/registry.js'; const tools=buildTools({root:process.cwd(),resolve:p=>p}); console.log(tools.length); console.log(tools.some(t=>t.name==='kettle_set_sql'));"
  node scripts/verify-production-profile.mjs
  node --test
  ```

  Expected registry output:

  ```text
  31
  false
  ```

  Expected profile output: 31 tools, 5 resources, 1 prompt, no learning/promotion surface. Expected test result: all applicable tests pass, subject only to a clearly recorded environment-specific SEA build limitation.

- [ ] **Step 6: Commit the documentation update**

  ```powershell
  git add README.md docs/tools-reference.md docs/architecture.md docs/development.md docs/install.md docs/operations.md docs/documentation-facts.md
  git commit -m "docs: document 31-tool MCP surface"
  ```

---

## Final Review Checklist

- [ ] `tools/list` contains `kettle_set_field` and does not contain `kettle_set_sql`.
- [ ] Calling `kettle_set_field` with `field: "sql"` updates and XML-escapes an existing SQL block.
- [ ] Production profile, build verification, packaging test, doctor, README, and current docs all agree on 31 tools.
- [ ] No unrelated runtime, generator, path-security, workflow, version, or repository-history change is included.
- [ ] `git diff --check` passes.
- [ ] Full verification evidence is included in the handoff; no passing release-build claim is made unless the Windows SEA artifact was actually built and inspected.

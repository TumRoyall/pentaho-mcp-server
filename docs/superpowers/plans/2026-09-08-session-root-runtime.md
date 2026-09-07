# Session-Root Pentaho Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain the four Pentaho runtime tools while making the MCP process working directory, optionally overridden by `KETTLE_ROOT`, the only project boundary and removing `.pentaho-mcp.yaml`.

**Architecture:** The existing canonical workspace context remains authoritative for every static and runtime artifact path. `PENTAHO_HOME` is injected once into that context, runtime schemas no longer accept project-selection arguments, and sanitized logs are written lazily beneath `<root>/.pentaho-mcp/runtime-logs`.

**Tech Stack:** Node.js 20+, ESM, `node:fs`, `node:path`, `node:test`, MCP SDK, PowerShell packaging scripts.

**Spec:** `docs/superpowers/specs/2026-09-08-session-root-runtime-design.md`

## Global Constraints

- Keep exactly 22 advertised production tools and all four existing `kettle_runtime_*` names.
- Resolve the active root as `process.env.KETTLE_ROOT ?? process.cwd()`.
- Keep `KETTLE_ROOT` optional; do not claim the MCP process necessarily shares the agent's working directory.
- Use `PENTAHO_HOME` as the only PDI location setting.
- Do not support `.pentaho-mcp.yaml`, `PENTAHO_ENV`, documentation-root settings, or jobs-root settings.
- Do not discover, create, or rename `docs`, `etl-pentaho`, or prefixed project folders.
- Resolve runtime artifacts through the same canonical `KETTLE_ROOT` boundary as static tools.
- Always require `confirmed: true` for execute; never infer trust from an environment name.
- Preserve static validation, timeout, output cap, Windows quoting, and redaction behavior.
- Store runtime logs under `<root>/.pentaho-mcp/runtime-logs` and create that directory lazily.
- Do not change read/edit/validate/knowledge tool contracts.
- Do not access, modify, or restore `source_old`.

---

### Task 1: Inject `PENTAHO_HOME` into the shared server context

**Files:**
- Modify: `src/server.js`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Consumes: optional `root` and `pentahoHome` values supplied to `makeContext`.
- Produces: `makeContext({root?, pentahoHome?}) -> {root, resolveRead, resolveWrite, pentahoHome}`.

- [ ] **Step 1: Add a failing server-context test**

Add a focused test to `test/smoke.test.js` or a new `test/server-context.test.js`
if the smoke helper makes direct assertions awkward:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeContext } from '../src/server.js';

test('server context carries an optional PDI home without changing its root', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pentaho-context-'));
  try {
    const ctx = makeContext({ root, pentahoHome: ' C:/Pentaho/data-integration ' });
    assert.equal(ctx.root, path.resolve(root));
    assert.equal(ctx.pentahoHome, 'C:/Pentaho/data-integration');
    assert.equal(makeContext({ root, pentahoHome: '   ' }).pentahoHome, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test test/server-context.test.js
```

Use `test/smoke.test.js` in the command instead if the test was added there.
Expected: FAIL because `makeContext` does not expose `pentahoHome`.

- [ ] **Step 3: Extend `makeContext` without changing boundary behavior**

Update `src/server.js`:

```js
export function makeContext({
  root = process.env.KETTLE_ROOT ?? process.cwd(),
  pentahoHome = process.env.PENTAHO_HOME,
} = {}) {
  return {
    ...createWorkspaceBoundary(root),
    pentahoHome: typeof pentahoHome === 'string' && pentahoHome.trim()
      ? pentahoHome.trim()
      : null,
  };
}
```

Do not add directory discovery or filesystem writes.

- [ ] **Step 4: Run context and workspace-boundary tests**

Run:

```powershell
node --test test/server-context.test.js test/workspace-boundary.test.js
```

Adjust the file list to the actual test location. Expected: PASS, with only an
existing platform-dependent symlink skip if applicable.

- [ ] **Step 5: Commit the shared-context change**

```powershell
git add src/server.js test/server-context.test.js test/smoke.test.js
git commit -m "refactor: expose pdi home through server context"
```

Stage only the test file actually modified.

### Task 2: Make PDI detection and execution policy environment-independent

**Files:**
- Modify: `src/runtime/detect.js`
- Modify: `src/runtime/policy.js`
- Modify: `src/runtime/run.js`
- Modify: `test/runtime.test.js`

**Interfaces:**
- Consumes: `pentahoHome: string | null` from the shared context.
- Produces: `detectPdi(pentahoHome) -> {available, reason?, home?, kitchen, pan}`.
- Produces: `executionPolicy(confirmed?) -> 'ALLOW' | 'CONFIRM_REQUIRED'`.
- `runPdi(request, context)` consumes `context.pentahoHome`; it no longer consumes `context.config`.

- [ ] **Step 1: Rewrite detection and policy tests first**

In `test/runtime.test.js`, replace the old configuration-object and environment
expectations with:

```js
test('detects Kitchen/Pan only beneath PENTAHO_HOME', () => {
  const home = fakePdi();
  const result = detectPdi(home);
  assert.equal(result.available, true);
  assert.equal(result.kitchen, path.join(home, 'Kitchen.bat'));
  assert.equal(result.pan, path.join(home, 'Pan.bat'));
  assert.deepEqual(detectPdi(null), {
    available: false,
    reason: 'PENTAHO_HOME is not configured',
    kitchen: null,
    pan: null,
  });
  assert.throws(() => detectPdi(path.join(home, '..', 'missing')), /not found/i);
});

test('execution policy always requires explicit confirmation', () => {
  assert.equal(executionPolicy(), 'CONFIRM_REQUIRED');
  assert.equal(executionPolicy(false), 'CONFIRM_REQUIRED');
  assert.equal(executionPolicy(true), 'ALLOW');
});
```

Change successful execute test contexts from:

```js
config: { pentahoHome: home, environment: 'DEV' }
```

to:

```js
pentahoHome: home
```

and add `confirmed: true` to their execute requests. Keep the blocked request
unconfirmed and assert no spawn occurred.

- [ ] **Step 2: Run runtime tests and observe old-signature failures**

Run:

```powershell
node --test test/runtime.test.js
```

Expected: FAIL because detection still expects `{pentahoHome}` and policy still
auto-allows `DEV`/`TEST`.

- [ ] **Step 3: Change detection to accept the home path directly**

In `src/runtime/detect.js`, change only the input shape and related messages:

```js
export function detectPdi(pentahoHome) {
  if (!pentahoHome) {
    return {
      available: false,
      reason: 'PENTAHO_HOME is not configured',
      kitchen: null,
      pan: null,
    };
  }
  const requested = path.resolve(pentahoHome);
  // Retain the existing existsSync, realpathSync, Kitchen/Pan containment,
  // and executable-presence checks below this point.
}
```

- [ ] **Step 4: Replace environment policy with confirmation-only policy**

Replace `src/runtime/policy.js` with:

```js
export function executionPolicy(confirmed = false) {
  return confirmed === true ? 'ALLOW' : 'CONFIRM_REQUIRED';
}
```

At the start of `runPdi` in `src/runtime/run.js`, use:

```js
if (request.mode === 'execute' && executionPolicy(request.confirmed) !== 'ALLOW') {
  return { status: 'CONFIRM_REQUIRED' };
}
const detection = context.detection ?? detectPdi(context.pentahoHome);
```

Remove only the dependency on `context.config`; retain the rest of `runPdi`.

- [ ] **Step 5: Run the runtime tests**

Run:

```powershell
node --test test/runtime.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the runtime-policy change**

```powershell
git add src/runtime/detect.js src/runtime/policy.js src/runtime/run.js test/runtime.test.js
git commit -m "refactor: configure pdi runtime from process environment"
```

### Task 3: Simplify and secure the four runtime tool adapters

**Files:**
- Modify: `src/tools/runtime.tools.js`
- Modify: `test/runtime.test.js`
- Modify: `test/tool-boundary.test.js`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Consumes: shared context `{root, resolveRead, resolveWrite, pentahoHome}`.
- Produces: `runtimeTools(ctx)` with no per-call project-selection arguments.
- Produces: runtime log directory `path.join(ctx.root, '.pentaho-mcp', 'runtime-logs')`.

- [ ] **Step 1: Add failing schema contract tests**

Extend `test/runtime.test.js`:

```js
test('runtime tools use the server root without project-selection arguments', () => {
  const root = path.resolve('C:/project');
  const tools = runtimeTools({
    root,
    pentahoHome: 'C:/Pentaho/data-integration',
    resolveRead: value => path.resolve(root, value),
  });
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  assert.deepEqual(byName.get('kettle_runtime_detect').inputSchema, {
    type: 'object', properties: {},
  });
  assert.deepEqual(byName.get('kettle_runtime_logs').inputSchema, {
    type: 'object', properties: {},
  });
  for (const name of ['kettle_runtime_loadcheck', 'kettle_runtime_execute']) {
    const schema = byName.get(name).inputSchema;
    assert.deepEqual(schema.required, ['artifact']);
    assert.equal(Object.hasOwn(schema.properties, 'workspaceRoot'), false);
    assert.equal(Object.hasOwn(schema.properties, 'requirementFolder'), false);
  }
});
```

- [ ] **Step 2: Add failing runtime boundary tests**

In `test/tool-boundary.test.js`, construct `runtimeTools(makeContext({root,
pentahoHome}))`, select loadcheck/execute handlers, and assert these inputs are
rejected before a process can run:

```js
await assert.rejects(
  () => loadcheck.handler({ artifact: '../outside.kjb' }),
  /outside KETTLE_ROOT/i,
);
await assert.rejects(
  () => execute.handler({ artifact: outsideAbsolute, confirmed: true }),
  /outside KETTLE_ROOT/i,
);
await assert.rejects(
  () => loadcheck.handler({ artifact: 'notes.txt' }),
  /must end in \.kjb or \.ktr/i,
);
```

Also cover a symlink/junction inside the root pointing to an outside artifact,
using the platform-permission skip pattern already present in the boundary
suite.

- [ ] **Step 3: Run focused tests and verify old contracts fail**

Run:

```powershell
node --test test/runtime.test.js test/tool-boundary.test.js test/smoke.test.js
```

Expected: FAIL because runtime tools still require `workspaceRoot` and
`requirementFolder` and load `.pentaho-mcp.yaml`.

- [ ] **Step 4: Refactor `runtime.tools.js` to use shared context**

Remove imports from `../project/config.js` and `../project/paths.js`. Make the
factory accept `ctx` and use this focused resolver:

```js
const runProperties = {
  artifact: str('KJB/KTR path relative to KETTLE_ROOT'),
  parameters: { type: 'object', additionalProperties: { type: 'string' } },
  timeoutMs: { type: 'integer', minimum: 1 },
};

function artifactPath(ctx, value) {
  const artifact = ctx.resolveRead(value);
  if (!/\.(kjb|ktr)$/i.test(artifact)) {
    throw new Error('Runtime artifact must end in .kjb or .ktr');
  }
  return artifact;
}

function runContext(ctx) {
  return {
    pentahoHome: ctx.pentahoHome,
    logsDir: path.join(ctx.root, '.pentaho-mcp', 'runtime-logs'),
  };
}
```

Do not manually call `path.resolve` on caller input before `resolveRead`; the
shared boundary must own canonical containment.

- [ ] **Step 5: Replace runtime schemas and handlers**

Use these exact schemas:

```js
// detect
inputSchema: { type: 'object', properties: {} }
handler: () => detectPdi(ctx.pentahoHome)

// loadcheck
inputSchema: { type: 'object', properties: runProperties, required: ['artifact'] }

// execute
inputSchema: {
  type: 'object',
  properties: { ...runProperties, confirmed: { type: 'boolean' } },
  required: ['artifact'],
}

// logs
inputSchema: { type: 'object', properties: {} }
```

Loadcheck and execute must resolve `artifact`, infer `kind` from its validated
extension, and call `runPdi` with the absolute artifact and `runContext(ctx)`.
The log reader must inspect only
`<root>/.pentaho-mcp/runtime-logs`, return `{files:[]}` when absent, filter for
`.log`, sort names, and read UTF-8 content as before.

- [ ] **Step 6: Update smoke requests**

In `test/smoke.test.js`, remove `workspaceRoot` and `requirementFolder` from
runtime calls. Preserve the assertion that the server advertises exactly 22
tools and no prompt/resource capability.

- [ ] **Step 7: Run focused runtime, boundary, and smoke tests**

Run:

```powershell
node --test test/runtime.test.js test/tool-boundary.test.js test/workspace-boundary.test.js test/smoke.test.js
```

Expected: PASS, aside from an existing platform-dependent symlink skip.

- [ ] **Step 8: Commit the runtime adapter change**

```powershell
git add src/tools/runtime.tools.js test/runtime.test.js test/tool-boundary.test.js test/smoke.test.js
git commit -m "refactor: run pentaho within the active mcp root"
```

### Task 4: Remove `.pentaho-mcp.yaml` and legacy project configuration

**Files:**
- Delete: `src/project/config.js`
- Delete: `src/project/paths.js`
- Delete: `test/project-config.test.js`
- Delete: `packaging/config.example.yaml`
- Modify: `test/legacy-removal.test.js`
- Modify: `test/packaging.test.js`
- Modify: `scripts/build-release.mjs`

**Interfaces:**
- Consumes: shared runtime context implemented in Tasks 1–3.
- Produces: source and release artifacts with no YAML project configuration.

- [ ] **Step 1: Add a failing removal guard**

Extend `test/legacy-removal.test.js`, reusing its existing root and file-walk
helpers:

```js
for (const relative of [
  'src/project/config.js',
  'src/project/paths.js',
  'packaging/config.example.yaml',
]) {
  assert.equal(existsSync(path.join(root, relative)), false, `${relative} must be removed`);
}

for (const file of walkFiles(path.join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    text,
    /\.pentaho-mcp\.yaml|loadProjectConfig|resolveProjectPath|assertInsideRoots|requirementFolder|PENTAHO_ENV/,
  );
}
```

- [ ] **Step 2: Run removal and packaging tests to verify they fail first**

Run:

```powershell
node --test test/legacy-removal.test.js test/packaging.test.js
```

Expected: FAIL because the legacy files and packaged YAML example still exist.

- [ ] **Step 3: Confirm production imports are gone, then delete legacy files**

Run:

```powershell
rg -n "loadProjectConfig|resolveProjectPath|assertInsideRoots" src test
```

Expected before deletion: definitions and `test/project-config.test.js` only;
`src/tools/runtime.tools.js` must not import them. Delete `src/project/config.js`,
`src/project/paths.js`, and `test/project-config.test.js`. Remove the empty
`src/project` directory if nothing remains.

- [ ] **Step 4: Remove the packaged YAML example**

Delete `packaging/config.example.yaml`. Remove this line from
`scripts/build-release.mjs`:

```js
copyFileSync(path.join(root, 'packaging', 'config.example.yaml'), path.join(staging, 'config.example.yaml'));
```

Update the exact expected ZIP inventory in `test/packaging.test.js` to remove
`config.example.yaml`. Keep the executable's 22-tool assertion unchanged.

- [ ] **Step 5: Run removal, packaging, and profile checks**

Run:

```powershell
node --test test/legacy-removal.test.js test/packaging.test.js
node scripts/verify-production-profile.mjs
```

Expected: tests PASS and the production profile reports exactly 22 tools. If
the packaging test alone fails because a managed sandbox denies esbuild access,
rerun it in an ordinary Windows shell before classifying the build as broken.

- [ ] **Step 6: Commit legacy configuration removal**

```powershell
git add -A src/project test/project-config.test.js packaging/config.example.yaml scripts/build-release.mjs test/legacy-removal.test.js test/packaging.test.js
git commit -m "refactor: remove pentaho project yaml configuration"
```

### Task 5: Update installation and current documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/tools-reference.md`
- Modify: `docs/development.md`
- Modify: `docs/operations.md`
- Modify: `docs/install.md`
- Modify: `docs/documentation-facts.md`
- Modify: `packaging/install.ps1`
- Modify: `packaging/doctor.ps1`
- Modify: `packaging/uninstall.ps1` only if it refers to removed configuration
- Modify: `test/packaging.test.js`

**Interfaces:**
- Consumes: final environment variables and runtime schemas from Tasks 1–4.
- Produces: accurate source and packaged installation instructions.

- [ ] **Step 1: Add failing documentation and installer guards**

In `test/packaging.test.js`, scan current user-facing files while excluding
historical records under `docs/superpowers/**`:

```js
for (const relative of [
  'README.md', 'docs/architecture.md', 'docs/configuration.md',
  'docs/tools-reference.md', 'docs/operations.md', 'docs/install.md',
  'packaging/install.ps1', 'packaging/doctor.ps1',
]) {
  const text = readFileSync(path.join(root, relative), 'utf8');
  assert.doesNotMatch(
    text,
    /\.pentaho-mcp\.yaml|workspaceRoot|requirementFolder|PENTAHO_ENV|KETTLE_DOCS_DIR|KETTLE_JOBS_DIR/,
  );
}
```

- [ ] **Step 2: Run the guard and observe stale documentation**

Run:

```powershell
node --test test/packaging.test.js
```

Expected: FAIL with current YAML and legacy runtime references.

- [ ] **Step 3: Update installation examples and scripts**

Show the no-root-override form only where the MCP client is documented to
launch in the active project:

```json
{
  "env": {
    "PENTAHO_HOME": "C:/Pentaho/data-integration"
  }
}
```

Also show the portable explicit form:

```json
{
  "env": {
    "KETTLE_ROOT": "C:/path/to/current-project",
    "PENTAHO_HOME": "C:/Pentaho/data-integration"
  }
}
```

Document that `KETTLE_ROOT` is optional but recommended when the client's MCP
process cwd is unknown. Update `install.ps1` so it emits `KETTLE_ROOT` when a
workspace parameter is supplied and emits `PENTAHO_HOME` only when supplied.
It must not create or copy YAML configuration.

- [ ] **Step 4: Update runtime tool reference and operational behavior**

Document these exact contracts:

- `kettle_runtime_detect {}`
- `kettle_runtime_loadcheck {artifact, parameters?, timeoutMs?}`
- `kettle_runtime_execute {artifact, parameters?, timeoutMs?, confirmed?}`
- `kettle_runtime_logs {}`

State that artifact paths are relative to the active root, execute always needs
`confirmed: true`, and logs live under `.pentaho-mcp/runtime-logs`. Recommend
adding `.pentaho-mcp/` to each target project's `.gitignore`; the MCP must not
edit `.gitignore` automatically.

Remove descriptions of project codes, requirement folders, BA input roots,
docs/ETL folder discovery, environment-based execution authorization, and
`.pentaho-mcp.yaml` from current docs. Preserve historical design/plan files as
historical records.

- [ ] **Step 5: Update architecture and development documentation**

Update module maps to remove `src/project`. State that runtime tools consume
the same context and canonical boundary as the other factories. Keep runtime
described as optional and outside the knowledge-first static completion
boundary, but not removed.

- [ ] **Step 6: Run documentation, smoke, and profile checks**

Run:

```powershell
rg -n "\.pentaho-mcp\.yaml|workspaceRoot|requirementFolder|PENTAHO_ENV|KETTLE_DOCS_DIR|KETTLE_JOBS_DIR|DEV/TEST auto" README.md docs packaging src test scripts --glob '!docs/superpowers/**'
node --test test/packaging.test.js test/smoke.test.js
node scripts/verify-production-profile.mjs
```

Expected: no stale production/documentation matches except strings inside
negative guard assertions; tests PASS; profile remains at 22 tools.

- [ ] **Step 7: Commit documentation and installer changes**

```powershell
git add README.md docs packaging test/packaging.test.js
git commit -m "docs: describe session-root pentaho runtime"
```

### Task 6: Complete verification and handoff

**Files:**
- Verify only; modify a task-owned file only when a check identifies a defect in this refactor.

**Interfaces:**
- Consumes: all deliverables from Tasks 1–5.
- Produces: evidence that runtime remains functional and the production surface is unchanged.

- [ ] **Step 1: Confirm forbidden production dependencies are absent**

Run:

```powershell
rg -n "\.pentaho-mcp\.yaml|loadProjectConfig|resolveProjectPath|assertInsideRoots|requirementFolder|PENTAHO_ENV|KETTLE_DOCS_DIR|KETTLE_JOBS_DIR" src packaging scripts README.md docs --glob '!docs/superpowers/**'
```

Expected: no matches.

- [ ] **Step 2: Run focused security and runtime tests**

Run:

```powershell
node --test test/server-context.test.js test/workspace-boundary.test.js test/tool-boundary.test.js test/runtime.test.js test/smoke.test.js test/legacy-removal.test.js
```

Use the actual context test location selected in Task 1. Expected: PASS, aside
from an explicitly reported platform-dependent symlink skip.

- [ ] **Step 3: Run the complete test suite**

Run:

```powershell
node --test
```

Expected: all tests PASS, with only documented platform-dependent skips.

- [ ] **Step 4: Verify the production profile**

Run:

```powershell
node scripts/verify-production-profile.mjs
```

Expected:

```text
production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface
```

- [ ] **Step 5: Review whitespace and task scope**

Run:

```powershell
git diff --check
git status --short
git diff -- src/server.js src/workspace src/runtime src/tools/runtime.tools.js test README.md docs packaging scripts/build-release.mjs
```

Expected: `git diff --check` exits zero. Confirm that no unrelated staged
deletion or pre-existing user change was restored, edited, or included in task
commits.

- [ ] **Step 6: Perform a manual MCP smoke in an isolated temporary root**

Launch the server with `KETTLE_ROOT` pointing to an empty temporary directory
and `PENTAHO_HOME` unset. Send initialize, tools/list,
`kettle_runtime_detect {}`, and `kettle_runtime_logs {}`. Verify:

- Exactly 22 tools are advertised.
- Detect returns `available: false` naming missing `PENTAHO_HOME`.
- Logs returns `{files:[]}`.
- No `docs`, `etl-pentaho`, or `.pentaho-mcp` directory is created merely by
  startup or read-only calls.

Then run a mocked or local confirmed artifact execution and verify only
`.pentaho-mcp/runtime-logs` is created under the active root.

- [ ] **Step 7: Prepare handoff evidence**

Report final runtime schemas, removed files, focused/full/profile command
outputs, Windows release-build status, any platform skip, and confirmation that
the static tools' path contracts and the 22-tool surface did not change.

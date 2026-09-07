# Path-Driven Pentaho Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay lifecycle phụ thuộc `.pentaho-mcp.yaml` và tên `REQ_*` bằng lifecycle nhận trực tiếp `requestPath` cùng `etlRepositoryPath`, đồng thời giữ requirement/design trong repository tài liệu và KJB/KTR trong repository ETL.

**Architecture:** Agent lấy hai đường dẫn root từ prompt và truyền vào mọi high-level lifecycle tool. Một scope module canonicalize hai root, bảo vệ biên ghi, và resolve `manifest.pentaho.project_path` tương đối với ETL root; requirement presentation được tự do còn design YAML vẫn là executable contract có schema chặt.

**Tech Stack:** Node.js 20+, ES modules, `node:test`, `yaml`, MCP SDK, filesystem APIs.

**Spec:** `docs/superpowers/specs/2026-09-06-path-driven-pentaho-lifecycle-design.md`

## Global Constraints

- Không yêu cầu hoặc tự đọc `.pentaho-mcp.yaml` để xác định lifecycle scope.
- Không yêu cầu tên request folder theo mẫu `REQ_*`.
- `requestPath/input/` chỉ đọc; `requirement.md` và `design/` nằm dưới chính `requestPath`.
- `etlRepositoryPath` là root toàn repository ETL; `manifest.pentaho.project_path` phải là đường dẫn tương đối nằm bên trong root này.
- Không tự chọn target project, không tự sinh tên target và không ghi runtime trực tiếp vào ETL root khi target chưa được xác định.
- Không lưu absolute machine path trong requirement hoặc design.
- Mọi write tiếp tục dùng compare-and-swap hash, canonical containment và workflow lock.
- Không commit/push/deploy repository của người dùng từ runtime MCP.
- Giữ tương thích với requirement metadata `artifact_type: etl-requirement` trong thời gian migration; phát warning thay vì từ chối.

## File Structure

### Files to create

- `src/project/settings.js`: đọc `PENTAHO_HOME`, `PENTAHO_ENV`, `PENTAHO_ALLOWED_ROOTS` từ process environment.
- `src/project/scope.js`: canonicalize hai root, kiểm tra allowed roots, bảo vệ vùng `input/`, resolve ETL project path.
- `src/lifecycle/context-inventory.js`: inventory mọi source file và phân loại khả năng đọc text mà không bỏ qua binary.
- `src/lifecycle/design-schema.js`: validation tập trung cho manifest và component declaration/path.
- `test/project-scope.test.js`: unit test settings và path boundaries.

### Files to modify

- `src/server.js`: đưa server settings vào shared tool context; giữ `KETTLE_ROOT` chỉ cho low-level tools.
- `src/project/paths.js`: giữ helper containment dùng chung hoặc chuyển implementation sang `scope.js` rồi re-export trong migration.
- `src/lifecycle/requirement-validator.js`: bỏ folder regex và required English headings; validate semantic front matter.
- `src/lifecycle/design-loader.js`: dùng safe relative component spec validation.
- `src/lifecycle/design-validator.js`: gọi schema validator và chặn mọi output path không an toàn.
- `src/lifecycle/diagram-renderer.js`: diagram region trở thành optional presentation feature.
- `src/workflow/inspect.js`: nhận scope trực tiếp, inventory mọi file input, resolve runtime từ ETL root.
- `src/tools/lifecycle.tools.js`: thay schema/handler từ `workspaceRoot + requirementFolder` sang hai root mới.
- `src/generation/generate.js`: nhận scope và resolve target từ ETL root.
- `src/lifecycle/finalize.js`: nhận scope/settings thay config.
- `src/tools/runtime.tools.js`: dùng server settings và explicit paths; log output không có default ngầm.
- `src/lifecycle/prompts.js`: prompt nhận hai root và không nhắc `REQ_*` hoặc `.pentaho-mcp.yaml`.
- `src/lifecycle/*.md`: cập nhật packaged guidance theo path-driven contract.
- `test/requirement-validator.test.js`, `test/design-validator.test.js`, `test/workflow-inspect.test.js`, `test/lifecycle-tools.test.js`, `test/generation.test.js`, `test/lifecycle-e2e.test.js`, `test/runtime.test.js`, `test/lifecycle-surface.test.js`: chuyển fixture và assertion sang contract mới.
- `README.md`, `docs/architecture.md`, `docs/configuration.md`, `docs/install.md`, `docs/operations.md`, `docs/tools-reference.md`, `docs/workflow-guide.md`, `docs/documentation-facts.md`: cập nhật public contract.
- `packaging/install.ps1`, `packaging/doctor.ps1`: cấu hình kỹ thuật bằng env; bỏ validate workspace YAML.

### Files to delete after all call sites are migrated

- `src/project/config.js`: project-file configuration không còn là runtime dependency.
- `test/project-config.test.js`: được thay bởi `test/project-scope.test.js`.
- `packaging/config.example.yaml`: không còn file config để người dùng copy.

---

### Task 1: Introduce server settings and two-root lifecycle scope

**Files:**
- Create: `src/project/settings.js`
- Create: `src/project/scope.js`
- Create: `test/project-scope.test.js`
- Modify: `src/server.js:26-38`
- Modify: `src/project/paths.js`

**Interfaces:**
- Produces: `loadServerSettings(env, cwd) -> { pentahoHome, environment, allowedRoots }`
- Produces: `resolveLifecycleScope({ requestPath, etlRepositoryPath }, settings) -> { requestPath, etlRepositoryPath, inputPath, requirementPath, designPath }`
- Produces: `resolveEtlProjectPath(scope, projectPath) -> absolutePath`
- Produces: `assertRequestWrite(scope, targetPath) -> absolutePath`
- Produces: `assertEtlWrite(scope, targetPath) -> absolutePath`
- Consumes: Node `path`, `fs.existsSync`, `fs.realpathSync`

- [ ] **Step 1: Write failing tests for environment settings and arbitrary request names**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadServerSettings } from '../src/project/settings.js';
import {
  assertEtlWrite,
  assertRequestWrite,
  resolveEtlProjectPath,
  resolveLifecycleScope,
} from '../src/project/scope.js';

test('settings come from MCP environment without a workspace config file', () => {
  const settings = loadServerSettings({
    PENTAHO_HOME: 'C:/pdi',
    PENTAHO_ENV: 'test',
    PENTAHO_ALLOWED_ROOTS: `C:/docs${path.delimiter}D:/etl`,
  }, 'C:/cwd');
  assert.equal(settings.pentahoHome, path.resolve('C:/pdi'));
  assert.equal(settings.environment, 'TEST');
  assert.deepEqual(settings.allowedRoots, [path.resolve('C:/docs'), path.resolve('D:/etl')]);
});

test('scope accepts arbitrary request folder names and protects both roots', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'path-scope-'));
  const requestPath = path.join(root, 'docs-any-name', 'Xuất user active 2026');
  const etlRepositoryPath = path.join(root, 'runtime-repository');
  mkdirSync(path.join(requestPath, 'input'), { recursive: true });
  mkdirSync(etlRepositoryPath, { recursive: true });
  const scope = resolveLifecycleScope({ requestPath, etlRepositoryPath }, { allowedRoots: [] });
  assert.equal(scope.requirementPath, path.join(requestPath, 'requirement.md'));
  assert.equal(scope.designPath, path.join(requestPath, 'design'));
  assert.equal(resolveEtlProjectPath(scope, 'xuat_user_active'), path.join(etlRepositoryPath, 'xuat_user_active'));
  assert.throws(() => resolveEtlProjectPath(scope, '../outside'), /TARGET_PATH_ESCAPE/);
  assert.throws(() => assertRequestWrite(scope, path.join(requestPath, 'input', 'source.md')), /read-only/i);
  assert.equal(assertEtlWrite(scope, path.join(etlRepositoryPath, 'xuat_user_active', 'job.kjb')), path.join(etlRepositoryPath, 'xuat_user_active', 'job.kjb'));
});
```

- [ ] **Step 2: Run the new test and verify imports fail**

Run: `node --test test/project-scope.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/project/settings.js` or `src/project/scope.js`.

- [ ] **Step 3: Implement environment settings**

```js
// src/project/settings.js
import path from 'node:path';

export function loadServerSettings(env = process.env, cwd = process.cwd()) {
  const resolve = value => value ? path.resolve(cwd, value) : null;
  return {
    pentahoHome: resolve(env.PENTAHO_HOME),
    environment: String(env.PENTAHO_ENV ?? 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN',
    allowedRoots: String(env.PENTAHO_ALLOWED_ROOTS ?? '')
      .split(path.delimiter)
      .map(value => value.trim())
      .filter(Boolean)
      .map(resolve),
  };
}
```

- [ ] **Step 4: Implement canonical scope and containment**

```js
// src/project/scope.js
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;
const inside = (root, target) => {
  const rel = path.relative(comparable(root), comparable(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

function existingDirectory(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${code}: absolute directory path is required`);
  const resolved = path.resolve(value);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) throw new Error(`${code}: directory does not exist: ${resolved}`);
  return realpathSync(resolved);
}

export function resolveLifecycleScope(args, settings = {}) {
  const requestPath = existingDirectory(args.requestPath, 'REQUEST_PATH_INVALID');
  const etlRepositoryPath = existingDirectory(args.etlRepositoryPath, 'ETL_REPOSITORY_PATH_INVALID');
  if ((settings.allowedRoots ?? []).length && ![requestPath, etlRepositoryPath].every(target =>
    settings.allowedRoots.some(root => inside(realpathSync(root), target)))) {
    throw new Error('PATH_OUTSIDE_ALLOWED_ROOTS');
  }
  return {
    requestPath,
    etlRepositoryPath,
    inputPath: path.join(requestPath, 'input'),
    requirementPath: path.join(requestPath, 'requirement.md'),
    designPath: path.join(requestPath, 'design'),
  };
}

export function resolveEtlProjectPath(scope, projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim() || path.isAbsolute(projectPath)) throw new Error('TARGET_PROJECT_UNRESOLVED');
  const target = path.resolve(scope.etlRepositoryPath, projectPath);
  if (!inside(scope.etlRepositoryPath, target) || target === scope.etlRepositoryPath) throw new Error('TARGET_PATH_ESCAPE');
  return assertEtlWrite(scope, target);
}
```

Add the write guards with existing-prefix canonicalization so non-existing destinations are checked through their nearest real ancestor:

```js
function canonicalizeExistingPrefix(target) {
  const suffix = [];
  let current = path.resolve(target);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    suffix.unshift(path.basename(current));
    current = parent;
  }
  const real = existsSync(current) ? realpathSync(current) : current;
  return path.resolve(real, ...suffix);
}

function assertWithin(root, target, code) {
  const canonicalRoot = canonicalizeExistingPrefix(root);
  const canonicalTarget = canonicalizeExistingPrefix(target);
  if (!inside(canonicalRoot, canonicalTarget)) throw new Error(code);
  return canonicalTarget;
}

export function assertRequestWrite(scope, targetPath) {
  const target = assertWithin(scope.requestPath, targetPath, 'PATH_OUTSIDE_REQUEST');
  if (inside(canonicalizeExistingPrefix(scope.inputPath), target)) throw new Error('BA input is read-only');
  return target;
}

export function assertEtlWrite(scope, targetPath) {
  return assertWithin(scope.etlRepositoryPath, targetPath, 'TARGET_PATH_ESCAPE');
}
```

- [ ] **Step 5: Put settings into server context without changing low-level Kettle root behavior**

```js
import { loadServerSettings } from './project/settings.js';

export function makeContext(env = process.env, cwd = process.cwd()) {
  const root = env.KETTLE_ROOT ?? cwd;
  const resolve = p => p == null ? undefined : path.isAbsolute(p) ? p : path.join(root, p);
  return { root, resolve, settings: loadServerSettings(env, cwd) };
}
```

- [ ] **Step 6: Run scope and smoke tests**

Run: `node --test test/project-scope.test.js test/smoke.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the scope layer**

```bash
git add src/project/settings.js src/project/scope.js src/project/paths.js src/server.js test/project-scope.test.js
git commit -m "refactor: add path-driven lifecycle scope"
```

---

### Task 2: Make requirement validation presentation-independent

**Files:**
- Modify: `src/lifecycle/requirement-validator.js`
- Modify: `test/requirement-validator.test.js`

**Interfaces:**
- Consumes: `validateRequirement(requestPath)` where `requestPath` has no naming convention.
- Produces: `{ ok, status, metadata, errors, warnings }` with error codes `FILE_MISSING`, `FRONTMATTER_INVALID`, `METADATA_INVALID`, `PLACEHOLDER_LEFT`, `EVIDENCE_UNDEFINED`, `BLOCKING_QUESTION`, `SECRET_VALUE`.

- [ ] **Step 1: Replace the naming/English-heading tests with semantic tests**

```js
test('arbitrary folder and Vietnamese presentation are READY', () => {
  const req = makeRequirement({ folder: 'Xuất user active 2026', content: `---
schema_version: 1
artifact_type: pentaho-requirement
revision: 1
status: READY_FOR_DESIGN
blocking_questions: []
evidence:
  - { id: SRC-001, source: input/phieu.md }
---
# Yêu cầu xuất người dùng

## Mục tiêu
Xuất người dùng đang hoạt động theo SRC-001.

## Điều kiện nghiệm thu
AC-001 tham chiếu SRC-001.
` });
  const report = validateRequirement(req);
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.equal(report.status, 'READY');
});

test('folder name and heading language do not participate in validation', () => {
  const report = validateRequirement(makeRequirement({ folder: 'abc-def' }));
  assert.equal(report.errors.some(error => error.code === 'FOLDER_INVALID'), false);
  assert.equal(report.errors.some(error => error.code === 'SECTION_MISSING'), false);
});

test('READY document cannot contain blocking metadata questions', () => {
  const report = validateRequirement(makeRequirement({ blockingQuestions: [{ id: 'Q-001', question: 'Chọn business key' }] }));
  assert.ok(report.errors.some(error => error.code === 'BLOCKING_QUESTION'));
});

test('legacy metadata remains readable with a migration warning', () => {
  const report = validateRequirement(makeLegacyRequirement());
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.ok(report.warnings.some(warning => warning.code === 'LEGACY_REQUIREMENT_METADATA'));
});
```

- [ ] **Step 2: Run the requirement tests and verify current hard-coded checks fail them**

Run: `node --test test/requirement-validator.test.js`

Expected: FAIL with `FOLDER_INVALID`, missing English sections, or unsupported new metadata.

- [ ] **Step 3: Replace folder/heading validation with versioned metadata validation**

Use a normalizer with the exact return shape below:

```js
function normalizeMetadata(metadata, warnings) {
  if (metadata.artifact_type === 'etl-requirement') {
    warnings.push(finding('LEGACY_REQUIREMENT_METADATA', 'Migrate artifact_type and blocking_questions'));
    return {
      ...metadata,
      __legacy: true,
      schema_version: metadata.schema_version ?? 1,
      artifact_type: 'pentaho-requirement',
      blocking_questions: metadata.open_questions > 0 ? [{ id: 'LEGACY', question: 'See Open Questions section' }] : [],
      evidence: metadata.evidence ?? [],
    };
  }
  return metadata;
}
```

Validate `schema_version === 1`, `artifact_type === 'pentaho-requirement'`, integer `revision >= 1`, `status` in `DRAFT | READY_FOR_DESIGN`, array `blocking_questions`, and array `evidence` with unique `SRC-NNN` IDs. Remove `folderPattern`, the `sections` array and `requirement_id === basename(requestPath)`.

- [ ] **Step 4: Scan placeholders, references and secrets without locating named sections**

```js
const legacyEvidence = metadata.__legacy && metadata.evidence.length === 0
  ? new Set(body.match(/SRC-\d{2,}/g) ?? [])
  : new Set();
const evidenceDefined = new Set([...metadata.evidence.map(row => row.id), ...legacyEvidence]);
for (const id of new Set(body.match(/SRC-\d{2,}/g) ?? [])) {
  if (!evidenceDefined.has(id)) errors.push(finding('EVIDENCE_UNDEFINED', id));
}
for (const token of body.match(/\{\{[^{}]*\}\}|<[A-Z][A-Z0-9_]{2,}>/g) ?? []) {
  errors.push(finding('PLACEHOLDER_LEFT', token));
}
if (metadata.status === 'READY_FOR_DESIGN' && metadata.blocking_questions.length) {
  errors.push(finding('BLOCKING_QUESTION', metadata.blocking_questions.map(row => row.id).join(', ')));
}
```

Reuse the design secret policy for YAML front matter and add conservative Markdown checks for obvious password/token assignments; do not flag `${VARIABLE}`.

- [ ] **Step 5: Run requirement tests**

Run: `node --test test/requirement-validator.test.js`

Expected: PASS.

- [ ] **Step 6: Commit requirement validation**

```bash
git add src/lifecycle/requirement-validator.js test/requirement-validator.test.js
git commit -m "refactor: validate requirement semantics instead of layout"
```

---

### Task 3: Harden executable design schema and make diagrams optional

**Files:**
- Create: `src/lifecycle/design-schema.js`
- Modify: `src/lifecycle/design-loader.js`
- Modify: `src/lifecycle/design-validator.js`
- Modify: `src/lifecycle/diagram-renderer.js`
- Modify: `test/design-validator.test.js`
- Modify: `test/diagram-renderer.test.js`

**Interfaces:**
- Produces: `validateDesignSchema(pkg) -> { errors, warnings }`
- Produces: `safeRelativePath(value, { field, extensions, allowNested }) -> normalizedRelativePath`
- Produces: `hasGeneratedDiagramRegion(markdown) -> boolean`
- Changes: `writeDesignDiagrams(designDir)` returns `{ changed, skipped, diff }`; missing markers produce `skipped: true`, not an exception.

- [ ] **Step 1: Add failing schema/path tests**

```js
test('design rejects missing manifest metadata and unresolved ETL target', () => {
  const design = makeDesign();
  writeFileSync(path.join(design, 'manifest.yaml'), 'components: {}\n');
  const report = validateDesign(design);
  assert.ok(report.errors.some(error => error.code === 'SCHEMA_VERSION_INVALID'));
  assert.ok(report.errors.some(error => error.code === 'TARGET_PROJECT_UNRESOLVED'));
});

test('design rejects component and artifact path escape', () => {
  assertDesignError({ spec: '../outside.yaml' }, 'COMPONENT_SPEC_INVALID');
  assertDesignError({ artifact_name: '../outside.kjb' }, 'ARTIFACT_PATH_INVALID');
  assertDesignError({ artifact_name: 'job.txt' }, 'ARTIFACT_EXTENSION_INVALID');
});

test('design without diagram markers remains valid', () => {
  const design = makeDesign();
  writeFileSync(path.join(design, 'design.md'), '# Thiết kế\nKhông yêu cầu diagram.\n');
  assert.equal(validateDesign(design).ok, true);
  assert.deepEqual(writeDesignDiagrams(design), { changed: false, skipped: true, diff: '' });
});
```

- [ ] **Step 2: Run focused tests and verify failures**

Run: `node --test test/design-validator.test.js test/diagram-renderer.test.js`

Expected: FAIL because metadata/artifact paths are not validated and missing markers currently throw.

- [ ] **Step 3: Implement design schema validation**

Validate these exact invariants in `validateDesignSchema`:

```js
const REQUIRED_ARTIFACT_TYPES = {
  manifest: 'pentaho-design-package',
  job: 'pentaho-job-design',
  transformation: 'pentaho-transformation-design',
};

// Manifest
manifest.schema_version === 1;
manifest.artifact_type === REQUIRED_ARTIFACT_TYPES.manifest;
typeof manifest.design.id === 'string';
Number.isInteger(manifest.design.version) && manifest.design.version >= 1;
manifest.design.status === 'READY';
typeof manifest.pentaho.project_path === 'string';
typeof manifest.pentaho.entrypoint_job === 'string';

// Component
doc.schema_version === 1;
doc.artifact_type === expectedType;
doc.design_id === manifest.design.id;
doc.design_version === manifest.design.version;
```

For every job declaration require a safe `.yaml` spec and `.kjb` artifact. For every transformation require `.yaml` and `.ktr`. Reject absolute paths, empty paths, `.`/`..` segments and normalized paths outside their logical root. Require entrypoint ID to identify one declared job.

- [ ] **Step 4: Make diagram rendering opt-in through existing markers**

```js
export function hasGeneratedDiagramRegion(content) {
  const start = content.indexOf(begin);
  const finish = content.indexOf(end);
  return start >= 0 && finish >= start;
}

export function writeDesignDiagrams(designDir) {
  const file = path.join(designDir, 'design.md');
  const before = readFileSync(file, 'utf8');
  if (!hasGeneratedDiagramRegion(before)) return { changed: false, skipped: true, diff: '' };
  const start = before.indexOf(begin);
  const finish = before.indexOf(end);
  const section = renderDesignDiagrams(loadDesignPackage(designDir));
  const after = `${before.slice(0, start + begin.length)}\n${section}\n${before.slice(finish)}`;
  if (after === before) return { changed: false, skipped: false, diff: '' };
  const temp = `${file}.tmp`;
  writeFileSync(temp, after, 'utf8');
  renameSync(temp, file);
  return { changed: true, skipped: false, diff: unifiedDiff(before, after, file) };
}
```

Only run `areDesignDiagramsCurrent` when `hasGeneratedDiagramRegion(design.md)` is true.

- [ ] **Step 5: Run design tests**

Run: `node --test test/design-validator.test.js test/diagram-renderer.test.js`

Expected: PASS.

- [ ] **Step 6: Commit design validation**

```bash
git add src/lifecycle/design-schema.js src/lifecycle/design-loader.js src/lifecycle/design-validator.js src/lifecycle/diagram-renderer.js test/design-validator.test.js test/diagram-renderer.test.js
git commit -m "feat: enforce portable Pentaho design contract"
```

---

### Task 4: Refactor workflow inspection around explicit scope

**Files:**
- Create: `src/lifecycle/context-inventory.js`
- Modify: `src/workflow/inspect.js`
- Modify: `src/workflow/state.js`
- Modify: `src/workflow/lock.js`
- Modify: `test/workflow-inspect.test.js`
- Modify: `test/workflow-state.test.js`

**Interfaces:**
- Consumes: `inspectWorkflow(scope)` from Task 1.
- Produces: inspection with `requestPath`, `etlRepositoryPath`, `input`, `artifacts`, `artifactHashes`, `state`, `stateError`.
- Produces: `decideNextStage(inspection)` including `TARGET_PROJECT_UNRESOLVED`.
- Produces: `inventoryContext(inputPath) -> { files, textFiles, opaqueFiles, hash }`.
- Keeps: `readWorkflowState(requestPath)` and `withWorkflowLock(requestPath, callback, options)`; rename internal variable `reqDir` to `requestPath` only.

- [ ] **Step 1: Rewrite fixtures without `.pentaho-mcp.yaml` or `REQ_*`**

```js
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pentaho-workflow-inspect-'));
  const requestPath = path.join(root, 'docs-repo', 'xuất-user-active');
  const etlRepositoryPath = path.join(root, 'etl-repo');
  mkdirSync(path.join(requestPath, 'input'), { recursive: true });
  mkdirSync(etlRepositoryPath, { recursive: true });
  writeFileSync(path.join(requestPath, 'input', 'request.md'), '# Request\n');
  return { requestPath, etlRepositoryPath, scope: resolveLifecycleScope({ requestPath, etlRepositoryPath }) };
}
```

Replace the old “unsupported `.xlsx` blocks” test with:

```js
test('all input files participate in context inventory and hashing', () => {
  const { scope, requestPath } = fixture();
  writeFileSync(path.join(requestPath, 'input', 'mapping.xlsx'), 'bytes');
  const inspection = inspectWorkflow(scope);
  assert.equal(inspection.input.files.length, 2);
  assert.ok(inspection.input.files.some(file => file.endsWith('mapping.xlsx')));
  assert.equal(decideNextStage(inspection).stage, 'REQUIREMENT');
});
```

Add:

```js
test('validated design without project_path blocks instead of choosing a target', () => {
  const { scope, requestPath } = fixture();
  writeRequirement(requestPath);
  writeDesignWithoutTarget(requestPath);
  const decision = decideNextStage(inspectWorkflow(scope));
  assert.equal(decision.stage, 'BLOCKED');
  assert.equal(decision.reason, 'TARGET_PROJECT_UNRESOLVED');
});
```

- [ ] **Step 2: Run inspect/state tests and verify old signatures fail**

Run: `node --test test/workflow-inspect.test.js test/workflow-state.test.js`

Expected: FAIL because `inspectWorkflow` still expects config plus `reqDir`.

- [ ] **Step 3: Change inspection to use scope paths**

Implement context inventory first:

```js
// src/lifecycle/context-inventory.js
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { hashTree } from '../workflow/hash.js';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.yaml', '.yml', '.json', '.csv', '.sql']);

export function inventoryContext(inputPath) {
  if (!existsSync(inputPath) || !statSync(inputPath).isDirectory()) {
    return { files: [], textFiles: [], opaqueFiles: [], unreadableFiles: [], hash: null };
  }
  const files = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  walk(inputPath);
  files.sort((a, b) => a.localeCompare(b, 'en'));
  const textFiles = files.filter(file => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const unreadableFiles = [];
  for (const file of textFiles) {
    try { readFileSync(file, 'utf8'); }
    catch (error) { unreadableFiles.push({ file, error: error.message }); }
  }
  return {
    files,
    textFiles,
    opaqueFiles: files.filter(file => !textFiles.includes(file)),
    unreadableFiles,
    hash: files.length ? hashTree(files, { root: inputPath }) : null,
  };
}
```

```js
export function inspectWorkflow(scope) {
  const input = inventoryContext(scope.inputPath);
  const manifestFile = path.join(scope.designPath, 'manifest.yaml');
  const projectPath = manifestProjectPath(manifestFile);
  let runtimePath = null;
  let targetError = null;
  if (projectPath) {
    try { runtimePath = resolveEtlProjectPath(scope, projectPath); }
    catch (error) { targetError = error.message; }
  }
  return {
    workflowId: path.basename(scope.requestPath),
    requestPath: scope.requestPath,
    etlRepositoryPath: scope.etlRepositoryPath,
    input: { directory: scope.inputPath, ...input },
    artifacts: {
      requirementFile: scope.requirementPath,
      requirementExists: existsSync(scope.requirementPath),
      designDir: scope.designPath,
      designExists: existsSync(manifestFile),
      runtimeDir: runtimePath,
      runtimeFiles: runtimePath ? filesUnder(runtimePath) : [],
    },
    artifactHashes: {
      requirement: existsSync(scope.requirementPath) ? hashTree([scope.requirementPath], { root: scope.requestPath }) : null,
      design: hashFiles(filesUnder(scope.designPath), scope.requestPath),
      runtime: runtimePath ? hashFiles(filesUnder(runtimePath), scope.etlRepositoryPath) : null,
    },
    state: readWorkflowState(scope.requestPath),
    stateError: null,
    targetError,
  };
}
```

Wrap `readWorkflowState` in the current try/catch so malformed advisory state populates `stateError` instead of throwing; retain the exact `artifactHashes` shape shown above.

- [ ] **Step 4: Update stage decisions**

Implement decisions in this order so stale upstream data wins over downstream target resolution:

```js
if (inspection.input.files.length === 0) return decision('BLOCKED', 'INPUT_EMPTY', ['input/ must contain context']);
if (inspection.input.unreadableFiles.length) {
  return decision('BLOCKED', 'CONTEXT_UNREADABLE', inspection.input.unreadableFiles.map(row => `${row.file}: ${row.error}`));
}
if (inspection.state?.input_hash && inspection.state.input_hash !== inspection.input.hash) {
  return decision('REQUIREMENT', 'INPUT_CHANGED', [], ['requirement', 'design', 'runtime']);
}
if (!inspection.artifacts.requirementExists) return decision('REQUIREMENT', 'REQUIREMENT_MISSING');
if (inspection.state?.artifact_hashes?.requirement && inspection.state.artifact_hashes.requirement !== inspection.artifactHashes.requirement) {
  return decision('DESIGN', 'REQUIREMENT_CHANGED', [], ['design', 'runtime']);
}
if (!inspection.artifacts.designExists) return decision('DESIGN', 'DESIGN_MISSING');
if (inspection.targetError || !inspection.artifacts.runtimeDir) {
  return decision('BLOCKED', 'TARGET_PROJECT_UNRESOLVED', [inspection.targetError ?? 'manifest.pentaho.project_path is required']);
}
if (inspection.state?.artifact_hashes?.design && inspection.state.artifact_hashes.design !== inspection.artifactHashes.design) {
  return decision('GENERATION', 'DESIGN_CHANGED', [], ['runtime']);
}
if (inspection.artifacts.runtimeFiles.length === 0) return decision('GENERATION', 'RUNTIME_MISSING');
if (inspection.state?.artifact_hashes?.runtime && inspection.state.artifact_hashes.runtime !== inspection.artifactHashes.runtime) {
  return decision('MODIFYING', 'RUNTIME_CHANGED', [], ['design']);
}
if (inspection.state?.current_stage === 'COMPLETE') return decision('COMPLETE', 'UNCHANGED_COMPLETE');
return decision('VALIDATING', 'ARTIFACTS_PRESENT');
```

- [ ] **Step 5: Run workflow tests**

Run: `node --test test/workflow-inspect.test.js test/workflow-state.test.js`

Expected: PASS.

- [ ] **Step 6: Commit workflow inspection**

```bash
git add src/lifecycle/context-inventory.js src/workflow/inspect.js src/workflow/state.js src/workflow/lock.js test/workflow-inspect.test.js test/workflow-state.test.js
git commit -m "refactor: inspect lifecycle from explicit repository roots"
```

---

### Task 5: Migrate lifecycle tool schemas and handlers

**Files:**
- Modify: `src/tools/lifecycle.tools.js`
- Modify: `test/lifecycle-tools.test.js`
- Modify: `test/lifecycle-surface.test.js`

**Interfaces:**
- Consumes: `ctx.settings` from Task 1.
- Consumes: `resolveLifecycleScope(args, ctx.settings)` and `inspectWorkflow(scope)`.
- Produces: every high-level lifecycle tool schema requires `requestPath` and `etlRepositoryPath`.

- [ ] **Step 1: Write failing public-schema tests**

```js
test('lifecycle tools expose explicit request and ETL repository roots', () => {
  for (const tool of lifecycleTools({ settings: { allowedRoots: [] } })) {
    assert.deepEqual(tool.inputSchema.required.slice(0, 2), ['requestPath', 'etlRepositoryPath']);
    assert.equal(Object.hasOwn(tool.inputSchema.properties, 'workspaceRoot'), false);
    assert.equal(Object.hasOwn(tool.inputSchema.properties, 'requirementFolder'), false);
  }
});

test('requirement write works without a workspace config file', async () => {
  const { requestPath, etlRepositoryPath } = workspace();
  const result = await tool('pentaho_requirement_write').handler({
    requestPath,
    etlRepositoryPath,
    content: validVietnameseRequirement(),
    expectedHashes: {},
  });
  assert.equal(result.validation.ok, true);
  assert.equal(existsSync(path.join(requestPath, 'requirement.md')), true);
});
```

- [ ] **Step 2: Run lifecycle tool tests and verify schema failures**

Run: `node --test test/lifecycle-tools.test.js test/lifecycle-surface.test.js`

Expected: FAIL because tools still require `workspaceRoot` and `requirementFolder`.

- [ ] **Step 3: Replace base schema and scope resolution**

```js
const scopeProperties = {
  requestPath: str('Absolute path to the request folder containing input/, requirement.md, and design/'),
  etlRepositoryPath: str('Absolute path to the root of the Pentaho ETL repository'),
};

const baseSchema = extra => ({
  type: 'object',
  properties: { ...scopeProperties, ...extra },
  required: ['requestPath', 'etlRepositoryPath'],
});

function resolveScope(args, ctx) {
  return resolveLifecycleScope(args, ctx.settings ?? {});
}
```

Change `lifecycleTools()` to `lifecycleTools(ctx = {})` and use these helpers in every handler:

```js
function inspect(args, ctx) {
  const scope = resolveScope(args, ctx);
  const inspection = inspectWorkflow(scope);
  return { scope, inspection, decision: decideNextStage(inspection) };
}

function statusPayload(args, ctx) {
  const result = inspect(args, ctx);
  return {
    scope: {
      requestPath: result.scope.requestPath,
      etlRepositoryPath: result.scope.etlRepositoryPath,
    },
    inspection: result.inspection,
    decision: result.decision,
    expectedHashes: {
      ...fileHashes(result.scope.requestPath),
      ...(result.inspection.artifacts.runtimeDir ? fileHashes(result.inspection.artifacts.runtimeDir) : {}),
    },
  };
}
```

Bind handlers as `handler: args => statusPayload(args, ctx)` so every factory instance uses its own settings.

- [ ] **Step 4: Update requirement/design writes**

Remove the `inspection.input.unsupported` guard. Stage temporary requirement content under an arbitrary temporary folder; validation cannot depend on its basename. Use `assertRequestWrite(scope, scope.requirementPath)` and `assertRequestWrite` for every staged design destination.

Keep exact compare-and-swap behavior:

```js
return withWorkflowLock(scope.requestPath, () => {
  const write = writeArtifactSet([{ path: scope.requirementPath, content: args.content }], args.expectedHashes ?? {});
  const updated = inspectWorkflow(scope);
  writeWorkflowState(scope.requestPath, nextState(updated, 'REQUIREMENT', report));
  return { write, validation: report, next: decideNextStage(updated) };
});
```

- [ ] **Step 5: Update lifecycle prompt tests**

Assert `develop-pentaho-job` requires `requestPath` and `etlRepositoryPath`, includes both exact values in its generated message, tells the agent to inspect `input/`, and tells it to ask when `manifest.pentaho.project_path` is unresolved. Assert the prompt does not contain `REQ_`, `.pentaho-mcp.yaml`, `workspaceRoot` or `requirementFolder`.

- [ ] **Step 6: Run lifecycle tests**

Run: `node --test test/lifecycle-tools.test.js test/lifecycle-surface.test.js`

Expected: PASS.

- [ ] **Step 7: Commit lifecycle tools**

```bash
git add src/tools/lifecycle.tools.js test/lifecycle-tools.test.js test/lifecycle-surface.test.js
git commit -m "feat: expose path-driven Pentaho lifecycle tools"
```

---

### Task 6: Migrate generation, synchronization and finalization

**Files:**
- Modify: `src/generation/generate.js`
- Modify: `src/lifecycle/finalize.js`
- Modify: `src/sync/apply-design-delta.js`
- Modify: `src/tools/lifecycle.tools.js`
- Modify: `test/generation.test.js`
- Modify: `test/lifecycle-e2e.test.js`
- Modify: `test/sync-changes.test.js`

**Interfaces:**
- Changes: `planGeneration(scope, designPackage) -> plan`
- Changes: `finalizeWorkflow(scope, settings) -> report`
- Keeps: `generateProject(plan, expectedHashes)` and `applyDesignDelta(designDir, deltas, expectedHashes)`.

- [ ] **Step 1: Rewrite generation fixture with two independent roots**

```js
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'generation-'));
  const requestPath = path.join(root, 'documents', 'rates-export');
  const etlRepositoryPath = path.join(root, 'pentaho-runtime');
  mkdirSync(path.join(requestPath, 'input'), { recursive: true });
  mkdirSync(path.join(requestPath, 'design', 'jobs'), { recursive: true });
  mkdirSync(path.join(requestPath, 'design', 'transformations'));
  mkdirSync(etlRepositoryPath);
  return {
    requestPath,
    etlRepositoryPath,
    scope: resolveLifecycleScope({ requestPath, etlRepositoryPath }),
  };
}
```

Use `pentaho.project_path: rates`, then assert output exists at `path.join(etlRepositoryPath, 'rates', 'load_rates.ktr')` without any config file.

- [ ] **Step 2: Add a failing double-prefix regression test**

```js
test('project_path is relative to ETL repository root exactly once', () => {
  const { scope, etlRepositoryPath, design } = fixture();
  const plan = planGeneration(scope, loadDesignPackage(design));
  assert.equal(plan.targetDir, path.join(etlRepositoryPath, 'rates'));
  assert.doesNotMatch(plan.targetDir, /pentaho-runtime[\\/]pentaho-runtime/);
});
```

- [ ] **Step 3: Run generation/E2E tests and verify old config signature fails**

Run: `node --test test/generation.test.js test/lifecycle-e2e.test.js test/sync-changes.test.js`

Expected: FAIL because `planGeneration` and `finalizeWorkflow` still consume project config.

- [ ] **Step 4: Refactor generation plan**

```js
export function planGeneration(scope, designPackage) {
  const report = validateDesign(designPackage.designDir);
  if (!report.ok) throw new Error(`Design validation failed: ${JSON.stringify(report.errors)}`);
  const targetDir = resolveEtlProjectPath(scope, designPackage.manifest.pentaho?.project_path);
  assertEtlWrite(scope, targetDir);
  const marker = path.join(targetDir, '.pentaho-mcp-generated.json');
  if (existsSync(targetDir) && readdirSync(targetDir).length && !existsSync(marker)) {
    throw new Error(`Refusing non-empty unmanaged target directory: ${targetDir}`);
  }
  const outputs = new Map();
  for (const row of designPackage.manifest.components.jobs) {
    const file = assertEtlWrite(scope, path.join(targetDir, row.artifact_name));
    outputs.set(file, generateJobXml(designPackage.jobs.get(row.id), designPackage.manifest));
  }
  for (const row of designPackage.manifest.components.transformations) {
    const file = assertEtlWrite(scope, path.join(targetDir, row.artifact_name));
    outputs.set(file, generateTransformationXml(designPackage.transformations.get(row.id), designPackage.manifest));
  }
  outputs.set(assertEtlWrite(scope, path.join(targetDir, '.kettle', 'shared.xml')), generateSharedXml(designPackage.manifest.connections));
  outputs.set(assertEtlWrite(scope, path.join(targetDir, '.kettle', 'kettle.properties')), generateProperties(designPackage.manifest));
  const entrypoint = designPackage.manifest.components.jobs
    .find(row => row.id === designPackage.manifest.pentaho.entrypoint_job).artifact_name;
  for (const [relative, content] of Object.entries(launchers(entrypoint))) {
    outputs.set(assertEtlWrite(scope, path.join(targetDir, relative)), content);
  }
  for (const [relative, content] of Object.entries(generateDdl(designPackage))) {
    outputs.set(assertEtlWrite(scope, path.join(targetDir, relative)), content);
  }
  outputs.set(assertEtlWrite(scope, marker), `${JSON.stringify({
    schema_version: 1,
    design_id: designPackage.manifest.design.id,
    design_version: designPackage.manifest.design.version,
  }, null, 2)}\n`);
  const inventory = [...outputs.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  return {
    scope,
    designPackage,
    targetDir,
    outputs,
    inventory,
    changelog: path.join(scope.requestPath, 'changelog.md'),
  };
}
```

Call `assertEtlWrite` for every generated output, including component artifacts, `.kettle` files, DDL, launchers and marker. Do not rely only on validation of the target directory.

- [ ] **Step 5: Refactor finalization and lifecycle callers**

Change the signature to:

```js
export function finalizeWorkflow(scope, settings = {}) {
  const inspection = inspectWorkflow(scope);
  const decision = decideNextStage(inspection);
  const blockers = [...decision.blockers];
  const artifacts = [...inventory(scope.requestPath), ...inventory(inspection.artifacts.runtimeDir)]
    .sort((a, b) => a.localeCompare(b, 'en'));
  const requirementReport = inspection.artifacts.requirementExists ? validateRequirement(scope.requestPath) : null;
  const requirement = requirementReport?.ok ? check('PASS', requirementReport) : check(inspection.artifacts.requirementExists ? 'FAIL' : 'MISSING', requirementReport);
  if (requirement.status !== 'PASS') blockers.push('Requirement is missing or invalid');
}
```

Keep the existing function body after requirement validation, applying these exact substitutions and no status-rule changes:

```text
validateDesign(inspection.artifacts.designDir)
validateAll(inspection.artifacts.runtimeDir)
path.join(inspection.artifacts.runtimeDir, '.pentaho-mcp-generated.json')
loadModel(path.join(inspection.artifacts.runtimeDir, row.artifact_name))
```

Update handler calls exactly as follows:

```js
const plan = planGeneration(scope, loadDesignPackage(scope.designPath));
const report = finalizeWorkflow(scope, ctx.settings ?? {});
const pkg = loadDesignPackage(scope.designPath);
```

Do not change the completion rule: requirement, design, Kettle static validation, generation marker and reconciliation must all be `PASS`; PDI remains optional.

- [ ] **Step 6: Run generation, synchronization and E2E tests**

Run: `node --test test/generation.test.js test/lifecycle-e2e.test.js test/sync-changes.test.js`

Expected: PASS.

- [ ] **Step 7: Commit generation/finalization migration**

```bash
git add src/generation/generate.js src/lifecycle/finalize.js src/sync/apply-design-delta.js src/tools/lifecycle.tools.js test/generation.test.js test/lifecycle-e2e.test.js test/sync-changes.test.js
git commit -m "refactor: generate Pentaho into explicit ETL repository"
```

---

### Task 7: Decouple runtime tools from workspace config and implicit log paths

**Files:**
- Modify: `src/tools/runtime.tools.js`
- Modify: `src/runtime/detect.js`
- Modify: `src/runtime/run.js`
- Modify: `test/runtime.test.js`

**Interfaces:**
- Consumes: `ctx.settings` from Task 1.
- Changes runtime tool arguments to `requestPath`, `etlRepositoryPath`, `artifact`, optional `logOutputPath`.
- Keeps `artifact` relative to `etlRepositoryPath` and rejects escape.
- Changes `kettle_runtime_detect` to need no workspace argument.

- [ ] **Step 1: Add failing tool-schema and no-log-default tests**

```js
test('runtime tools use server settings and explicit repository paths', () => {
  const tools = new Map(runtimeTools({ settings: { pentahoHome: null, environment: 'DEV', allowedRoots: [] } }).map(tool => [tool.name, tool]));
  assert.deepEqual(tools.get('kettle_runtime_detect').inputSchema.required ?? [], []);
  assert.deepEqual(tools.get('kettle_runtime_execute').inputSchema.required, ['requestPath', 'etlRepositoryPath', 'artifact']);
  assert.equal(Object.hasOwn(tools.get('kettle_runtime_execute').inputSchema.properties, 'workspaceRoot'), false);
});

test('runtime does not create a log file without explicit logOutputPath', async () => {
  const report = await runPdi(request, { config: settings, spawnImpl: spawnResult({ code: 0 }) });
  assert.equal(report.logFile, null);
});
```

- [ ] **Step 2: Run runtime tests and verify schema failures**

Run: `node --test test/runtime.test.js`

Expected: FAIL because runtime tools still load `.pentaho-mcp.yaml`.

- [ ] **Step 3: Replace runtime context resolution**

```js
function runtimeContext(args, ctx) {
  const scope = resolveLifecycleScope(args, ctx.settings ?? {});
  const artifact = assertEtlWrite(scope, path.resolve(scope.etlRepositoryPath, args.artifact));
  if (!/\.(?:kjb|ktr)$/i.test(artifact)) throw new Error('ARTIFACT_EXTENSION_INVALID');
  let logsDir = null;
  if (args.logOutputPath) {
    logsDir = assertRequestWrite(scope, path.resolve(args.logOutputPath));
  }
  return { config: ctx.settings ?? {}, scope, artifact, logsDir };
}
```

Before resolving, reject absolute `artifact` and any `..` escape. `logOutputPath` must be absolute and inside `requestPath` but outside `input/`. `kettle_runtime_logs` accepts an explicit `logOutputPath` and applies the same containment.

- [ ] **Step 4: Update detection and execution descriptions**

`detectPdi` error messages must refer to MCP setting `PENTAHO_HOME`, not `pentaho.home`. Runtime execution policy continues using `PENTAHO_ENV`; DEV/TEST behavior remains unchanged.

- [ ] **Step 5: Run runtime tests**

Run: `node --test test/runtime.test.js`

Expected: PASS.

- [ ] **Step 6: Commit runtime migration**

```bash
git add src/tools/runtime.tools.js src/runtime/detect.js src/runtime/run.js test/runtime.test.js
git commit -m "refactor: configure Pentaho runtime through MCP settings"
```

---

### Task 8: Remove workspace config dependency and update packaged guidance

**Files:**
- Delete: `src/project/config.js`
- Delete: `test/project-config.test.js`
- Delete: `packaging/config.example.yaml`
- Modify: `src/lifecycle/prompts.js`
- Modify: `src/lifecycle/developing-pentaho-jobs.md`
- Modify: `src/lifecycle/writing-etl-requirements.md`
- Modify: `src/lifecycle/designing-pentaho-solutions.md`
- Modify: `src/lifecycle/generating-pentaho-from-design.md`
- Modify: `src/lifecycle/modifying-pentaho-jobs.md`
- Modify: `packaging/install.ps1`
- Modify: `packaging/doctor.ps1`
- Modify: `test/packaging.test.js`
- Modify: `test/lifecycle-surface.test.js`

**Interfaces:**
- Produces prompt arguments `requestPath`, `etlRepositoryPath`.
- Produces installer env keys `KETTLE_ROOT` (low-level default only), `PENTAHO_HOME`, `PENTAHO_ENV`, optional `PENTAHO_ALLOWED_ROOTS`.
- Removes every runtime import of `loadProjectConfig`.

- [ ] **Step 1: Write failing prompt assertions**

```js
const result = getLifecyclePrompt('develop-pentaho-job', {
  requestPath: 'D:/work/docs/load-customer',
  etlRepositoryPath: 'D:/work/etl-pentaho',
});
const text = result.messages[0].content.text;
assert.match(text, /D:\/work\/docs\/load-customer/);
assert.match(text, /D:\/work\/etl-pentaho/);
assert.match(text, /project_path/);
assert.match(text, /ask the user/i);
assert.doesNotMatch(text, /REQ_|\.pentaho-mcp\.yaml|requirementFolder/);
```

- [ ] **Step 2: Run prompt and packaging tests to verify old guidance fails**

Run: `node --test test/lifecycle-surface.test.js test/packaging.test.js`

Expected: FAIL because prompt/installer still expose the old workspace contract.

- [ ] **Step 3: Change lifecycle prompt**

Define exactly two required prompt arguments. Generated text must instruct the agent to:

```text
Inspect requestPath/input as read-only context.
Maintain requestPath/requirement.md and requestPath/design/.
Treat etlRepositoryPath as the ETL repository root.
Resolve the runtime project only from design/manifest.yaml pentaho.project_path.
If project_path is unresolved, ask the user; do not choose a folder or write to the repository root.
Validate every stage and do not mutate Git.
```

- [ ] **Step 4: Update packaged lifecycle resources**

Replace `workspaceRoot`, `requirementFolder`, `REQ_*` and `.pentaho-mcp.yaml` instructions with the two-root rules. Preserve immutable input, no invented business facts, catalog eligibility, static validation, safe synchronization and no Git mutation.

- [ ] **Step 5: Update installer and doctor**

Add optional PowerShell parameters:

```powershell
param(
  [string] $KettleRoot,
  [string] $PentahoHome,
  [ValidateSet('DEV', 'TEST', 'PROD', 'UNKNOWN')]
  [string] $PentahoEnvironment = 'UNKNOWN',
  [string[]] $PentahoAllowedRoots
)
```

Write corresponding env keys to the MCP server entry. `doctor.ps1` validates only executable availability, MCP handshake and optional `PENTAHO_HOME`; it must not search for `.pentaho-mcp.yaml`.

- [ ] **Step 6: Remove project config files and verify no production import remains**

Run: `rg -n "loadProjectConfig|\.pentaho-mcp\.yaml|requirementFolder|REQ_<|REQ_\\d" src packaging`

Expected: no production match. Historical design/spec documents under `docs/superpowers/specs` may still describe the legacy architecture and must not be rewritten.

- [ ] **Step 7: Run prompt and packaging tests**

Run: `node --test test/lifecycle-surface.test.js test/packaging.test.js`

Expected: PASS.

- [ ] **Step 8: Commit surface and packaging changes**

```bash
git add src/lifecycle src/project/config.js test/project-config.test.js packaging src/lifecycle/prompts.js test/lifecycle-surface.test.js test/packaging.test.js
git commit -m "refactor: remove workspace manifest requirement"
```

---

### Task 9: Update public documentation and complete migration verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/install.md`
- Modify: `docs/operations.md`
- Modify: `docs/tools-reference.md`
- Modify: `docs/workflow-guide.md`
- Modify: `docs/documentation-facts.md`
- Modify: `test/knowledge-coverage.test.js`
- Modify: `test/smoke.test.js`

**Interfaces:**
- Documents the final user prompt and the exact two-root JSON tool contract.
- Documents `manifest.pentaho.project_path` as ETL-root-relative.
- Documents environment-only technical settings and target-resolution error behavior.

- [ ] **Step 1: Add or update documentation fact assertions**

Tests must assert that generated/public documentation contains:

```text
requestPath
etlRepositoryPath
TARGET_PROJECT_UNRESOLVED
PENTAHO_HOME
PENTAHO_ENV
```

Tests must reject current-contract references to:

```text
.pentaho-mcp.yaml
requirementFolder
REQ_<ID>_<UPPER_SNAKE>
```

Exclude historical superseded specs from the rejection scan.

- [ ] **Step 2: Run documentation/smoke tests and verify stale docs fail**

Run: `node --test test/knowledge-coverage.test.js test/smoke.test.js`

Expected: FAIL with stale configuration or tool documentation.

- [ ] **Step 3: Rewrite public examples around a real prompt**

Use this canonical example consistently:

```text
Đọc yêu cầu tại D:/work/docs/load-customer và phát triển job Pentaho với repository ETL tại D:/work/etl-pentaho.
```

Document that `requestPath` points to the request folder, not the docs repository root, while `etlRepositoryPath` points to the entire ETL repository. Explain that `project_path: load_customer` is relative and machine-portable.

- [ ] **Step 4: Document first-run target resolution**

Document this exact behavior:

```text
No manifest/project_path -> TARGET_PROJECT_UNRESOLVED -> agent asks user -> agent writes confirmed relative project_path -> validation/generation resumes.
```

Do not document an automatic folder name or output default.

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: all tests PASS, zero failures.

- [ ] **Step 6: Verify production profile**

Run: `npm run verify:profile`

Expected: PASS with the registered tool/resource/prompt surface matching tests.

- [ ] **Step 7: Run stale-contract and path-safety scans**

Run: `rg -n "loadProjectConfig|\.pentaho-mcp\.yaml|requirementFolder|REQ_<ID>|folderPattern|REQ_PATTERN" src packaging README.md docs --glob '!docs/superpowers/specs/*' --glob '!docs/superpowers/plans/*'`

Expected: no stale production/public-contract matches.

Run: `rg -n "path\.join\(targetDir, row\.artifact_name\)|path\.resolve\(scope\.etlRepositoryPath" src`

Expected: every generated target is followed by or wrapped in `assertEtlWrite`; no unchecked artifact destination remains.

- [ ] **Step 8: Commit documentation and final verification changes**

```bash
git add README.md docs test/knowledge-coverage.test.js test/smoke.test.js
git commit -m "docs: document path-driven Pentaho workflow"
```

## Handoff Acceptance Checklist

- [ ] Read the spec before Task 1.
- [ ] Execute tasks in order because public signatures change across Tasks 1–7.
- [ ] Use TDD for every task: observe the specified failure before implementation.
- [ ] Commit only files listed by the current task; preserve unrelated dirty-worktree changes.
- [ ] Do not edit the example corporate workspace outside this repository.
- [ ] Do not automatically migrate or rewrite real docs/ETL repositories.
- [ ] Stop and ask the user if implementation reveals a required output default or implicit repository mapping.
- [ ] Finish only after `npm test`, `npm run verify:profile`, stale-contract scan and path-safety scan all pass.

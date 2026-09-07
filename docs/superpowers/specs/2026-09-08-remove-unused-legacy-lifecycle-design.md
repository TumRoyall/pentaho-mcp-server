# Remove Unused Legacy Lifecycle Design

**Date:** 2026-09-08

**Status:** Approved for implementation

## Purpose

Remove the unregistered BA lifecycle implementation and every source/test asset
that exists only to support it. The production MCP already uses the
Superpowers-driven, knowledge-first workflow and must keep that workflow,
workspace boundary, runtime deferral, and 22-tool contract unchanged.

## Current state

The production entry graph is:

```text
src/index.js
  -> src/server.js
  -> src/tools/registry.js
  -> read + edit + validate + knowledge + runtime tool factories
```

`src/tools/registry.js` does not import `lifecycleTools`. Consequently the BA
lifecycle code is not reachable from the production entry point and is not
embedded in the Windows SEA executable. It is still present in the npm source
package because `package.json.files` includes all of `src`.

The legacy code remains internally connected: `src/tools/lifecycle.tools.js`
imports `src/lifecycle`, `src/generation`, `src/sync`, and `src/workflow`, and
legacy tests import those modules directly. Deleting only `src/lifecycle`
would therefore leave broken source modules and a broken test suite.

## Deletion boundary

Delete the complete legacy implementation island:

- `src/lifecycle/**`
- `src/tools/lifecycle.tools.js`
- `src/generation/**`
- `src/sync/**`
- `src/workflow/**`
- `src/knowledge/pentaho/ddl-from-design.md`
- `src/knowledge/pentaho/lessons-learned.md`

Delete tests and fixtures whose only subject is that implementation:

- `test/design-validator.test.js`
- `test/diagram-renderer.test.js`
- `test/generation.test.js`
- `test/lifecycle-e2e.test.js`
- `test/lifecycle-surface.test.js`
- `test/lifecycle-tools.test.js`
- `test/requirement-validator.test.js`
- `test/sync-changes.test.js`
- `test/workflow-inspect.test.js`
- `test/workflow-state.test.js`
- `test/fixtures/design-package.js`

Add `test/legacy-removal.test.js` as a permanent repository guard. It must fail
while any top-level legacy source path or the two stale knowledge documents
still exist and pass after removal.

## Retained boundary

Keep all production-reachable components:

- `src/core/**`
- `src/knowledge/loader.js`, `src/knowledge/catalog-check.js`, and the current
  catalog/type reference files under `src/knowledge/pentaho/job` and
  `src/knowledge/pentaho/trans`
- `src/knowledge/pentaho/patterns/hops.md`, because it documents the active hop
  editors, and `src/knowledge/pentaho/README.md`, because maintainers use it
- `src/project/**`, because the temporarily retained runtime tools use project
  configuration and path resolution
- `src/runtime/**`
- `src/workspace/**`
- all registered tool factories except the already-unregistered lifecycle
  factory
- `skills/developing-pentaho-jobs/**`

Historical files below `docs/superpowers/specs` and
`docs/superpowers/plans` remain historical records. They may describe the old
lifecycle and are not current production instructions.

`source_old/**` is an independent owner-retained tree. This cleanup must not
read, modify, move, delete, stage, scan as an input, or package it.

## Public contract

The cleanup must not change the supported MCP interface:

- exactly 22 advertised tools;
- 4 read, 9 edit, 1 validation, 4 knowledge, and 4 runtime tools;
- no `pentaho_*` tools;
- no MCP prompt or resource capability;
- `kettle_set_sql` remains absent;
- runtime behavior remains unchanged and outside the idea-to-static-job skill;
- workspace boundary behavior remains unchanged.

## Documentation changes

Current documentation must stop saying that lifecycle source is retained for
rollback. It must state that the BA lifecycle implementation has been removed
and that historical specs/plans are records only.

Update stale product descriptions that say the server has no execution at all.
The truthful contract is that local PDI runtime tools are temporarily retained
but are optional and outside the recommended static workflow.

Comments and headings in packaging scripts must no longer call the product a
"lifecycle MCP". Historical Superpowers documents are exempt from current-doc
wording scans.

## Safety and testing

Removal is performed with exact Git paths. No broad recursive operation may
target the repository root, `src`, `test`, `docs`, or `source_old`.

TDD sequence:

1. Add the absence guard and run it while legacy source exists; it must fail for
   the expected paths.
2. Remove the exact legacy source, tests, fixture, and stale knowledge files.
3. Run the guard again; it must pass.
4. Run the remaining Node suite and production-profile verification.
5. Build and inspect the Windows release where the environment permits SEA
   creation.

## Completion criteria

- Every path in the deletion boundary is absent.
- No current production module imports `lifecycle`, `generation`, `sync`, or
  `workflow` modules.
- No current test imports a deleted module.
- The absence guard passes.
- The remaining Node suite passes, subject only to an explicitly evidenced
  sandbox restriction on the Windows packaging test.
- Production profile reports the exact 22-tool surface.
- The Windows release test passes in an environment allowed to run esbuild and
  SEA injection.
- Current documentation agrees that the legacy implementation is removed.
- Runtime code and behavior are unchanged.
- `source_old` is untouched and unstaged.


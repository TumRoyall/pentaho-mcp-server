# Pentaho MCP Hardening Design

**Date:** 2026-09-09
**Status:** Approved in chat for planning and agent handoff
**Scope:** Reliability, safety, and domain completeness of the existing local stdio MCP server

## Objective

Strengthen `pentaho-mcp-server` for its actual use case: a local, tools-only MCP that reads,
edits, validates, and optionally load-checks or executes Pentaho Kettle `.kjb` and `.ktr`
artifacts. The work preserves the current MCP 2025 stdio architecture. Supporting the
`2026-07-28` protocol, remote HTTP serving, multi-tenant operation, and a general Pentaho IDE
remain out of scope.

## Success Criteria

1. A catalog item advertised as canonical is backed by evidence for the catalog target PDI
   version. The project target is PDI 9.4; PDI 11 compatibility is outside this plan.
2. Windows runtime parameters cannot escape into `cmd.exe` command syntax, runtime output is
   bounded while streaming, timeout terminates the process tree, and runtime log reads are
   bounded.
3. `kettle_search` rejects blank queries and cannot return an unbounded result set.
4. XML mutation targets direct children when the API says direct child, and validation models
   only enabled hops as active graph edges.
5. The server can create a database-oriented artifact without requiring an opaque manual XML
   edit: artifact parameters and connection copying are supported.
6. Element and error-hop removal are explicit, reference-safe operations.
7. MCP tool failures, schemas, annotations, and release identity are clear to clients while
   remaining compatible with the current MCP 2025 SDK line.
8. Every workstream is independently testable and reviewable before integration.

## Non-goals

- Do not migrate to MCP `2026-07-28` or SDK v2.
- Do not claim or implement PDI 11 compatibility as part of this hardening cycle.
- Do not add Streamable HTTP, OAuth, sessions, prompts, or resources.
- Do not build a per-type schema registry for every Pentaho component.
- Do not let the MCP write or promote its production knowledge at runtime.
- Do not add database connectivity tests to the default suite.
- Do not auto-approve or silently execute Kitchen/Pan.
- Do not copy plaintext credentials into generated connection XML.

## Architecture

The existing layers remain intact:

```text
MCP stdio adapter
  -> tool registry and argument contracts
      -> core XML/model/search/validation
      -> immutable knowledge catalog
      -> optional local PDI runtime
      -> canonical workspace boundary
```

Hardening is divided into isolated workstreams. Workstreams that edit disjoint files may run in
parallel in separate worktrees. Changes to `src/tools/registry.js`, the exact production surface,
smoke tests, documentation facts, and release metadata are integrated only after the domain
workstreams land.

## Workstream A: Knowledge Truth

PDI 9.4 is the authoritative product target. The current catalog declaration of PDI 11 is a
metadata defect and is corrected to 9.4 before evaluating any row. PDI 9.4 source-code references,
Spoon-saved artifacts, and runtime/loadcheck records are eligible evidence for this target; no
inference about PDI 11 compatibility is made.

Each catalog row gains:

- `source_version`: exact version used to derive the XML shape, or `not_established`.
- `verified_versions`: a pipe-separated scalar such as `9.3|9.4`; empty means no target-version
  verification is recorded.
- `verification`: `source_reviewed`, `spoon_loaded`, or `runtime_passed`.

A row is generator-eligible only when all existing policy checks pass and
`verified_versions` contains the catalog-level `pdi_version`. Rows lacking explicit PDI 9.4 evidence are
changed to `status: observed` and `generator_eligible: false`; evidence must never be invented.
The analyzer, list, get, and coverage results expose the version evidence.

The workstream produces a PDI 9.4 evidence report listing every retained or downgraded row and the
exact evidence behind the decision. Promotion through PDI 9.4 loadcheck is a separate,
user-authorized task because the target PDI installation may not be available to an agent.

## Workstream B: Runtime Safety and Boundedness

Runtime remains optional and phase-gated. `confirmed: true` remains necessary but is documented
as a caller assertion, not proof of human approval. Host approval and an opt-in environment gate
provide the stronger boundary.

`kettle_runtime_execute` requires both:

- `PENTAHO_ENABLE_EXECUTE=1` in the server environment; and
- `confirmed: true` in the individual call.

On Windows, before a `.bat` command reaches a shell, every token is checked by a conservative
validator. Tokens containing CR, LF, NUL, `"`, `&`, `|`, `<`, `>`, `^`, `%`, or `!` are rejected.
Spaces, commas, drive separators, path separators, `=`, dots, dashes, and underscores remain
valid. Parameter names additionally match `^[A-Za-z_][A-Za-z0-9_.-]*$`.

stdout and stderr use fixed-size tail buffers while data arrives; the process never accumulates
unbounded output before slicing. Timeout termination kills the Windows process tree and returns a
deterministic `TIMEOUT` result. Runtime logs support `limit` and optional `name`, reject symlinked
files that escape the logs directory, and enforce retention by count.

## Workstream C: Bounded Search

`kettle_search` accepts:

```text
query: non-empty string after trim
kind: existing enum
directory: optional in-root directory
limit: integer, 1..500, default 100
```

The result changes from a bare array to:

```json
{
  "matches": [],
  "limit": 100,
  "truncated": false,
  "scannedFiles": 0,
  "scanIssues": []
}
```

Scanning stops collecting matches at the limit. Per-file parse/read failures go to `scanIssues`
and do not consume match slots. Blank queries fail before filesystem traversal. Documentation
calls out this small pre-1.0 response-shape change.

## Workstream D: XML and Graph Correctness

`findDirectChildSpan(xml, parentSpan, childTag)` locates only a direct XML child, ignoring nested
descendants. `setField` uses it. Every segment traversed by `setFieldPath` is also direct relative
to the current scope. XML tag/path arguments must match `^[A-Za-z_][A-Za-z0-9_.-]*$`.

Graph logic treats a hop as active when its `<enabled>` value is not `N`. Active hops alone drive
reachability and satisfy target-reference/error-routing checks. Disabled hops are still checked
for endpoint existence because they remain part of the saved artifact.

When `kettle_add_error_hop` finds an existing disabled ordinary hop from source to target, it
enables that hop in the same atomic edit. Error handling validates both source and target step
names.

## Workstream E: Domain Completeness

The following tools are added after Workstream D is integrated:

### `kettle_set_parameters`

Replaces the artifact-level parameter list using objects with `name`, `default`, and
`description`. Duplicate or blank names are rejected. Transformation parameters live below
`transformation/info/parameters`; job parameters live below `job/parameters`. The operation
preserves unrelated bytes and returns a diff.

### `kettle_copy_connection`

Copies one named `<connection>` block from an in-root source artifact into a destination artifact.
It refuses destination-name collisions and rejects source blocks containing non-placeholder
password values unless `allowEncryptedPassword: true` is explicitly supplied. It does not accept
free-form connection XML.

### `kettle_remove_element`

Removes a named step or entry only when no hop, error-hop, or known step-reference tag points to
it. `removeReferences: true` removes those references and the element atomically. Removing the
sole job START entry is always rejected.

### `kettle_edit_error_hop`

Supports `remove`, `enable`, and `disable` for the error block belonging to a source step. Removing
also removes the ordinary source-target hop only when that hop is not used by another explicit
route.

These operations live in focused core modules rather than making the existing `edit.js` larger.
They reuse the workspace boundary at the tool adapter and the span-based atomic edit contract.

## Workstream F: MCP Contract and Release Hygiene

This workstream runs after the tool surface is final to avoid repeated edits across every tool
definition.

- Failed tool calls return `isError: true` while retaining the readable `{ok:false,error}` text.
- Every tool declares `title` and MCP annotations appropriate to its behavior.
- Object schemas reject unknown properties and add concrete string/number bounds.
- Server-side validation is authoritative; client-side schema validation is not assumed.
- Large structured results may add `structuredContent`; text fallback remains for current clients.
- The server implementation version comes from package/release build metadata rather than a
  hard-coded `0.1.0`.
- Production-profile verification compares an explicit expected tool-name set rather than only a
  numeric count.
- The unused `yaml` runtime dependency is removed.
- `esbuild` is upgraded in isolation and the Windows SEA build is rerun.
- Historical `docs/superpowers/**` files are excluded from the npm tarball while current user docs
  and the companion skill remain included.
- A Windows CI workflow runs Node 20 and the current LTS test/profile matrix; release packaging is
  a separate Windows job.

## Parallel Execution and Integration

The execution environment has four total slots, so the coordinator dispatches at most three
workers concurrently.

```text
Wave 1a (parallel): A Knowledge | B Runtime | C Search
Wave 1b:            D XML correctness (starts when a slot is free)
Integration gate:   review each branch, merge, full test/profile
Wave 2:             E Domain completeness
Integration gate:   end-to-end create/edit/validate workflow
Wave 3:             F MCP contract/release hygiene
Final gate:         full tests, production profile, npm audit, pack dry-run, Windows release
```

Worktrees are mandatory for parallel workers. No two agents edit the same checkout. The
coordinator reviews each branch before integration and resolves conflicts rather than asking a
worker to merge other branches.

## Testing Strategy

- Every behavior change follows red-green TDD with a focused test file.
- Reproductions from the audit become permanent tests: blank search, nested/direct same-name
  field, disabled-hop reachability, disabled ordinary hop during error-hop creation, Windows shell
  metacharacters, bounded output, and log limits.
- Catalog tests enforce target-version evidence mechanically.
- New artifact tools get both core tests and MCP boundary tests.
- After each integrated wave: `npm test`, `npm run verify:profile`, and `git diff --check`.
- Final release verification additionally runs `npm audit --omit=dev`, `npm pack --dry-run --json`,
  and `npm run build:release -- --version 0.1.0-rc.1` on Windows.

## Rollback

Each task is committed independently. A failed workstream can be omitted without reverting other
parallel workstreams. Response-shape and tool-surface changes are pre-1.0 changes but must be
called out in release notes. The previous packaged ZIP remains the operational rollback artifact.

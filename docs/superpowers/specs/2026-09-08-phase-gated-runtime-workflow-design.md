# Current design record: phase-gated runtime in the five-phase workflow

Status: **current** (supersedes the "runtime deferral / runtime outside the
workflow" language in earlier historical records under `docs/superpowers/`).

## What this record supersedes

Earlier plans and specs in this folder describe the companion workflow as an
"idea-to-static-job" flow and state that the four `kettle_runtime_*` tools are
"deferred" and sit **outside** the workflow. That framing is now historical.

Those documents remain for provenance, but where they say runtime is deferred or
out of scope, this record is authoritative instead.

## Current design (authoritative)

The companion skill `skills/developing-pentaho-jobs` implements a **five-phase**
workflow that reuses the existing Superpowers skills and keeps the
`pentaho-mcp-server` 22-tool production surface unchanged:

```
BA requirement
  → superpowers:brainstorming
  → approved Pentaho specification
  → superpowers:writing-plans
  → approved implementation plan
  → superpowers:executing-plans
  → MCP creates/edits KJB/KTR
  → static validation
  → optional PDI loadcheck/execute (phase-gated)
  → handoff
```

Key invariants:

- **Mutation gate:** no MCP edit tool runs until BOTH the written specification
  AND the implementation plan are explicitly approved. Design approval alone is
  not sufficient.
- **Runtime is phase-gated, not removed:** the four `kettle_runtime_*` tools
  remain part of the 22-tool surface. They are forbidden during brainstorming,
  specification, planning, and artifact construction. `kettle_runtime_loadcheck`
  runs only after static validation passes; `kettle_runtime_execute` requires
  explicit user approval for that execution, a detected `PENTAHO_HOME`, no
  literal credentials, a statically valid artifact, and `confirmed: true`.
- **Execution policy:** `src/runtime/policy.js` allows execution only when
  `confirmed === true`; there is no environment-name (`DEV`/`TEST`) auto-allow.
- **Unchanged:** 22-tool count, no MCP prompt/resource surface, no
  learning/promotion surface, no BA lifecycle tools, workspace-boundary
  enforcement, and `source_old` exclusion.

Authoritative sources: `skills/developing-pentaho-jobs/SKILL.md`,
`skills/developing-pentaho-jobs/references/pentaho-plan-template.md`,
`src/runtime/policy.js`, `src/runtime/run.js`, `scripts/verify-production-profile.mjs`.

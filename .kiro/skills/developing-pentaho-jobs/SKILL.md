---
name: developing-pentaho-jobs
description: Use when turning a BA requirement, ticket, or approved Pentaho request into validated KJB/KTR artifacts — reuses Superpowers for design/spec/planning/execution and pentaho-mcp-server for knowledge-first XML edits, static validation, and optional PDI loadcheck/execute.
---

# Developing Pentaho Jobs

## Overview

This is the single companion orchestration skill for the end-to-end Pentaho
workflow:

```
BA requirement
  → superpowers:brainstorming
  → approved Pentaho specification
  → superpowers:writing-plans
  → approved implementation plan
  → superpowers:executing-plans
  → MCP creates/edits KJB/KTR
  → static validation
  → optional PDI loadcheck/execute
  → handoff
```

**Superpowers owns the reasoning:** brainstorming, approval gates,
specification, and planning. **`pentaho-mcp-server` owns the deterministic
operations** on `.kjb`/`.ktr`: knowledge lookup, XML create/edit, graph
operations, static validation, and the four runtime tools.

Reuse the existing Superpowers skills (`superpowers:brainstorming`,
`superpowers:writing-plans`, `superpowers:executing-plans`). Do **not** create
separate custom skills for brainstorming, specification, planning, execution, or
validation. This `developing-pentaho-jobs` skill is the only custom domain
skill.

**Core principle:** never invent Pentaho XML. Consult the embedded knowledge
catalog with `kettle_knowledge_get` before you add or configure any step/entry
type. `kettle_validate` reporting zero structural errors defines static "done".

## The mutation gate (read this first)

**No MCP edit tool may run until BOTH the written specification AND the
implementation plan have been explicitly approved.** Design approval alone is
**not** sufficient — it unlocks writing the spec, nothing more.

- The MCP edit tools are: `kettle_create_file`, `kettle_add_element`,
  `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields`,
  `kettle_edit_hops`, `kettle_add_error_hop`, `kettle_rename_element`,
  `kettle_clone`.
- Before both approvals, only **read** and **knowledge** tools are allowed:
  `kettle_list`, `kettle_summary`, `kettle_get_element`, `kettle_search`,
  `kettle_knowledge_list`, `kettle_knowledge_get`, `kettle_knowledge_analyze_xml`,
  `kettle_knowledge_coverage`.
- Runtime tools (`kettle_runtime_*`) are gated separately — see Phase 5.

Reference templates, both discoverable from this skill:
`references/pentaho-spec-template.md` and `references/pentaho-plan-template.md`.

## Phase 1 — BA requirement and design

1. Accept a free-form BA requirement, ticket, document, or approved requirement.
2. Read `references/pentaho-spec-template.md` completely.
3. Invoke `superpowers:brainstorming`.
4. Clarify source/target, mapping, variables, connections, orchestration,
   failure behavior, restart/idempotency expectations, and acceptance criteria.
5. Obtain explicit design approval.
6. Do **not** mutate any `.kjb`/`.ktr` artifact during this phase.

Read-only MCP calls are allowed here to ground decisions: `kettle_list`,
`kettle_summary`, `kettle_get_element`, `kettle_search`, `kettle_knowledge_list`,
`kettle_knowledge_get`, `kettle_knowledge_analyze_xml`,
`kettle_knowledge_coverage`. **No edit or runtime tool** in this phase.

## Phase 2 — Specification

1. Produce a complete Pentaho implementation specification using
   `references/pentaho-spec-template.md`.
2. The specification must contain: objective and boundaries; artifact inventory;
   variables, parameters, and connections; job definitions; transformation
   definitions; static and runtime acceptance criteria.
3. Artifact paths must be workspace-relative.
4. Credentials must be external variables, never literal values.
5. No `TBD`, unresolved decision, or ambiguous artifact contract may remain.
6. Obtain explicit user/BA approval of the written specification.
7. Do **not** mutate Pentaho artifacts yet — spec approval alone does not unlock
   edits.

## Phase 3 — Planning

1. After specification approval, invoke `superpowers:writing-plans`.
2. Require the generated plan to follow `references/pentaho-plan-template.md`
   (an artifact-and-MCP-call plan, not the generic software-code/TDD plan
   format).
3. The plan must be artifact-oriented: leaf `.ktr` files first; dependent `.ktr`
   files next; orchestration `.kjb` files last; whole-tree verification after
   all artifacts.
4. Every artifact task must contain: exact workspace-relative path; artifact
   kind and internal name; dependencies; knowledge lookups required; exact MCP
   tool intent/calls; expected entries/steps and configuration; normal and error
   hops; a focused `kettle_validate`; and the expected validation result.
5. Obtain explicit approval of the implementation plan.
6. **No edit or runtime MCP tool may be invoked before this approval.** With both
   the specification and the plan approved, the mutation gate is now open.

## Phase 4 — Implementation

1. Invoke `superpowers:executing-plans`.
2. Use MCP edit tools to execute the approved plan.
3. Before adding or configuring **each distinct** entry/step type, call
   `kettle_knowledge_get(kind, type)`. Inspect its template, field mapping,
   defaults, and gotchas.
4. If a type is missing, observed-only, or not generator-eligible, **stop** that
   artifact task and report the exact catalog limitation. Do not invent XML.
5. Use only these edit primitives: `kettle_create_file`, `kettle_add_element`,
   `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields`,
   `kettle_edit_hops`, `kettle_add_error_hop`, `kettle_rename_element`,
   `kettle_clone`. SQL stays a normal `<sql>` field: set it with
   `kettle_set_field` using `field: "sql"`.
6. Run `kettle_validate` after every changed artifact.
7. Do not silently diverge from the approved spec or plan.
8. Do not deploy or mutate Git unless explicitly requested.

## Phase 5 — Verification and runtime authorization

1. Run `kettle_validate` on each artifact and on the complete target tree.
2. Static completion requires:
   - zero structural errors;
   - zero warnings, or every remaining warning is explicitly reviewed and
     accepted;
   - no unresolved manual-review marker;
   - artifact inventory matches the approved specification.
3. **Only after static validation passes** do the runtime tools become
   available: `kettle_runtime_detect`, `kettle_runtime_loadcheck`,
   `kettle_runtime_execute`, `kettle_runtime_logs`.
4. `kettle_runtime_loadcheck` may run **only after** static validation.
5. `kettle_runtime_execute` requires **all** of:
   - explicit user approval for that specific execution;
   - a configured and detected `PENTAHO_HOME` (`kettle_runtime_detect`
     reporting `available: true`);
   - parameters supplied without literal credentials;
   - the artifact already passing static validation.
   The tool also enforces `confirmed: true` at the call boundary.
6. A runtime failure (`FAIL`/`TIMEOUT`/`STATIC_VALIDATION_FAILED`/`UNAVAILABLE`)
   must **not** be reported as a successful implementation.
7. Final handoff must include: artifact inventory; files created/modified;
   per-artifact validation summaries; whole-tree validation summary;
   warnings/manual-review decisions; loadcheck result when performed; execution
   result and log location when performed; and an explicit note of deferred
   runtime verification when execution was not authorized.

## Runtime authorization by phase

Runtime tools are **not** banned — they are phase-gated:

- **Forbidden** during brainstorming, specification, planning, and artifact
  construction (Phases 1–4).
- `kettle_runtime_detect` and `kettle_runtime_logs` are read-only probes,
  usable once you reach verification.
- `kettle_runtime_loadcheck` runs only after static validation passes.
- `kettle_runtime_execute` is permitted **only after** static validation **and**
  explicit user approval for that execution.

## Prohibitions

- You must not generate testcases in this workflow.
- You must not access databases in this workflow.
- You must not deploy Pentaho artifacts.
- You must not invent or fabricate Pentaho XML; every type comes from the
  knowledge catalog via `kettle_knowledge_get`.
- You must not run any MCP edit tool before BOTH the specification AND the plan
  are approved.
- You must not run runtime tools before static validation, and you must not
  `kettle_runtime_execute` without explicit user approval.
- You must not mutate Git unless the user explicitly requests it.
- You must not write literal credentials; credentials are always external
  variables.
- You must not read from or modify `source_old`.
- You must not use the unregistered BA lifecycle tools of any category (project
  inspection, workflow state, requirement/design writing, project generation,
  change synchronization, project validation, or finalization). They are not
  part of the production surface.

## Completion boundary

Static validation is the completion boundary for the build. `kettle_validate`
reporting **zero structural errors** for every artifact and for the whole tree —
plus a resolved specification with no placeholders or literal credentials — is
what static "done" means. Runtime loadcheck/execute is an authorized,
phase-gated verification step, not a substitute for static validation; when it
is not authorized, record it as deferred verification in the handoff.

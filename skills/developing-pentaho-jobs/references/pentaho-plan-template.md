# Pentaho Implementation Plan

> This plan is produced by `superpowers:writing-plans` **after** the
> specification is approved, and it must itself be approved before any MCP edit
> tool runs. It is an **artifact-and-MCP-call** plan, not the generic
> software-code/TDD plan format — do not copy that format blindly. Each task
> builds exactly one `.kjb`/`.ktr` with precise MCP tool calls and a focused
> `kettle_validate`. All paths are **workspace-relative**. Credentials are
> **external variables**, never literals.

## Ordering rule

Order tasks so dependencies are satisfied before they are needed:

1. Leaf `.ktr` files first (no dependency on other artifacts).
2. Dependent `.ktr` files next (consume or feed other transformations).
3. Orchestration `.kjb` files last (reference the finished `.ktr` files).
4. A final whole-tree verification task after all artifacts exist.

## Task template

Copy one block per artifact. Fill in every field.

### Task N: Build `<artifact path>`

Artifact:

- **Path:** `<workspace-relative path ending in .kjb/.ktr>`
- **Kind:** `job` | `trans`
- **Internal name:** `<internal artifact name from the spec>`
- **Purpose:** `<the single responsibility of this artifact>`
- **Dependencies:** `<other artifacts that must exist first, or "none">`

Knowledge lookups:

- List the exact `kettle_knowledge_get(kind, type)` call for **each distinct**
  entry/step type this artifact uses, e.g.
  `kettle_knowledge_get("trans", "TableInput")`.
- If any type is missing, observed-only, or not generator-eligible, this task
  **stops** and reports the exact catalog limitation. Do not invent XML.

Implementation:

- **Ordered MCP edit calls / tool intent:** the exact sequence, e.g.
  `kettle_create_file` → `kettle_add_element` → `kettle_set_field` /
  `kettle_set_fields` / `kettle_set_field_path`.
- **Elements:** exact element names and Pentaho types to add.
- **Field / list / path configuration:** the concrete `field`/`fieldPath`/
  `listTag`+`itemTag`+`items` values (SQL is a normal `<sql>` field set via
  `kettle_set_field` with `field: "sql"`).
- **Normal hops:** each `kettle_edit_hops` call (from → to, evaluation/
  unconditional for job hops).
- **Error hops:** each `kettle_add_error_hop` call (source → target, error-field
  contract), or "none".

Focused verification:

- **Exact call:** `kettle_validate("<artifact path>")`.
- **Expected errors/warnings:** the expected result (normally zero structural
  errors; list any accepted catalog warnings).
- **Blocking conditions:** what must be clean before the next artifact task may
  start.

## Final task: whole-tree verification

- **Call:** `kettle_validate` on the complete target directory (omit `path` or
  pass the target directory).
- **Expected result:** zero structural errors across every artifact; artifact
  inventory matches the approved specification; no unresolved manual-review
  marker; warnings either zero or explicitly accepted.
- **Runtime (optional, phase-gated):** if authorized, note the intended
  `kettle_runtime_loadcheck` and — only with explicit user approval and a
  detected `PENTAHO_HOME` — `kettle_runtime_execute` calls. Otherwise record
  runtime verification as deferred.

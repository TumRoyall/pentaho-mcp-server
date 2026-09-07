# Superpowers-Driven Pentaho Job Workflow Design

**Date:** 2026-09-07

**Status:** Proposed for implementation

## 1. Purpose

Refactor `pentaho-mcp-server` so its primary workflow produces statically validated Pentaho jobs and transformations from a user idea without duplicating the planning responsibilities already provided by Superpowers.

The target workflow is:

```text
User idea
  -> superpowers:brainstorming
  -> Pentaho implementation specification
  -> superpowers:writing-plans
  -> agent executes the plan with Pentaho MCP primitive tools
  -> static validation
  -> handoff of .kjb/.ktr artifacts
```

The MCP is a Pentaho domain engine. Superpowers owns requirement discovery, design reasoning, specification, and implementation planning.

## 2. Goals

- Turn a user idea into one or more `.kjb` and `.ktr` artifacts through an explicit spec and plan.
- Let Superpowers own brainstorming, design alternatives, clarification, approval gates, specification, and planning.
- Let the MCP own Pentaho knowledge lookup, XML creation/editing, graph operations, and static validation.
- Make the production workflow independent of the existing BA-specific `REQ_*` lifecycle.
- Require the agent to consult the knowledge catalog instead of inventing Pentaho XML.
- Enforce a workspace boundary for every MCP file read and write, even when `KETTLE_ROOT` is not set.
- Preserve the existing span-based edits, embedded knowledge, validation behavior, and minimal diffs.
- Keep runtime execution code available for a later dedicated refactor, but exclude runtime execution and automated test generation from this workflow.

## 3. Non-goals

- Generate test cases or test fixtures.
- Create Docker containers or temporary databases.
- Read business data from DEV or production databases.
- Execute Kitchen/Pan as part of the idea-to-job workflow.
- Assert output data or row-level business correctness.
- Deploy Pentaho artifacts or mutate Git.
- Repair runtime command execution, process isolation, secret transport, or runtime authorization in this change.
- Rewrite the template-driven generator or make `pentaho_generate` production-ready.
- Delete the legacy lifecycle implementation from disk in the first refactor.
- Modify, sanitize, delete, move, scan, package, or otherwise include `source_old` in this work.

## 4. Repository Boundary

`source_old` is explicitly outside the product and outside this refactor. It may remain in the repository/workspace for the owner's later use.

Implementation agents must:

- Ignore all existing and future changes under `source_old/`.
- Never use `source_old/` as runtime knowledge, a generation template, a test fixture source, or a build input.
- Never add it to release artifacts.
- Avoid broad mechanical rewrites or scans that traverse it.
- Avoid reporting its content as part of this implementation unless the user separately requests that work.

## 5. Responsibility Boundary

### 5.1 Superpowers responsibilities

Superpowers handles the reasoning workflow:

- Clarify the source, target, transformations, operational behavior, and error policy.
- Identify missing or conflicting business decisions.
- Compare alternative Pentaho decompositions.
- Decide the `.kjb`/`.ktr` artifact structure.
- Present the proposed design and obtain user approval.
- Write the Pentaho implementation specification.
- Write an implementation plan with artifact-level tasks and verification steps.
- Coordinate implementation and review.

### 5.2 Pentaho MCP responsibilities

The MCP provides deterministic domain operations:

- Inventory and inspect `.kjb`/`.ktr` files.
- Summarize elements, connections, parameters, SQL previews, and hop graphs.
- Retrieve exact type-specific knowledge and XML templates.
- Create new job/transformation shells.
- Add entries/steps from catalog templates.
- Set direct, nested, and repeatable fields.
- Create normal and error hops.
- Rename and clone artifacts/elements where appropriate.
- Validate XML structure, references, graph rules, connections, and catalog coverage.

The MCP must not decide business requirements or silently invent missing configuration.

## 6. Target Production Surface

### 6.1 Retained primitive tools

After the separately approved removal of `kettle_set_sql`, retain these 22 tools:

**Read — 4**

- `kettle_list`
- `kettle_summary`
- `kettle_get_element`
- `kettle_search`

**Edit — 9**

- `kettle_create_file`
- `kettle_add_element`
- `kettle_set_field`
- `kettle_set_field_path`
- `kettle_set_fields`
- `kettle_edit_hops`
- `kettle_add_error_hop`
- `kettle_rename_element`
- `kettle_clone`

**Validate — 1**

- `kettle_validate`

**Knowledge — 4**

- `kettle_knowledge_list`
- `kettle_knowledge_get`
- `kettle_knowledge_analyze_xml`
- `kettle_knowledge_coverage`

**Runtime — 4, temporarily retained but outside the new workflow**

- `kettle_runtime_detect`
- `kettle_runtime_loadcheck`
- `kettle_runtime_execute`
- `kettle_runtime_logs`

The runtime tools remain behaviorally unchanged in this refactor. They are not considered ready for the new automated test workflow and must not be invoked by the new Pentaho development skill. Runtime behavior will be redesigned in a separate session.

### 6.2 Removed from the production registry

Remove all nine BA lifecycle tools from `tools/list`:

- `pentaho_project_inspect`
- `pentaho_workflow_start`
- `pentaho_workflow_status`
- `pentaho_requirement_write`
- `pentaho_design_write`
- `pentaho_generate`
- `pentaho_sync_changes`
- `pentaho_validate_project`
- `pentaho_finalize`

Do not delete their modules in this first refactor. They become unregistered legacy code so rollback and later extraction remain possible.

### 6.3 Removed MCP prompt/resource surface

Stop advertising:

- The `develop-pentaho-job` MCP prompt.
- The five `dte-pentaho://skills/...` lifecycle resources.

The server should advertise only the capabilities it actually exposes. When there are no MCP prompts or resources, remove the corresponding handlers and capability declarations rather than returning a legacy empty or BA-specific surface.

## 7. Pentaho Development Skill

Create an optional repository skill at:

```text
skills/developing-pentaho-jobs/SKILL.md
```

This skill is the agent-facing orchestration layer. It must require the normal Superpowers approval gates and must not duplicate their implementations.

### 7.1 Skill flow

1. Invoke `superpowers:brainstorming` to clarify the idea and approve the design.
2. Write a Pentaho implementation specification using the contract in Section 8.
3. After the user approves the written spec, invoke `superpowers:writing-plans`.
4. Execute the plan using only the retained read, knowledge, edit, and validate tools.
5. Consult `kettle_knowledge_get` before adding or configuring each distinct Pentaho step/entry type.
6. Validate each changed artifact after its task.
7. Validate the complete artifact tree before completion.
8. Return an artifact inventory, validation evidence, warnings, and any unresolved manual-review markers.

The skill must not invoke runtime tools in this version.

### 7.2 Knowledge-first rule

For every distinct `pentaho_step_type` or `pentaho_entry_type`, the implementing agent must:

```text
kettle_knowledge_get(kind, type)
  -> inspect template, field mapping, defaults, and gotchas
  -> kettle_add_element
  -> configure with set_field/set_field_path/set_fields
```

If a type is missing, observed, or not generator-eligible, the agent must stop that element's implementation and report the catalog limitation. It must not invent a plugin XML layout.

`kettle_knowledge_analyze_xml` remains read-only. This workflow never promotes or mutates shared knowledge automatically.

## 8. Pentaho Implementation Specification Contract

The specification is Markdown intended for human review and agent execution. It is not the old lifecycle `manifest.yaml` schema and does not require a `REQ_*` directory.

Every specification must contain the following sections.

### 8.1 Objective and boundaries

- Business objective.
- Included behavior.
- Explicitly excluded behavior.
- Assumptions approved by the user.

### 8.2 Artifact inventory

A table with one row per `.kjb` or `.ktr`:

| Field | Meaning |
|---|---|
| Path | Workspace-relative destination path |
| Kind | `job` or `transformation` |
| Internal name | Pentaho internal artifact name |
| Purpose | One responsibility of the artifact |
| Called by | Parent artifact or external entrypoint |

All artifact paths must be workspace-relative and use `.kjb` or `.ktr` extensions.

### 8.3 Variables, parameters, and connections

For every variable/parameter:

- Name.
- Type/format.
- Required/default behavior.
- Consumer artifacts.
- Whether the value is non-sensitive or supplied externally.

For every connection:

- Logical connection name.
- Technology/dialect.
- Variable names for host, port, database/service, username, and password.
- No literal credential values.

### 8.4 Job definitions

For each `.kjb`:

- Ordered entry list with stable IDs, display names, Pentaho entry types, and purpose.
- Referenced transformation/job artifact for `TRANS`/`JOB` entries.
- Entry configuration fields required by the catalog reference.
- Hop list with from, to, enabled state, and success/failure/unconditional semantics.
- Failure and completion paths.

### 8.5 Transformation definitions

For each `.ktr`:

- Ordered step list with stable IDs, display names, Pentaho step types, and purpose.
- Exact configuration values or approved variable placeholders.
- Input/output field contract where relevant.
- Normal hop list.
- Error hop list and error-field contract where relevant.
- SQL text or SQL contract where relevant; SQL remains a normal `<sql>` field configured through `kettle_set_field`.

### 8.6 Static acceptance criteria

At minimum:

- Every declared artifact exists.
- Internal artifact names match the specification.
- No unresolved placeholder or literal credential remains.
- Every step/entry type has a catalog reference.
- Every hop endpoint exists.
- Required START/failure/success paths are present where applicable.
- Referenced `.kjb`/`.ktr` paths resolve inside the workspace.
- `kettle_validate` reports zero structural errors for every artifact and for the complete tree.

Business data correctness and runtime execution are explicitly not proven by these criteria.

## 9. Implementation Plan Contract

The implementation plan should be artifact-oriented rather than lifecycle-stage-oriented.

Recommended task order:

1. Establish workspace boundary and inspect existing artifacts.
2. Create shared variables/connections only when required by the approved spec.
3. Implement leaf transformations first.
4. Implement transformations that depend on earlier artifacts.
5. Implement the orchestration job last.
6. Run complete static validation and produce the final inventory.

Every artifact task must include:

- Exact destination path.
- Knowledge lookups required before mutation.
- Exact tool calls or tool intent for entries/steps, configuration, and hops.
- A focused `kettle_validate` call after mutation.
- Expected structural result.
- No runtime execution step.

## 10. Workspace Boundary Design

### 10.1 Current problem

The direct edit layer reads `process.env.KETTLE_ROOT` independently and disables write protection when the variable is absent. Tool path descriptions also allow arbitrary absolute paths. This is not a safe default for an agent-facing file mutation API.

### 10.2 Required behavior

Create one shared workspace path policy used by the read, edit, validate, and knowledge-coverage tool factories.

- Resolve the root once when the server starts.
- Use `KETTLE_ROOT` when configured; otherwise use `process.cwd()`.
- Canonicalize the root.
- Resolve relative tool paths against that root.
- Permit an absolute input path only when its canonical target is inside the root.
- Canonicalize the deepest existing ancestor for create destinations so symlink/junction escapes are rejected.
- Reject `..` traversal and sibling-prefix tricks.
- Apply the boundary to reads as well as writes so the MCP cannot inspect arbitrary local files.
- Restrict create/clone destinations to `.kjb` and `.ktr` through the existing artifact validation.
- Return a stable, actionable boundary error without exposing unrelated filesystem content.

The MCP handler/tool adapter layer owns this security boundary. Core XML functions may remain pure filesystem operations for direct unit testing, but production handlers must never call them with an unchecked path.

### 10.3 Context interface

Replace the ambiguous `resolve` context function with explicit operations equivalent to:

```js
{
  root,
  resolveRead(inputPath),
  resolveWrite(inputPath)
}
```

Both operations return an absolute canonical in-root path or throw. Tool factories must choose the correct resolver for each path:

- `kettle_list`, summary, get, search, validate, coverage: `resolveRead`.
- Create destination and every edit destination: `resolveWrite`.
- Clone source: `resolveRead`; clone destination: `resolveWrite`.

## 11. Data Flow

```text
Approved user idea
  -> Superpowers design discussion
  -> reviewed Pentaho specification
  -> reviewed implementation plan
  -> Pentaho development skill
      -> workspace-bounded inspection
      -> type-by-type knowledge lookup
      -> create/edit artifact
      -> focused static validation
  -> whole-tree static validation
  -> artifact inventory and handoff
```

No lifecycle state file, requirement folder, generated marker, design YAML package, changelog, runtime log, database, or Kitchen/Pan process participates in this flow.

## 12. Error Handling

- Missing business decision: return to brainstorming; do not encode an assumption silently.
- Missing catalog type: report the exact kind/type and stop that artifact task.
- Observed/non-eligible catalog type: require manual review; do not claim clean generation.
- Boundary violation: reject before reading or writing the target.
- Concurrent/external file change: re-inspect before applying another mutation; never overwrite blindly.
- XML mutation failure: leave the original file untouched and report the validation error.
- Static validation error: keep the artifact for inspection, report exact findings, and continue only through an explicit fix step.
- Runtime need discovered: record it as deferred verification; do not call runtime tools from this workflow.

## 13. Testing Strategy

### 13.1 Production surface tests

- Registry advertises exactly 22 tools after `kettle_set_sql` and all nine lifecycle tools are removed.
- Registry retains all named primitive and runtime tools in Section 6.1.
- `tools/list` contains no `pentaho_*` lifecycle tool.
- Server does not advertise prompts or resources capabilities.
- Production-profile verification expects 22 tools, zero prompts, and zero resources.
- Packaged executable and doctor checks expect the same surface.

### 13.2 Workspace-boundary tests

- Missing `KETTLE_ROOT` enforces `process.cwd()` rather than disabling protection.
- Relative in-root reads and writes succeed.
- Absolute in-root reads and writes succeed.
- Absolute out-of-root reads and writes fail.
- `..` escapes fail.
- Sibling paths sharing the root name prefix fail.
- Existing symlink/junction escapes fail where platform permissions allow creating them.
- Clone checks source and destination using their distinct access modes.

### 13.3 Workflow documentation/skill tests

- The new skill names only retained tools.
- The skill requires knowledge lookup before adding/configuring a distinct type.
- The skill requires focused and whole-tree static validation.
- The skill contains no `REQ_*`, lifecycle state, runtime execution, testcase generation, Docker, database access, or deployment instruction.
- The specification template contains all Section 8 contracts.

### 13.4 Regression tests

- Existing core XML edit tests continue to pass.
- Existing knowledge and static validation tests continue to pass.
- Legacy lifecycle module unit tests may remain while the code is unregistered.
- Runtime unit tests remain unchanged in this refactor.
- Full Node test suite and production-profile verification pass.
- Windows SEA build is only claimed as verified when the executable, inventory, and checksum are actually produced and inspected on an environment that permits the build.

## 14. Documentation and Packaging

Update current public documentation to describe:

- The 22-tool production surface.
- Superpowers as the recommended design/planning workflow, not a mandatory protocol dependency of primitive MCP tools.
- Knowledge-first artifact implementation.
- Static validation as the completion boundary of the current workflow.
- Runtime execution/testing as deferred and outside the workflow.
- The removal of BA-specific requirement/design/finalize tools.
- The enforced workspace boundary and safe default root.

Add `skills/` to the npm/release packaging only if the selected distribution mechanism installs or exposes the skill correctly. Do not copy a skill directory into an artifact without documenting how the target agent discovers it.

Historical specs and plans remain historical records and do not need mechanical count rewrites.

## 15. Migration and Compatibility

This is a breaking MCP surface change:

- `kettle_set_sql` disappears in favor of `kettle_set_field` with `field: "sql"`.
- Nine `pentaho_*` lifecycle tools disappear from `tools/list`.
- The lifecycle prompt and resources disappear.
- Existing primitive tools keep their names and schemas except for path descriptions/behavior becoming workspace-bounded.

Because the package is currently version `0.1.0`, no compatibility alias is required. Release notes must call out the removed surface and the new workflow.

Legacy lifecycle source remains temporarily available for reference but is not a supported production API. A later cleanup may delete or extract it after the new workflow has been used successfully.

## 16. Completion Criteria

The refactor is complete when:

- The approved `kettle_set_sql` removal is complete.
- Production advertises exactly the 22 tools in Section 6.1.
- No lifecycle prompt/resource/tool is advertised.
- The Pentaho development skill and specification contract are documented and packaged through an explicit discovery mechanism.
- An agent can take an approved Pentaho spec/plan and produce `.kjb`/`.ktr` using knowledge-first primitive calls.
- Every produced artifact and the complete target tree pass static structural validation.
- All MCP file operations are enforced inside the configured/default workspace root.
- Runtime execution and automated testcase generation have not been introduced into the workflow.
- `source_old` has not been touched.
- Tests, production-profile verification, current documentation, doctor, and release surface counts agree.


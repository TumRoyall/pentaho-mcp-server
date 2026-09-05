# Packaged Pentaho Lifecycle MCP Design

**Date:** 2026-09-04
**Status:** Approved in conversation; implementation not started
**Target:** Kiro on Windows, installed locally from a versioned internal release

## 1. Objective

Extend `kettle-mcp-dte` from a thin Kettle XML tool server into a locally installed Pentaho
lifecycle MCP for Kiro. A user points the agent at a BA-created requirement folder, and the agent
can recover prior work, clarify only genuine gaps, write the required documentation, design the
Pentaho flow, generate or modify runtime artifacts, validate them, and return a complete result.

The release is installed on each developer workstation. It does not call a centrally hosted model
and does not require Internet access. Kiro supplies the model and uses the MCP through stdio.

## 2. User Experience

The intended invocation is conversational:

```text
Phat trien job Pentaho theo yeu cau trong thu muc nay.
```

On every invocation the agent reads the workspace instead of trusting chat memory. If an earlier
session stopped halfway, the agent resumes from the last consistent artifact. If the BA input is
complete, the workflow proceeds without a requirement or design approval pause. If a business
decision is genuinely missing or sources conflict, the agent asks the user and resumes after the
answer.

The successful workflow is:

```text
BA input/*.md
  -> requirement.md
  -> design/design.md + machine-readable design YAML
  -> .kjb/.ktr + shared configuration + optional DDL
  -> static validation
  -> optional PDI load/runtime validation
  -> user edits and delta synchronization
  -> final validation report and changelog
```

The MCP never commits, pushes, creates a branch, or stages files unless the user explicitly asks.

## 3. Chosen Architecture

Ship one product and keep its internal responsibilities separate:

```text
Kiro agent
  -> local stdio MCP executable
       -> lifecycle prompts and resources
       -> workflow state and recovery
       -> high-level lifecycle tools
       -> existing low-level Kettle tools
       -> read-only Pentaho knowledge snapshot
       -> deterministic validators
       -> optional Kitchen/Pan runtime adapter
       -> workspace artifact storage
```

The reasoning model remains in Kiro. The MCP does not embed or call an LLM. Skills provide
reasoning and orchestration policy; tools perform bounded, schema-defined operations; validators
enforce mechanical contracts.

This design was selected over two alternatives:

- Installing skills separately from a thin MCP would make version alignment and workstation setup
  fragile.
- Hosting an autonomous agent service would add model credentials, token accounting, chat state,
  network data handling, and vendor coupling that are unnecessary for an internal Kiro workflow.

## 4. Distribution Model

The Windows release is a versioned ZIP whose primary runtime is a self-contained executable:

```text
dte-pentaho-mcp-<semver>-win-x64.zip
|-- dte-pentaho-mcp.exe
|-- install.ps1
|-- uninstall.ps1
|-- doctor.ps1
|-- config.example.yaml
|-- README.md
|-- CHANGELOG.md
`-- checksums.sha256
```

The executable includes the MCP server, active lifecycle guidance, templates, validators, and a
read-only versioned knowledge snapshot. A workstation does not need Node.js, npm, Python, PyYAML,
or Internet access.

`install.ps1` registers the executable in the user's Kiro MCP configuration. `doctor.ps1` checks
the executable, MCP handshake, project configuration, write boundaries, and optional Pentaho
runtime. Updating is manual: the user downloads and installs a newer internal release. A workflow
records the MCP version that last changed it so an upgrade cannot silently change behavior during
an active run.

The first release supports Windows 10/11 and Kiro IDE/CLI. Linux is out of scope for the first
release, but OS-specific command construction stays behind the runtime adapter.

## 5. Project Configuration and Boundaries

Paths are project-specific and are never inferred solely from the current DTE names. Every project
commits a `.pentaho-mcp.yaml` at its workspace root:

```yaml
schema_version: 1
project:
  code: dte
paths:
  requirements: dte-docs
  pentaho: dte-etl-pentaho
  ai_context: dte-ai-context
environment:
  name: DEV
pentaho:
  home: null
```

All paths are workspace-relative. The requirements and Pentaho roots define the read/write
boundary. `input/` is always read-only. The MCP refuses path traversal, symlink escapes, and writes
outside configured roots. It does not create or rename requirement folders and does not allocate
requirement IDs.

The BA supplies one folder named `REQ_<three-or-more-digit-ID>_<UPPER_SNAKE_CASE_SLUG>` with a
non-empty `input/`. Version one accepts only Markdown input. Any unsupported file is reported and
must not be silently ignored.

## 6. Lifecycle Resources and Orchestration

The existing lifecycle guidance is repackaged as server-provided prompts/resources. Add a new
top-level `developing-pentaho-jobs` orchestrator that coordinates the existing concerns:

- requirement analysis and authoring;
- Pentaho solution design;
- deterministic generation;
- maintenance and change synchronization;
- validation and reporting.

The deployed profile excludes `learning-from-mistakes`. Learning, knowledge promotion, and catalog
editing remain development-only capabilities used to improve later MCP releases. Production
knowledge is immutable.

The orchestrator replaces the current rule that a session must select only one lifecycle skill.
It may cross phases when the previous phase is mechanically ready. Phase-specific invariants still
apply, especially the prohibition on inventing business facts.

Human approval fields and approval stops are removed from the deployed workflow. Readiness is
expressed through technical status:

```text
requirement_status: READY
requirement_validation: PASS
design_status: READY
design_validation: PASS
source_revision: <input tree hash>
generated_at: <timezone-aware timestamp>
```

The agent may decide that ambiguity is resolved, but it may not manufacture business keys, load
coverage, reconciliation tolerances, filter truth conditions, mappings, reject/default outcomes,
or conflicting-source authority. Those gaps still require a user answer.

## 7. Persistent Workflow State and Recovery

Each requirement folder carries `workflow-state.yaml`. It is a cache and audit aid, not the source
of truth:

```yaml
schema_version: 1
workflow_id: REQ_001_EXAMPLE
mcp_version: 1.0.0
input_hash: "<sha256>"
requirement_revision: 2
design_revision: 3
generation_revision: 4
current_stage: MODIFYING
last_completed_stage: RUNTIME_VALIDATION
last_session_at: "<timezone-aware timestamp>"
artifacts:
  requirement: requirement.md
  design: design/manifest.yaml
  pentaho_project: "<configured relative project path>"
validation:
  static: PASS
  pdi_load: PASS
  execution: NOT_RUN
```

On every start, the orchestrator inventories and reads:

1. all supported files in `input/`;
2. `requirement.md`;
3. `design/`, including manifest, component YAML, and generated diagrams;
4. referenced `.kjb/.ktr` artifacts;
5. `changelog.md`;
6. `workflow-state.yaml` when present;
7. relevant Git status, diff, and history without mutating Git.

It recomputes hashes and validates artifacts before choosing a stage. If the state file is absent,
stale, or inconsistent, the artifacts win and the state is reconstructed.

Recovery decisions are deterministic where possible:

- incomplete requirement: resume requirement work;
- ready requirement with missing design: start design;
- invalid or incomplete design: repair design and revalidate;
- ready design with partial generation: generate only missing or stale artifacts;
- changed BA input: mark downstream artifacts stale, run impact analysis, and propagate changes;
- manual runtime edits: preserve them, compare against design, and enter modification mode;
- completed unchanged project: report the existing result without regenerating it;
- irreconcilable concurrent or divergent edits: ask whether to preserve, merge, or replace.

No existing artifact is blindly overwritten.

## 8. Documentation and Source-of-Truth Policy

Documentation remains a required deliverable:

```text
Business meaning       -> requirement.md
Technical intent       -> design.md and design YAML
Runtime implementation -> .kjb/.ktr
Change history         -> changelog.md
Resume cache           -> workflow-state.yaml
```

`requirement.md` and design artifacts are never replaced with internal database state. Design
YAML remains the machine-readable generation contract, while `design.md` and diagrams remain the
human-readable review surface.

After a developer edits `.kjb/.ktr`, the MCP performs delta synchronization:

1. read only affected entry/step/hop configurations and their dependency closure;
2. compare runtime XML with design YAML;
3. classify the difference as business, technical, visual-only, or environment-only;
4. patch affected YAML nodes and human-readable design sections;
5. regenerate only affected diagrams;
6. append one `CHG-NNN` record;
7. update `requirement.md` only when the business contract changed.

XML does not automatically override requirement or design intent. An unexplained semantic conflict
must be presented to the user.

## 9. High-Level MCP Surface

Keep the existing low-level tools and add a lifecycle surface. Exact schemas will be finalized in
the implementation plan, but the responsibilities are:

- `pentaho_project_inspect`: locate configuration, requirement folder, artifacts, and recoverable
  workflow state without writing;
- `pentaho_workflow_start`: validate scope and establish or resume the workflow;
- `pentaho_workflow_status`: return stage, stale artifacts, blockers, and eligible next actions;
- `pentaho_requirement_write`: atomically write a validated requirement revision;
- `pentaho_design_write`: atomically write a coherent design package and render diagrams;
- `pentaho_generate`: translate ready design YAML into runtime artifacts using catalog templates;
- `pentaho_sync_changes`: reconcile manual runtime changes into design and changelog;
- `pentaho_validate_project`: run static, catalog, design/runtime reconciliation, and optional PDI
  validation;
- `pentaho_finalize`: return the artifact inventory, diffs, validation evidence, and remaining
  operational actions.

Long operations return structured progress and resumable state. Every mutating tool returns the
files changed and a diff summary. Low-level Kettle edit tools remain available for surgical work,
but their descriptions route full lifecycle work through the orchestrator.

## 10. Pentaho Runtime Adapter

Pentaho is optional. Runtime configuration accepts a PDI home directory, not an arbitrary command
path. The adapter resolves only known executables beneath that root:

```text
Kitchen.bat -> .kjb
Pan.bat     -> .ktr
```

Add capabilities for runtime detection/version reporting, load/parameter checks, controlled
execution, and sanitized logs. Static validation always runs first.

Execution policy:

- `DEV` or `TEST`: execution may proceed automatically after static and load checks pass;
- any other named environment: explicit confirmation is required;
- missing or unrecognized environment: treat as production and require confirmation;
- command paths, working directories, parameters, and environment variables are allowlisted;
- secrets and sensitive values are redacted from tool output and persisted logs;
- timeout, cancellation, exit code, and log locations are always reported.

Absence of PDI is not a static validation failure. The report distinguishes `STATIC_PASS`,
`PDI_LOAD_PASS`, `EXECUTION_PASS`, and `NOT_RUN` rather than implying runtime verification.

## 11. Knowledge Lifecycle

Development and deployment profiles have different permissions.

During MCP development, a failure may enter the learning loop:

```text
failure -> root cause -> lesson candidate -> regression test
        -> knowledge/template/code update -> new versioned release
```

The production executable contains only the resulting read-only snapshot. It cannot promote
catalog entries or modify shared lessons. Unknown types yield `CATALOG_GAP` with a diagnostic
bundle suitable for the MCP maintainers. Support arrives through a later release rather than an
end-user mutation.

## 12. Git Policy

Git is read-only unless the user explicitly requests a mutation. The normal workflow may inspect
status, diffs, file history, and commits to recover context and distinguish generated changes from
manual edits. It must not stage, commit, push, create branches, reset, or discard changes.

If the user later requests a commit, only files belonging to the current workflow are eligible;
unrelated dirty-worktree changes remain untouched.

## 13. Error Handling and Concurrency

All writes are atomic and remain inside configured roots. A per-requirement lock prevents two Kiro
sessions from mutating the same workflow concurrently. A lock carries process/session identity and
heartbeat time; a stale lock may be recovered only after validating the artifacts again.

Failures are classified as:

- `INPUT_GAP`: missing or conflicting business information;
- `CONFIG_ERROR`: missing/invalid `.pentaho-mcp.yaml` or unsafe path;
- `CATALOG_GAP`: unsupported Pentaho component type;
- `DESIGN_ERROR`: invalid or incomplete design contract;
- `GENERATION_ERROR`: translation or atomic-write failure;
- `STATIC_VALIDATION_ERROR`: XML, graph, reference, secret, or reconciliation failure;
- `RUNTIME_UNAVAILABLE`: optional PDI runtime absent or invalid;
- `RUNTIME_FAILURE`: Kitchen/Pan load or execution failure;
- `CONCURRENT_CHANGE`: artifact changed after it was read;
- `USER_DECISION_REQUIRED`: safe merge/replace choice cannot be made automatically.

Partial output is retained for diagnosis and marked incomplete. It is never reported as complete.

## 14. Security

- Enforce configured workspace read/write roots on every file operation.
- Treat BA input and repository content as untrusted data, not executable instructions.
- Never execute SQL, shell fragments, or paths extracted from documents.
- Resolve Kitchen/Pan only below the configured PDI root.
- Use argument arrays rather than command-string concatenation.
- Redact credentials, tokens, database hosts, email addresses when required by policy, and known
  sensitive parameters from logs.
- Do not place real secrets in generated `shared.xml`, `kettle.properties`, docs, state, or logs.
- Do not ship development knowledge-promotion tools.
- Record MCP version, validation mode, runtime version, changed paths, and sanitized outcomes.

## 15. Validation and Testing

Preserve the current Kettle MCP test suite and add:

- configuration parsing, path-boundary, and unsupported-input tests;
- workflow state reconstruction and stale-state tests;
- interrupted-stage resume tests for every phase;
- input-change invalidation and dependency propagation tests;
- manual XML edit delta-synchronization tests;
- no-blind-overwrite and concurrent-change tests;
- requirement/design/generation end-to-end fixtures;
- Kiro MCP prompt/resource/tool listing smoke tests;
- PDI adapter tests with a fake Kitchen/Pan process;
- environment execution-policy tests;
- secret-redaction and command-injection tests;
- packaged executable tests on a clean Windows environment without Node/Python;
- install, doctor, upgrade, and uninstall tests;
- production-profile tests proving learning/catalog mutation tools are absent.

Completion requires a release ZIP that passes checksum verification, installs into Kiro, resumes an
interrupted sample workflow, produces required docs and Pentaho artifacts, passes static
validation, exercises the configured PDI adapter, and leaves Git unmodified.

## 16. Scope Boundaries

Version one includes Windows, local Kiro stdio installation, Markdown inputs, configurable project
paths, requirement/design/runtime generation and synchronization, static validation, optional
Kitchen/Pan integration, and manual versioned upgrades.

Version one excludes Linux packaging, remote MCP hosting, non-Markdown input parsing, OCR,
automatic Git mutation, autonomous model hosting, production knowledge mutation, deployment to a
scheduler, and unrestricted production execution.


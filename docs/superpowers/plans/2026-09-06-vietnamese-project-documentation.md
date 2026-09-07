# Vietnamese Project Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete, professional Vietnamese documentation set for `pentaho-mcp-server` that accurately reflects the current implementation, tests, packaging, operational safeguards, and extension model.

**Architecture:** Treat executable code and tests as the source of truth. Keep `README.md` concise and navigational, then place detailed material in focused documents under `docs/`; avoid duplicating long reference material across files. Documentation changes must not alter application behavior, public tool schemas, lifecycle rules, or release contents beyond the corrected documentation and example configuration.

**Tech Stack:** Markdown, Mermaid, YAML, Node.js 20+, MCP SDK, Pentaho Data Integration (Kitchen/Pan optional), PowerShell packaging scripts.

**Spec:** `docs/superpowers/specs/2026-09-04-packaged-pentaho-lifecycle-mcp-design.md` and `docs/superpowers/specs/2026-09-03-etl-coverage-and-policy-alignment-design.md`

## Global Constraints

- Write all user-facing documentation in clear professional Vietnamese; preserve official technical names, command names, file names, JSON/YAML keys, status codes, and MCP tool names in English.
- Do not change JavaScript source, tests, package dependencies, public schemas, lifecycle behavior, or packaging behavior.
- Derive facts from `src/`, `test/`, `scripts/`, `packaging/`, and `package.json`; do not treat the current `README.md` or `docs/install.md` as authoritative when they conflict with code.
- The documented production surface is exactly 32 tools: 4 read, 10 edit, 1 validate, 4 knowledge, 9 lifecycle, and 4 runtime tools.
- The documented MCP surface also contains one prompt named `develop-pentaho-job` and five read-only lifecycle resources.
- State clearly that static read/edit/validation/generation do not require PDI, while `kettle_runtime_loadcheck` and `kettle_runtime_execute` require an optional local PDI installation.
- State clearly that the server never deploys and never commits, pushes, or amends Git.
- Document the actual project configuration shape accepted by `src/project/config.js`: `environment` is a mapping with optional `name`, not a scalar.
- All Markdown links must resolve from their containing file, all command examples must be copyable, and no document may contain unresolved placeholders or invented example results.
- Do not commit or push unless the user separately authorizes Git mutation.

---

## Handoff brief for the implementing agent

Work through the tasks below in order. Before editing each document, reread the source files listed for that task. Prefer concise explanations, tables for repetitive tool/config mappings, and Mermaid only where a flow or dependency relationship is materially clearer as a diagram. Preserve any accurate existing content, but rewrite inconsistent or fragmented sections rather than layering corrections on top.

The current documentation has known drift that must be corrected:

1. `README.md` says 31 tools; `src/tools/registry.js` and `scripts/verify-production-profile.mjs` establish 32.
2. The edit group contains 10 tools because `kettle_add_error_hop` is part of the public surface.
3. The package/README language says “no execution,” but the repository now provides optional guarded Kitchen/Pan load-check and execution tools.
4. `docs/install.md` says there are two runtime dependencies; `package.json` has three: `@modelcontextprotocol/sdk`, `fast-xml-parser`, and `yaml`.
5. `packaging/config.example.yaml` represents `environment` as a scalar, while `src/project/config.js` expects `environment.name`.
6. Runtime execution is auto-allowed only for `DEV` and `TEST`; all other values, including `UNKNOWN`, require `confirmed: true`.

Do not broaden the task into API redesign, code cleanup, new examples that require implementation, or knowledge-catalog expansion.

---

### Task 1: Establish the documentation fact sheet

**Files:**

- Read: `package.json`
- Read: `src/server.js`
- Read: `src/tools/registry.js`
- Read: `src/tools/*.tools.js`
- Read: `src/project/config.js`
- Read: `src/project/paths.js`
- Read: `src/lifecycle/*.js`
- Read: `src/lifecycle/*.md`
- Read: `src/workflow/*.js`
- Read: `src/generation/*.js`
- Read: `src/sync/*.js`
- Read: `src/runtime/*.js`
- Read: `scripts/build-release.mjs`
- Read: `scripts/verify-production-profile.mjs`
- Read: `packaging/*.ps1`
- Read: `test/*.test.js`
- Create: `docs/documentation-facts.md`

**Interfaces:**

- Consumes: Public behavior encoded by source and verified by tests.
- Produces: A reviewer-facing traceability ledger used while writing the remaining documents; it is not shipped as API reference and must not speculate beyond evidence.

- [ ] **Step 1: Capture the public surface mechanically**

Run:

```powershell
node --input-type=module -e "import { buildTools } from './src/tools/registry.js'; const tools=buildTools({root:process.cwd(),resolve:p=>p}); console.log(JSON.stringify(tools.map(({name,description,inputSchema})=>({name,description,inputSchema})),null,2));"
```

Expected: a JSON array of 32 tools, including `kettle_add_error_hop`.

- [ ] **Step 2: Record verified facts and their source locations**

Create `docs/documentation-facts.md` with these sections: Product identity, supported artifact types, runtime requirements, MCP surface counts, configuration schema, path/write boundaries, lifecycle stages, validation scope, runtime safety policy, release inventory, knowledge catalog policy, and non-goals. Each row must contain “Fact”, “Authoritative source”, and “Documentation destinations”.

- [ ] **Step 3: Record the known documentation conflicts**

Add a “Conflicts to resolve” table containing the six discrepancies listed in the handoff brief. Mark a conflict resolved only after the destination document has been updated in a later task.

- [ ] **Step 4: Verify the baseline production profile**

Run:

```powershell
npm run verify:profile
```

Expected: `production profile OK: 32 tools, 5 resources, 1 prompt(s), no learning/promotion surface`.

---

### Task 2: Rewrite the project README as the documentation entry point

**Files:**

- Modify: `README.md`
- Read: `docs/documentation-facts.md`
- Read: `package.json`
- Read: `src/server.js`
- Read: `packaging/install.ps1`

**Interfaces:**

- Consumes: Verified product facts from Task 1.
- Produces: A concise landing page that links to every detailed guide created by later tasks.

- [ ] **Step 1: Replace the opening with an accurate product description**

Explain that the project is an MCP stdio server for `.kjb` and `.ktr` files, providing loss-minimizing XML inspection/editing, embedded Pentaho knowledge, lifecycle-driven generation, static validation, and optional guarded local PDI execution. State that PDI is not required for the core feature set.

- [ ] **Step 2: Add a capability and non-goal overview**

Cover the six tool groups and their exact counts, the prompt/resources, no deployment, immutable production knowledge, no automatic Git mutation, and the distinction between structural/runtime validation and business/data correctness.

- [ ] **Step 3: Add a minimal quick start for both supported distributions**

Document source execution with Node.js 20+ and the self-contained Windows release. Include installation, `KETTLE_ROOT`, server registration, `npm test`, `npm run verify:profile`, and links to the detailed installation/configuration guides.

- [ ] **Step 4: Add architecture and workflow summaries**

Include one compact Mermaid flow showing MCP client → stdio server → tool registry → core/knowledge/lifecycle/runtime modules → workspace/PDI. Include a second compact lifecycle flow only if it remains legible at README width; otherwise link to `docs/workflow-guide.md`.

- [ ] **Step 5: Add a documentation index**

Link to `docs/architecture.md`, `docs/configuration.md`, `docs/tools-reference.md`, `docs/workflow-guide.md`, `docs/development.md`, `docs/operations.md`, and `docs/install.md`, with one-line audience descriptions.

- [ ] **Step 6: Remove stale claims and duplicated long reference sections**

Remove the 31-tool count, blanket “no execution” statements, duplicate install procedures, and long per-tool explanations that belong in focused guides. Keep the README useful within roughly 250–400 lines.

---

### Task 3: Document architecture and configuration

**Files:**

- Create: `docs/architecture.md`
- Create: `docs/configuration.md`
- Modify: `packaging/config.example.yaml`
- Read: `src/core/*.js`
- Read: `src/knowledge/*.js`
- Read: `src/project/*.js`
- Read: `src/workflow/*.js`
- Read: `src/lifecycle/*.js`
- Read: `src/generation/*.js`
- Read: `src/sync/*.js`
- Read: `src/runtime/*.js`

**Interfaces:**

- Consumes: Module boundaries and configuration validation rules from source.
- Produces: Stable conceptual and configuration references used by operators, maintainers, and tool users.

- [ ] **Step 1: Write the architecture document**

Structure `docs/architecture.md` as: System context, design principles, module map, MCP request/response flow, XML model and span-based editing, knowledge catalog loading and eligibility, lifecycle state recovery, design validation and deterministic generation, runtime/design reconciliation, optional PDI runtime, error/result conventions, security boundaries, and deliberate non-goals.

- [ ] **Step 2: Add architecture diagrams**

Add a Mermaid component diagram for module dependencies and a sequence diagram for one tool call. Add a lifecycle state diagram covering requirement, design, generation, modification/synchronization, validation, and finalization. Diagrams must match `src/server.js`, `src/tools/registry.js`, and `src/workflow/inspect.js`.

- [ ] **Step 3: Write the configuration reference**

Structure `docs/configuration.md` as: Configuration precedence, environment variables, `.pentaho-mcp.yaml` schema, annotated complete example, path resolution rules, read/write boundaries, environment execution policy, optional PDI discovery, source-mode registration, packaged executable registration, and validation failures.

- [ ] **Step 4: Correct the packaged configuration example**

Change the environment example to:

```yaml
environment:
  name: UNKNOWN
```

Keep the existing explanations for `DEV`, `TEST`, and confirmation-required environments, and ensure the remaining keys match `src/project/config.js` exactly.

- [ ] **Step 5: Verify the example against the real parser**

Copy the example to a temporary workspace containing the configured relative directories, call `loadProjectConfig()` against that workspace, and confirm `environment === 'UNKNOWN'`. Do not add the temporary workspace to Git.

---

### Task 4: Write the complete MCP tool reference

**Files:**

- Create: `docs/tools-reference.md`
- Read: `src/tools/read.tools.js`
- Read: `src/tools/edit.tools.js`
- Read: `src/tools/validate.tools.js`
- Read: `src/tools/knowledge.tools.js`
- Read: `src/tools/lifecycle.tools.js`
- Read: `src/tools/runtime.tools.js`
- Read: `src/server.js`
- Read: Relevant tests under `test/`

**Interfaces:**

- Consumes: The exact names, descriptions, schemas, defaults, handlers, and tested behavior of all 32 tools.
- Produces: The authoritative human-readable tool catalog.

- [ ] **Step 1: Define the common MCP conventions**

Explain relative path resolution, `KETTLE_ROOT`, the stdio transport, and the response envelope `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`. Explain that edit tools return a unified diff and validate before committing changed bytes where applicable.

- [ ] **Step 2: Document the read group**

Document `kettle_list`, `kettle_summary`, `kettle_get_element`, and `kettle_search`. For each tool include purpose, required and optional parameters, defaults/enums, output shape at a useful level, side effects, failure conditions, and one valid JSON argument example.

- [ ] **Step 3: Document the edit group**

Document all 10 edit tools: `kettle_create_file`, `kettle_add_element`, `kettle_set_sql`, `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields`, `kettle_edit_hops`, `kettle_add_error_hop`, `kettle_rename_element`, and `kettle_clone`. Highlight atomic edits, write boundaries, overwrite refusal, catalog eligibility, `allowObserved`, CRLF preservation, hop semantics, and error-hop behavior.

- [ ] **Step 4: Document validation and knowledge groups**

Document `kettle_validate` plus the four `kettle_knowledge_*` tools. Distinguish structural errors from catalog warnings/info, canonical from observed types, generator eligibility, read-only XML analysis, and the absence of any runtime knowledge-promotion API.

- [ ] **Step 5: Document lifecycle and runtime groups**

Document the nine `pentaho_*` lifecycle tools and four `kettle_runtime_*` tools. Explain compare-and-swap `expectedHashes`, resume/status recovery, required folder naming, optional PDI, static validation before execution, timeouts, confirmation policy, sanitized logs, and no deployment.

- [ ] **Step 6: Add selection guides**

Add two tables: “Choose the right tool” for common tasks, and “Read-only vs writes workspace vs executes process”. Ensure every public tool appears exactly once in the detailed reference and at least once in the group index.

- [ ] **Step 7: Mechanically verify coverage**

Run a Node script that reads the names from `buildTools()` and fails if any name is absent from `docs/tools-reference.md`. Also fail if the document claims any tool name not present in the registry.

---

### Task 5: Document the end-to-end lifecycle workflow

**Files:**

- Create: `docs/workflow-guide.md`
- Read: `src/lifecycle/developing-pentaho-jobs.md`
- Read: `src/lifecycle/writing-etl-requirements.md`
- Read: `src/lifecycle/designing-pentaho-solutions.md`
- Read: `src/lifecycle/generating-pentaho-from-design.md`
- Read: `src/lifecycle/modifying-pentaho-jobs.md`
- Read: `src/lifecycle/requirement-validator.js`
- Read: `src/lifecycle/design-validator.js`
- Read: `src/workflow/inspect.js`
- Read: `src/workflow/state.js`
- Read: `src/sync/*.js`
- Read: `test/lifecycle-*.test.js`

**Interfaces:**

- Consumes: Packaged immutable lifecycle guidance and the validators/state machine implementing it.
- Produces: An operator and agent playbook for starting, resuming, completing, and reconciling a requirement workflow.

- [ ] **Step 1: Describe prerequisites and workspace layout**

Document `.pentaho-mcp.yaml`, the `REQ_<ID>_<UPPER_SNAKE>` naming rule, BA-owned read-only `input/`, `requirement.md`, `design/`, generated runtime directory, `changelog.md`, state/lock artifacts, and sanitized runtime logs.

- [ ] **Step 2: Describe each lifecycle stage and gate**

For requirement, design, generation, modification/sync, validation, and finalization, state the inputs, produced artifacts, validator, blocking conditions, and next action. Explicitly state that the workflow self-assesses technical readiness and does not add human approval fields between documentation phases.

- [ ] **Step 3: Document traceability and design contracts**

Explain `SRC-*`, `R-*`, `AC-*`, append-only IDs, requirement front matter, mandatory requirement sections, `manifest.yaml`, component YAML, stable component IDs, requirement references, Mermaid freshness, catalog gaps, placeholders, and secret checks.

- [ ] **Step 4: Document resume, locking, and compare-and-swap behavior**

Explain reconstruction from current bytes, advisory saved state, hash invalidation, earliest stale stage, workflow locks, stale-lock recovery, and `expectedHashes` conflict prevention.

- [ ] **Step 5: Document manual KJB/KTR changes**

Explain visual-only drift, safe technical deltas, business-semantic deltas requiring a decision, design/changelog synchronization, and when work returns to requirement or design.

- [ ] **Step 6: Add an end-to-end worked example**

Use the neutral example folder `REQ_001_CUSTOMER_EXPORT` and fictional paths/IDs only. Show the sequence of tool calls and expected status transitions without inventing Pentaho output payloads or business rules.

---

### Task 6: Document development, installation, and operations

**Files:**

- Create: `docs/development.md`
- Create: `docs/operations.md`
- Modify: `docs/install.md`
- Read: `package.json`
- Read: `scripts/*.mjs`
- Read: `packaging/*.ps1`
- Read: `packaging/sea-config.json`
- Read: `test/packaging.test.js`
- Read: `test/smoke.test.js`
- Read: `src/knowledge/pentaho/README.md`

**Interfaces:**

- Consumes: Actual setup, test, extension, release, installation, and diagnostic behavior.
- Produces: Maintainer and operator runbooks with no contradiction between source-mode and packaged-mode deployment.

- [ ] **Step 1: Write the development guide**

Cover prerequisites, repository setup, npm scripts, test organization, focused test commands, adding a new tool factory, adding or correcting a knowledge type, catalog statuses and eligibility, production-profile restrictions, release build internals, release inventory, and contribution checklist.

- [ ] **Step 2: Write the operations guide**

Cover deployment models, installation verification, upgrade/rollback, `doctor.ps1`, MCP handshake checks, logs and redaction, timeout behavior, execution confirmation, filesystem boundaries, backup behavior, uninstallation scope, SmartScreen/AV issues, config failures, missing PDI, and incident triage.

- [ ] **Step 3: Rewrite the installation guide around current supported modes**

Lead with the self-contained Windows executable for end users, then document source mode for developers. Correct the dependency count to three and list exact package names. Keep restricted-network options accurate; do not recommend `NODE_PATH` as an ESM dependency-resolution solution unless it is verified by an automated reproduction.

- [ ] **Step 4: Cross-link operational documents**

Make `docs/install.md` the focused installation procedure, `docs/configuration.md` the schema reference, `docs/operations.md` the runbook, and `docs/development.md` the maintainer guide. Remove repeated blocks where a link is clearer.

- [ ] **Step 5: Verify the documented release inventory**

Confirm the guide lists exactly these seven ZIP entries: `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, `doctor.ps1`, `config.example.yaml`, `README.md`, and `VERSION`; document `checksums.sha256` as an adjacent output, not an eighth ZIP entry.

---

### Task 7: Perform documentation quality assurance

**Files:**

- Modify as needed: `README.md`
- Modify as needed: `docs/*.md`
- Modify as needed: `packaging/config.example.yaml`
- Read: All source/test files needed to resolve discrepancies

**Interfaces:**

- Consumes: All documentation produced in Tasks 1–6.
- Produces: A consistent, verified documentation set and a concise handoff report.

- [ ] **Step 1: Check internal Markdown links**

Run or write a temporary read-only checker that validates every relative link in `README.md` and `docs/**/*.md`. Expected: zero missing local targets.

- [ ] **Step 2: Check terminology and counts**

Search for stale phrases and contradictory counts. Confirm all files consistently say 32 tools, 10 edit tools, 5 resources, 1 prompt, Node.js 20+, three runtime dependencies, optional PDI execution, and `environment.name`.

- [ ] **Step 3: Scan for unfinished content**

Search the delivered user-facing documents for placeholder markers, empty headings, broken code fences, unexplained acronyms on first use, and fictional secrets/credentials. Resolve every finding.

- [ ] **Step 4: Run the full automated verification**

Run:

```powershell
npm test
npm run verify:profile
```

Expected: the complete Node test suite passes and the production profile reports 32 tools, 5 resources, 1 prompt, and no learning/promotion surface.

- [ ] **Step 5: Review the final diff for scope**

Run:

```powershell
git diff --check
git diff -- README.md docs packaging/config.example.yaml
git status --short
```

Expected: only documentation files and `packaging/config.example.yaml` are changed; no JavaScript, tests, dependencies, build artifacts, generated release files, or BA input files are modified.

- [ ] **Step 6: Deliver the implementation report**

Report the documents created/updated, the five key stale-documentation corrections, verification commands and outcomes, and any remaining limitation supported by source evidence. Do not claim a release build was tested unless `npm run build:release -- --version <valid-semver>` was actually run on Windows and its ZIP/checksum were inspected.


# Developing Pentaho Jobs

This resource orchestrates the complete workflow. It is packaged, immutable production guidance.

## Start by recovering context

1. Load `.pentaho-mcp.yaml`; configured roots are authoritative and project-specific.
2. Inspect the current workspace: the named existing `REQ_<ID>_<UPPER_SNAKE>` folder and its `input/`, `requirement.md`, `design/`, `changelog.md`, workflow state, and declared Pentaho project.
3. Hash current bytes and compare them with saved state. Resume, append, or patch the earliest stale stage. Never blindly replace an existing artifact; ask only when divergent changes are irreconcilable.
4. Accept only Markdown evidence under `input/`. The whole `input/` tree is read-only: never create, edit, move, rename, or delete anything there.

## Lifecycle

Run requirement analysis, solution design, Pentaho generation or modification, static validation, and documentation synchronization in one session when each validator passes. There is no approval gate between documentation phases. Self-assess readiness from evidence and validation results.

Required outputs are `requirement.md`, `design/design.md`, design YAML, KJB/KTR runtime artifacts, and `changelog.md`. Keep stable append-only IDs and traceability. If a developer manually changes KJB/KTR, inspect the delta and synchronize the design, documentation, changelog, and state; update the requirement only if the business contract changed.

Never invent business facts such as keys, load coverage, formulas, filters, tolerances, retry policy, SLA, retention, or security rules. Ask concise questions only for missing or conflicting decisions that affect correctness. Resolve repository-discoverable and ordinary technical facts yourself.

Use the embedded Kettle catalog for entry and step types. Unknown types are blockers unless the user supplies verified XML evidence. Production knowledge is read-only.

PDI execution is optional. Static validation always runs. Kitchen/Pan may run automatically only when the configured environment is DEV or TEST; otherwise obtain explicit execution confirmation. Never deploy. Never commit or push unless the user explicitly requests Git mutation.

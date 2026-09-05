# ETL Coverage And Policy Alignment Design

**Date:** 2026-09-03
**Status:** Revised and approved in chat, pending written-spec review
**Scope:** `kettle-mcp-dte` and the Pentaho lifecycle skills under `dte-ai-context/skills`

## Objective

Expand the MCP knowledge coverage using real Kettle artifacts already present in the workspace,
make scaffolding honor catalog eligibility, and align every lifecycle skill to one catalog and one
unknown/observed-type policy. The change must preserve the MCP's thin, non-executing design and
must not claim PDI 11 compatibility for XML observed only in legacy projects. When a requirement
needs a component absent from the catalog, the workflow must collect and validate user-supplied XML
so the gap can be resolved without weakening the requirement or inventing a component.

## Current Problems

1. The active knowledge base lives at
   `kettle-mcp-dte/src/knowledge/pentaho`, while generation, modification, and learning skills
   still reference the removed `dte-ai-context/knowledge/pentaho` path.
2. `entry-type-catalog.md` duplicates a subset of `catalog.yaml` and is already stale.
3. The design skill forbids unknown types, while generation and modification guidance permits
   best-effort generation of unknown types.
4. `kettle_add_element` reads any documented template without enforcing
   `generator_eligible`; observed types are inserted without the required review marker.
5. Workspace inventory contains valid, recurring types that are absent from the catalog. The
   largest gap is `BlockUntilStepsFinish`.
6. MCP draft documentation names tools from a different server implementation and can direct an
   agent to call tools that `kettle-mcp-dte` does not expose.
7. The test baseline currently has two failures, so feature work does not start from a clean gate.

## Source Of Truth

`kettle-mcp-dte/src/knowledge/pentaho/catalog.yaml` is the only authoritative component catalog.
The MCP knowledge tools and `dte-ai-context/validation/validate_types.py` continue to read it.

Lifecycle skills must reference the embedded knowledge tree directly or use
`kettle_knowledge_list` and `kettle_knowledge_get`. `entry-type-catalog.md` remains a compact guide
for cross-type conventions such as boolean encoding, path policy, and SQL escaping, but it must
not contain a separately maintained type inventory.

The obsolete MCP draft and `mcp-generation.md` must be clearly labeled as legacy documentation and
must not be part of the active generation reading path. Active guidance may name only tools
actually exposed by `kettle-mcp-dte`.

## Type Safety Policy

The following policy applies consistently to design, generation, modification, and MCP edits:

| Catalog state | Design | Generation / modification | `kettle_add_element` |
|---|---|---|---|
| Canonical and eligible | Allowed | Generate normally | Allowed by default |
| Observed and ineligible | Allowed only with a known-gap technical decision | Generate with explicit review marker | Allowed only with `allowObserved: true`; add marker |
| Unknown | Mark `CATALOG_GAP`; collect evidence before completing the design | Stop and start catalog-gap intake | Reject without changing the file |

The marker format is deterministic and type-specific:

```xml
<!-- MANUAL_REVIEW: [TYPE] is observed-only; verify in Spoon before production -->
```

`kettle_add_element` adds the marker immediately before the inserted `<entry>` or `<step>`. The
tool result also returns catalog status and whether manual review is required. Refusal for an
observed type is non-destructive and explains how to opt in.

## Unknown Type Intake

A required component missing from the catalog is a catalog capability gap, not a business
requirement defect. The affected design remains blocked only until the knowledge gap is reviewed.
The requirement is never weakened or rewritten to fit existing catalog coverage.

The agent asks the user for evidence in this order:

1. A working `.ktr` or `.kjb` containing the component, preferably one successfully executed.
2. If a complete artifact cannot be shared, one complete `<step>...</step>` or
   `<entry>...</entry>` block.
3. The source PDI version, plugin name and version when applicable, and verification level:
   `unverified`, `spoon_loaded`, or `runtime_passed`.

Add a read-only MCP tool named `kettle_knowledge_analyze_xml` with this input contract:

```json
{
  "kind": "trans",
  "xml": "<step>...</step>",
  "elementName": "optional when a complete artifact has multiple candidates",
  "sourceArtifact": "optional repository-relative provenance",
  "pdiVersion": "optional exact version",
  "plugin": "optional plugin name and version",
  "verification": "unverified"
}
```

`kind` accepts `job` or `trans`. `verification` accepts `unverified`, `spoon_loaded`, or
`runtime_passed` and defaults to `unverified`.

The analyzer:

- accepts either a complete artifact or a single component block and extracts exactly one target
  entry/step. For a complete artifact, it automatically selects the target only when exactly one
  unknown type exists; otherwise it returns the candidate names and requires `elementName`;
- verifies well-formed XML, expected root, non-empty `name` and `type`, and reports whether the
  type already exists in the catalog for that kind;
- reports unresolved step references and connection references as review findings;
- detects candidate secrets, credentials, host/IP values, URLs, and absolute machine paths and
  requires those values to be replaced by variables before the XML can become a shared template;
- returns the XML type, suggested catalog alias, normalized candidate template, provenance,
  verification metadata, findings, and missing information;
- never writes a reference file, edits `catalog.yaml`, or marks a type canonical.

The candidate is presented to the user for confirmation. After confirmation, the agent creates the
five-section reference and catalog row as `status: observed` and `generator_eligible: false`, then
reruns the catalog and design validators. The design records the type as a known-gap technical
decision and may proceed through the explicit observed-type generation path.

Canonical promotion is a separate reviewed change. It requires evidence that the template loaded
or ran successfully on the catalog's target PDI version; `runtime_passed` on a different PDI
version remains observed. User-provided XML is evidence of structure and observed behavior, not
permission to copy embedded secrets or project-specific values into shared knowledge.

## Catalog Expansion

New catalog entries are extracted from real `.kjb` and `.ktr` files. Each reference contains the
existing five sections: XML template, config fields, YAML-to-XML mapping, provenance, and gotchas.
Every new entry starts as `status: observed` and `generator_eligible: false` unless there is
explicit evidence of a successful PDI 11 Spoon load or runtime validation.

### First Coverage Cohort

These types have the highest current workspace value and use standard Kettle behavior:

- Transformation: `BlockUntilStepsFinish`, `CsvInput`, `PropertyInput`, `StringCut`,
  `RandomValue`, `ProcessFiles`, `DataGrid`, `JobExecutor`, `XMLOutput`.
- Job: `EVAL_FILES_METRICS`, `CHECK_DB_CONNECTIONS`, `FILES_EXIST`, `DELETE_FOLDERS`,
  `DELETE_FILES`, `DELAY`, `XSLT`.

### Compatibility-Sensitive Cohort

These types are documented only when a complete real XML block is available, but remain observed
and carry explicit plugin/version provenance:

- `OraBulkLoader`
- `SetSessionVariableStep`
- `TypeExitExcelWriterStep`
- `Sequence`
- `EXPORT_REPOSITORY`

Reference provenance records the source artifact path and the known source PDI version when it can
be established. An unknown source version is recorded as `not established`, not inferred. No
legacy or plugin-specific type is promoted to canonical during this change.

## Knowledge Coverage Tool

Add a second read-only MCP tool named `kettle_knowledge_coverage` to the knowledge tool factory.

Input:

```json
{
  "directory": "optional path under KETTLE_ROOT",
  "includeExamples": true
}
```

Behavior:

- Scan `.kjb` and `.ktr` files under the selected root using the existing model parser.
- Count actual job entries and transformation steps, never nested `<type>` fields.
- Group by kind, XML type, catalog status, and generator eligibility.
- Return totals for canonical, observed, and missing types plus usage counts.
- Return one example file for each type when `includeExamples` is not `false`.
- Report unreadable or malformed files as scan issues without aborting the whole scan.
- Enforce the same root/path boundary used by existing read/search tools.

The tool does not mutate the catalog and does not automatically generate knowledge files.

## Validator Scope

This change retains deterministic structural validation and adds no heuristic rule that can
misclassify valid ETL logic. In particular:

- Do not require a physical `SortRows` before `MergeJoin`; a database input may already guarantee
  ordering through SQL.
- Do not add a duplicate "TableOutput has no upstream" rule; existing graph reachability already
  identifies disconnected elements.
- Keep runtime execution and `kettle_loadcheck` out of this phase. The MCP remains non-executing.

Catalog validation continues to emit warnings for unknown types and information for observed
types when inspecting existing artifacts. The stricter unknown-type rejection applies only to new
generation/scaffolding paths, not read-only validation of legacy files.

## Skill Alignment

Update the active lifecycle skills as follows:

- `designing-pentaho-solutions`: retain the current catalog and known-gap gate; classify a required
  absent type as `CATALOG_GAP`, request XML and runtime provenance from the user, and resume only
  after the type is added as observed.
- `generating-pentaho-from-design`: use the embedded catalog; stop on unknown types; require the
  design's known-gap decision before generating observed types; preserve the review marker.
- `modifying-pentaho-jobs`: use the embedded catalog; unknown types may be preserved when already
  present, but adding a new unknown type is blocked until the catalog is extended.
- `learning-from-mistakes`: write lessons and knowledge updates to the embedded knowledge tree.
- `writing-etl-requirements`: no behavioral change; it remains isolated from implementation types.

The phase router continues to prohibit mixing requirement, design, generation, and maintenance
workflows. Updating shared knowledge or MCP implementation is repository maintenance and does not
create or modify a BA requirement/design/runtime project artifact, so no project changelog entry is
required for this work.

## Test Baseline And Verification

First resolve the two existing test failures without weakening their intent:

1. Make the missing-child insertion test assert the file's actual dominant line ending and correct
   sibling indentation.
2. Make the broken-clone fixture replacement independent of a hard-coded newline sequence, so it
   reliably creates an undefined connection under CRLF and LF.

Then add tests for:

- canonical type insertion succeeds without a marker;
- observed type insertion is refused by default and does not change bytes;
- observed type insertion with `allowObserved: true` succeeds with one marker;
- unknown type insertion remains non-destructive;
- XML intake accepts a valid single block and a valid complete artifact;
- XML intake rejects multiple candidate components and a root/kind mismatch;
- XML intake reports credentials, endpoints, and absolute paths before proposing a template;
- XML intake never mutates the catalog or knowledge directory;
- coverage counts only top-level entry/step types;
- coverage reports canonical, observed, and missing groups correctly;
- malformed files become scan issues rather than aborting the scan;
- every catalog row resolves to an existing reference file with a valid single-root XML template;
- active skill documentation contains no removed knowledge path or active references to obsolete
  MCP tool names.

The completion gate is a clean `npm test` run plus the relevant deterministic Python validation
tests already present in `dte-ai-context`. PDI/Spoon runtime verification is explicitly outside
this phase, so all newly added component types remain observed.

## Documentation

Update the MCP README to list the actual tool count and include `kettle_knowledge_analyze_xml` and
`kettle_knowledge_coverage`. Document `allowObserved`, the catalog-gap intake, the review marker,
the single source of truth, and the distinction between read-only legacy validation and strict
scaffolding.

## Non-Goals

- Running Pan, Kitchen, Spoon, or Carte.
- Promoting newly observed types to canonical.
- Adding speculative DWH/cloud types without real XML evidence.
- Implementing data correctness, SQL semantics, reconciliation, or schema lineage validation.
- Restoring the removed duplicate knowledge tree under `dte-ai-context`.
- Automatically writing user-supplied XML into shared knowledge without confirmation.
- Modifying production `.kjb`/`.ktr`, requirement packages, design packages, or project changelogs.

## Rollout Order

1. Repair the existing two-test baseline.
2. Enforce catalog eligibility in `kettle_add_element`.
3. Add and test `kettle_knowledge_analyze_xml` and document the catalog-gap workflow.
4. Add and test `kettle_knowledge_coverage`.
5. Add the first coverage cohort, then the compatibility-sensitive cohort where complete source
   XML exists.
6. Align active skills and retire obsolete MCP guidance from the active path.
7. Update documentation and run all verification gates.

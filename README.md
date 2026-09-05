# pentaho-mcp-server

MCP stdio server for Pentaho Kettle `.kjb` / `.ktr` files, with an
**embedded PDI knowledge base**. Read, summarize, search, validate, and make
surgical edits — no PDI install, no execution.

It is a refactor of the "thin" kettle-mcp (span-based editing, zero-loss XML
parsing) restructured into three layers and packaged so the knowledge base
ships *inside* the server. Install the package and the knowledge comes with it.

## Why this design

- **No step-type schema registry.** New steps are cloned from real files, not
  generated from per-type schemas. The server reads, edits, and validates
  *every* step type because it works on the XML text and graph, not on a
  per-type model.
- **The source of truth is real, verified XML** in the knowledge base
  (`src/knowledge/pentaho/`), not hand-written mapper code. Fixing a mistake
  means fixing a markdown/XML reference, not editing and rebuilding TypeScript.
- **Validation targets "will it load / run without error"**, not data
  correctness. It catches the structural faults that make a job fail at load or
  start time.
- **No execution.** Verifying data/logic is a separate, later concern.

## Layout

```text
src/
  index.js            entry point
  server.js           MCP wiring (tool listing + dispatch)
  core/               pure XML/graph engine — knows nothing about types
    model.js  span.js  edit.js  search.js  validate.js  summarize.js
  knowledge/          embedded knowledge base + access layer
    pentaho/          catalog.yaml + job/<TYPE>.md + trans/<TYPE>.md
    loader.js         parse catalog, resolve reference files, env override
    catalog-check.js  validate step/entry <type> against the catalog
  tools/              MCP tool surface (one factory per concern)
    read.tools.js  edit.tools.js  validate.tools.js  knowledge.tools.js
    registry.js       flattens all tool factories
test/                 node:test suite + fixtures
```

**Three change axes, three folders.** `core/` rarely changes. `knowledge/` is
data and changes often (new types). `tools/` changes when you add features.

## Configuration

Registered in `~/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "kettle-dte": {
      "command": "node",
      "args": ["<path>/pentaho-mcp-server/src/index.js"],
      "env": { "KETTLE_ROOT": "<path to the ETL repo, e.g. dte-etl-pentaho>" }
    }
  }
}
```

- `KETTLE_ROOT` — default scope for list/search/validate and the **write
  boundary** for edit tools. Relative tool paths resolve against it. Always set
  it; when unset, the write boundary is off.
- `KETTLE_KNOWLEDGE_DIR` — optional. Overrides the embedded knowledge base so
  several checkouts can share one canonical knowledge tree. When unset, the
  packaged `src/knowledge/pentaho` is used (self-contained default).

## Tools (31)

Read (4): `kettle_list` · `kettle_summary` · `kettle_get_element` · `kettle_search`
Edit (9): `kettle_add_element` · `kettle_create_file` · `kettle_set_sql` ·
`kettle_set_field` · `kettle_set_field_path` · `kettle_set_fields` ·
`kettle_edit_hops` · `kettle_rename_element` · `kettle_clone`
Validate (1): `kettle_validate`
Knowledge (4): `kettle_knowledge_list` · `kettle_knowledge_get` ·
`kettle_knowledge_analyze_xml` · `kettle_knowledge_coverage`
Lifecycle (9): `pentaho_project_inspect` · `pentaho_workflow_start` ·
`pentaho_workflow_status` · `pentaho_requirement_write` · `pentaho_design_write` ·
`pentaho_generate` · `pentaho_sync_changes` · `pentaho_validate_project` ·
`pentaho_finalize`
Runtime (4, optional PDI): `kettle_runtime_detect` · `kettle_runtime_loadcheck` ·
`kettle_runtime_execute` · `kettle_runtime_logs`

The server also advertises one MCP **prompt** (`develop-pentaho-job`) and
read-only lifecycle **resources** (`dte-pentaho://skills/...`) that guide a
Kiro agent through the resumable requirement → design → generate → validate
workflow. There is no learning or catalog-promotion surface at runtime.

Every result is `text` content containing `{ok, data|error}` JSON. Edit tools
return a unified diff of exactly what changed.

### Catalog policy for scaffolding

Reading, searching, and validating work on *every* step/entry type, including
types the catalog does not know — unknown types are accepted for read and
validation. Scaffolding is stricter:

- `kettle_add_element` inserts a `canonical`, generator-eligible type cleanly.
  A type that is `observed` (`generator_eligible: false`) is refused unless the
  caller passes `allowObserved: true`; when allowed, the inserted block is
  prefixed with exactly one `<!-- MANUAL_REVIEW: ... -->` marker and the result
  reports `catalogStatus` and `manualReviewRequired`. A type that is **absent
  from the catalog is always rejected** by scaffolding — even with a custom
  template — until it is documented through catalog intake.
- `kettle_knowledge_analyze_xml` is the read-only intake path for an unknown
  type: give it a complete `.kjb`/`.ktr` or one `<entry>`/`<step>` block plus
  provenance, and it returns a reviewable candidate (status, suggested alias,
  byte-preserved XML, and findings such as absolute paths or possible secrets)
  **without writing anything**. Confirm and document the type before scaffolding
  it.
- `kettle_knowledge_coverage` walks `KETTLE_ROOT` and reports how many type
  usages are `canonical`, `observed`, or `missing` (uncatalogued), so gaps are
  visible.

### What `kettle_validate` checks

Structural (from `core/`, would make Kettle fail): malformed XML, duplicate
element names, hops referencing missing elements, jobs without exactly one
start entry, missing referenced `.ktr`/`.kjb` files, undefined connections,
stale step references (MergeJoin/FilterRows/etc.), unreachable elements,
undeclared variables.

Catalog (from `knowledge/`, softer): each step/entry `<type>` is checked
against the knowledge catalog. An unknown type is a **warning** (may be a valid
PDI type not yet documented, or a typo); a documented-but-not-canonical type is
**info**. Never an error. Pass `checkCatalog: false` to skip this layer.

## Packaged Windows release

For end users the server ships as a single self-contained Windows executable —
no system Node, no `npm install`, and the knowledge base and lifecycle guidance
are embedded inside the `.exe`.

### Build a release (maintainers)

```sh
npm install
npm run verify:profile                 # asserts no learning/promotion surface
npm run build:release -- --version 1.0.0
```

This produces, under `dist/`:

- `dte-pentaho-mcp-<version>-win-x64.zip` — exactly `dte-pentaho-mcp.exe`,
  `install.ps1`, `uninstall.ps1`, `doctor.ps1`, `config.example.yaml`,
  `README.md`, and `VERSION`.
- `checksums.sha256` — SHA-256 of the ZIP.

The build bundles the source with esbuild, embeds every immutable text asset,
creates a Node Single Executable blob, and injects it into a copy of the Node
runtime. It fails loudly if the SEA toolchain is unavailable rather than
shipping a build that needs system Node.

### Install offline (users)

1. Copy the ZIP to the target machine and extract it anywhere.
2. From the extracted folder:

   ```powershell
   .\install.ps1 -WorkspaceRoot C:\path\to\your\workspace
   ```

   This registers a `dte-pentaho` stdio server in
   `%USERPROFILE%\.kiro\settings\mcp.json`, backing up any existing config and
   preserving other servers. The entry is **not** auto-approved for all tools.
3. Reconnect the server from Kiro's MCP panel.

Verify the install at any time:

```powershell
.\doctor.ps1 -WorkspaceRoot C:\path\to\your\workspace
```

`doctor.ps1` performs an MCP handshake, checks the tool/prompt/resource surface,
validates `.pentaho-mcp.yaml`, and probes for an optional local PDI. A missing
PDI is reported separately and never fails the check.

Remove the server with `.\uninstall.ps1` (removes only the `dte-pentaho`
entry).

### Project configuration

Each served workspace commits a `.pentaho-mcp.yaml` at its root (see
`config.example.yaml`). Project directory names come from this file — nothing is
hard-coded. All configured paths are workspace-relative; absolute or escaping
paths and writes into a BA `input/` folder are rejected.

### Upgrades

Extract the new ZIP over a copy and re-run `install.ps1`; it overwrites only the
`dte-pentaho` entry. Keep the old folder until `doctor.ps1` reports OK on the new
one.

### Execution safety and no-auto-commit

- Kitchen/Pan execution is optional and only auto-runs in `DEV`/`TEST`. Every
  other environment (including `UNKNOWN`) requires an explicit confirmation.
- The server never mutates Git. It does not commit, push, or amend; it only
  reads Git status when inspecting a workspace. Commit decisions stay with you.

### Troubleshooting

- **Server not listed in Kiro** — re-run `install.ps1`, then reconnect from the
  MCP panel. Confirm `%USERPROFILE%\.kiro\settings\mcp.json` has a `dte-pentaho`
  entry pointing at the extracted `.exe`.
- **`doctor.ps1` reports a handshake failure** — the executable may be blocked
  by SmartScreen/AV; unblock the file (Properties → Unblock) and retry.
- **Config errors** — ensure `.pentaho-mcp.yaml` has `schema_version`,
  `project`, and `paths`, and that its paths are relative and inside the
  workspace.

## Development

```sh
npm install
npm test      # node:test; fixtures include real 9.4 files
```

## Extending

### Add a step or job entry type (no code)

1. Extract the XML block from a real, working `.ktr`/`.kjb` and write
   `src/knowledge/pentaho/trans/<TYPE>.md` (or `job/<TYPE>.md`) in the 5-part
   format (template, config fields, YAML→XML mapping, example, gotchas).
2. Add one line to `src/knowledge/pentaho/catalog.yaml` under
   `components.transformation` (or `components.job`): `type`, `xml_type`,
   `file`, `status`, `generator_eligible`.
3. Once verified in Spoon, set `status: canonical`, `generator_eligible: true`.

Only `catalog.yaml` and a markdown file change. The validator, knowledge tools,
and eligibility checks pick it up automatically.

### Add a tool (small code)

1. Write a new `src/tools/<name>.tools.js` exporting a factory
   `(ctx) => [ { name, description, inputSchema, handler } ]`, where `ctx` is
   `{ root, resolve }`.
2. Add the factory to `FACTORIES` in `src/tools/registry.js`.

`server.js` discovers everything through `buildTools()`; nothing else changes.

## Not included (by design)

- No execution of jobs/transformations (Pan/Kitchen). If a load-time check
  beyond static validation is ever needed, the intended shape is an optional,
  opt-in `kettle_loadcheck` tool that runs PDI in a load-only mode — not built
  yet.
- No Carte REST API, no monorepo/docs app, no per-type schema registry.

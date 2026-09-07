# Session-Root Pentaho Runtime Design

## Objective

Keep all four optional Pentaho runtime tools while removing the obsolete
project model based on `.pentaho-mcp.yaml`, requirement folders, documentation
roots, and a separately configured Pentaho artifact root.

The MCP operates on one filesystem root:

```js
process.env.KETTLE_ROOT ?? process.cwd()
```

When the MCP client launches the server in the active project directory, no
`KETTLE_ROOT` setting is needed. `KETTLE_ROOT` remains an optional override for
clients that launch MCP servers from another working directory or reuse a
global configuration.

## Configuration

Minimal configuration when the client supplies the correct working directory:

```json
{
  "env": {
    "PENTAHO_HOME": "C:/Pentaho/data-integration"
  }
}
```

Configuration with an explicit project boundary:

```json
{
  "env": {
    "KETTLE_ROOT": "C:/path/to/current-project",
    "PENTAHO_HOME": "C:/Pentaho/data-integration"
  }
}
```

`PENTAHO_HOME` is optional for static read/edit/validate/knowledge tools. When
it is missing, runtime detection reports unavailable and Kitchen/Pan are not
spawned.

There is no `.pentaho-mcp.yaml`, `PENTAHO_ENV`, `KETTLE_DOCS_DIR`, or
`KETTLE_JOBS_DIR` setting.

## Filesystem model

The server does not assume, discover, create, or rename project subdirectories.
Projects may use any structure, including `docs`, `dte-docs`, `etl-pentaho`,
`dte-etl-pentaho`, or no such directories at all.

Every artifact path accepted by read, edit, validate, knowledge coverage, and
runtime tools is relative to the single active root or is an absolute path
canonically contained by it. Existing canonical containment behavior remains:
absolute outside paths, `..` traversal, sibling-prefix tricks, and
symlink/junction escapes are rejected.

No directory is created at server startup. Runtime logs are created lazily at:

```text
<active-root>/.pentaho-mcp/runtime-logs/
```

Projects should ignore `.pentaho-mcp/` in version control when runtime tools
are used.

## Runtime tool contracts

The production surface remains exactly 22 tools. The names stay unchanged and
the four runtime schemas become:

- `kettle_runtime_detect`: no arguments.
- `kettle_runtime_loadcheck`: required `artifact`; optional `parameters` and
  `timeoutMs`.
- `kettle_runtime_execute`: required `artifact`; optional `parameters`,
  `timeoutMs`, and `confirmed`.
- `kettle_runtime_logs`: no arguments.

`artifact` follows the same root-relative path contract as the other Kettle
tools. Only `.kjb` and `.ktr` files are accepted; the extension selects Kitchen
or Pan.

The runtime tool factory receives the already-created shared workspace context.
It must not accept a per-call `workspaceRoot` and must not reload configuration
from disk. This ensures a caller cannot widen or switch the server's boundary
through tool arguments.

## Runtime behavior

`kettle_runtime_loadcheck` performs static validation and then invokes
Kitchen/Pan in load-check mode. It does not require execution confirmation.

`kettle_runtime_execute` always returns `CONFIRM_REQUIRED` unless
`confirmed: true` is supplied for that call. Environment names never bypass
confirmation.

Existing safeguards remain unchanged:

- Static validation precedes loadcheck and execute.
- Process arguments are passed without user-built command strings, except the
  existing quoted Windows batch-file shell compatibility path.
- Default timeout is 120 seconds.
- Captured output is limited to the final 256 KB.
- Parameters and credential-like values are redacted from returned output and
  persisted logs.
- Logs are written only inside the active root.

## Code organization

- `src/server.js` continues to construct the canonical workspace boundary and
  additionally exposes `pentahoHome` from `PENTAHO_HOME`.
- `src/tools/runtime.tools.js` consumes the shared context, resolves artifacts
  through `resolveRead`, and uses `<root>/.pentaho-mcp/runtime-logs`.
- `src/runtime/detect.js` accepts a PDI home path directly.
- `src/runtime/policy.js` becomes confirmation-only.
- `src/runtime/run.js` consumes `context.pentahoHome` instead of a project
  configuration object.
- `src/project/config.js`, `src/project/paths.js`, their tests, and
  `packaging/config.example.yaml` are removed.

## Error behavior

- Missing `PENTAHO_HOME`: detection returns `available: false` with a clear
  reason; static tools continue working.
- Configured but nonexistent `PENTAHO_HOME`: detection reports the invalid
  configured path.
- Missing, malformed, non-Kettle, or outside-root artifact: runtime tool returns
  the standard MCP `{ok:false,error}` payload without spawning PDI.
- Unconfirmed execute: returns `{status:'CONFIRM_REQUIRED'}` without spawning.
- Missing runtime log directory: `kettle_runtime_logs` returns `{files:[]}`.

## Verification

- Contract-test that runtime schemas contain no `workspaceRoot` or
  `requirementFolder`.
- Test that runtime artifact resolution shares the existing workspace boundary.
- Test that execute always requires explicit confirmation.
- Test that sanitized logs are written under `.pentaho-mcp/runtime-logs`.
- Test missing and invalid `PENTAHO_HOME` behavior.
- Guard production source and current documentation against references to
  `.pentaho-mcp.yaml`, project-config helpers, requirement folders, and
  environment-based execution policy.
- Run focused tests, the complete suite, the production-profile verifier, and
  the Windows release build where the environment permits it.

## Non-goals

- Automatically identifying documentation or ETL subdirectories.
- Creating a project directory structure.
- Switching project roots through a runtime tool argument.
- Dynamically following an agent's working directory after the MCP process has
  started.
- Deploying Pentaho artifacts or proving business/data correctness.

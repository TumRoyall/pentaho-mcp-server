# Multi-client MCP Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows release and installation documentation client-neutral, with complete manual setup instructions for Kiro, Claude Code, and Codex.

**Architecture:** Keep one stdio server artifact and one shared set of runtime environment variables. Remove the Kiro-specific installer/uninstaller from the release, make `docs/install.md` the canonical manual setup guide for all three clients, and reconcile every derived document and packaging assertion with that contract.

**Tech Stack:** Node.js 20+, ESM, `node:test`, PowerShell, esbuild, Node SEA, JSON client configuration, TOML Codex configuration.

**Spec:** This handoff is the approved bounded design; there is no separate spec document.

## Global Constraints

- Do not add a replacement install or uninstall script. Installation and removal are manual client configuration operations.
- Keep `packaging/doctor.ps1`; it verifies the packaged executable independently of any client.
- Keep both supported server launch modes: source mode with Node.js 20+ and the self-contained Windows `.exe`.
- Keep the server name `dte-pentaho` in every client example.
- Preserve the meanings of `KETTLE_ROOT`, `PENTAHO_HOME`, and `PENTAHO_ENABLE_EXECUTE`; only `KETTLE_ROOT` is recommended for every setup, while both PDI variables remain optional.
- Use absolute Windows paths with forward slashes inside JSON and TOML examples so users do not need to double-escape backslashes.
- Kiro MCP configuration lives in `.kiro/settings/mcp.json` for a workspace or `%USERPROFILE%/.kiro/settings/mcp.json` for the user.
- Claude Code project MCP configuration lives in `.mcp.json` at the project root, not under `.claude/`. Its project skill lives at `.claude/skills/developing-pentaho-jobs/`.
- Codex MCP configuration lives in project `.codex/config.toml` or user `%USERPROFILE%/.codex/config.toml`. Its project skill lives at `.agents/skills/developing-pentaho-jobs/`.
- Keep the companion skill in both the npm package and Windows ZIP.
- Keep user-facing documentation in Vietnamese and use the product names exactly: `Kiro`, `Claude Code`, and `Codex`.
- Do not change the MCP tool surface, runtime behavior, npm dependencies, or release executable name.
- Use test-first development, run `git diff --check` before each commit, and do not modify unrelated dirty-worktree changes.

## Authoritative Client References

- Kiro MCP JSON configuration: <https://kiro.dev/docs/mcp/configuration/>
- Claude Code MCP configuration and `.mcp.json` project scope: <https://code.claude.com/docs/en/mcp>
- Claude Code project skills under `.claude/skills/`: <https://code.claude.com/docs/en/skills>
- Codex MCP CLI and `config.toml`: <https://learn.chatgpt.com/docs/extend/mcp?surface=cli>
- Codex repository skills under `.agents/skills/`: <https://learn.chatgpt.com/docs/build-skills>

---

### Task 1: Make the Windows release client-neutral

**Files:**

- Modify: `test/packaging.test.js`
- Modify: `scripts/build-release.mjs`
- Delete: `packaging/install.ps1`
- Delete: `packaging/uninstall.ps1`

**Interfaces:**

- Consumes: existing `assembleRelease(exePath, version)` behavior and `packaging/doctor.ps1`.
- Produces: a ZIP containing only the executable, release metadata, client-neutral doctor, README, and companion skill.

- [ ] **Step 1: Write the failing client-neutral packaging assertions**

In `test/packaging.test.js`, replace the installer-oriented first test with a doctor-only portability check:

```js
test('production profile and client-neutral doctor remain portable', () => {
  const verify = spawnSync(process.execPath, ['scripts/verify-production-profile.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);
  const doctor = readFileSync(path.join(root, 'packaging', 'doctor.ps1'), 'utf8');
  assert.doesNotMatch(doctor, /C:\\Users\\|autoApprove\s*[:=]\s*\[\s*["']\*["']/i);
  assert.equal(existsSync(path.join(root, 'packaging', 'install.ps1')), false);
  assert.equal(existsSync(path.join(root, 'packaging', 'uninstall.ps1')), false);
});
```

Remove `packaging/install.ps1` from the legacy-configuration scan. Change the expected ZIP inventory to exactly:

```js
[
  'README.md',
  'VERSION',
  'doctor.ps1',
  'dte-pentaho-mcp.exe',
  'skills/',
  'skills/developing-pentaho-jobs/',
  'skills/developing-pentaho-jobs/references/',
  'skills/developing-pentaho-jobs/SKILL.md',
  'skills/developing-pentaho-jobs/references/pentaho-spec-template.md',
  'skills/developing-pentaho-jobs/references/pentaho-plan-template.md',
]
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```powershell
node --test test/packaging.test.js
```

Expected: FAIL because `packaging/install.ps1` and `packaging/uninstall.ps1` still exist and the build still stages them.

- [ ] **Step 3: Remove client-specific scripts from the release implementation**

In `scripts/build-release.mjs`, replace:

```js
for (const script of ['install.ps1', 'uninstall.ps1', 'doctor.ps1']) {
  copyFileSync(path.join(root, 'packaging', script), path.join(staging, script));
}
```

with:

```js
copyFileSync(
  path.join(root, 'packaging', 'doctor.ps1'),
  path.join(staging, 'doctor.ps1'),
);
```

Delete `packaging/install.ps1` and `packaging/uninstall.ps1`. Do not replace them with scripts for Claude Code or Codex.

- [ ] **Step 4: Run the focused packaging test**

Run:

```powershell
node --test test/packaging.test.js
```

Expected: PASS, including the real `.exe` handshake and exact ZIP inventory assertion.

- [ ] **Step 5: Inspect the generated archive**

Run:

```powershell
tar.exe -tf dist/dte-pentaho-mcp-1.0.0-win-x64.zip
```

Expected: the ten entries listed in Step 1, with no `install.ps1` or `uninstall.ps1`.

- [ ] **Step 6: Commit the release change**

Run:

```powershell
git diff --check
git add scripts/build-release.mjs test/packaging.test.js packaging/install.ps1 packaging/uninstall.ps1
git commit -m "refactor: make release packaging client neutral"
```

---

### Task 2: Write the canonical three-client installation guide

**Files:**

- Modify: `docs/install.md`
- Modify: `test/packaging.test.js`

**Interfaces:**

- Consumes: source entry point `src/index.js`, packaged entry point `dte-pentaho-mcp.exe`, and the environment-variable contract in `docs/configuration.md`.
- Produces: one authoritative manual installation guide with source and packaged examples for Kiro, Claude Code, and Codex.

- [ ] **Step 1: Add a failing documentation contract test**

Add this test to `test/packaging.test.js`:

```js
test('installation guide covers all supported clients and their skill locations', () => {
  const install = readFileSync(path.join(root, 'docs', 'install.md'), 'utf8');
  for (const required of [
    'Kiro',
    'Claude Code',
    'Codex',
    '.kiro/settings/mcp.json',
    '.mcp.json',
    '.claude/skills/developing-pentaho-jobs/',
    '.codex/config.toml',
    '.agents/skills/developing-pentaho-jobs/',
    'claude mcp list',
    'codex mcp list',
  ]) {
    assert.ok(install.includes(required), `docs/install.md must include ${required}`);
  }
  assert.doesNotMatch(install, /install\.ps1|uninstall\.ps1/);
});
```

- [ ] **Step 2: Run the documentation contract and verify red**

Run:

```powershell
node --test --test-name-pattern="installation guide" test/packaging.test.js
```

Expected: FAIL because the current guide is Kiro-first, omits Claude Code, and still instructs users to run installer scripts.

- [ ] **Step 3: Rewrite the release/build opening of `docs/install.md`**

Make the document start with the two server launch choices, independent of client:

1. **Packaged Windows `.exe`** for end users: download/copy ZIP, verify `checksums.sha256`, extract to a stable absolute folder, and use the extracted `dte-pentaho-mcp.exe` path in client configuration.
2. **Source mode** for developers: require Node.js 20+, run `npm install`, and use `node` plus the absolute `src/index.js` path in client configuration.

Keep the maintainer build commands exact:

```powershell
npm install
npm run verify:profile
npm run build:release -- --version 1.0.0
```

Document the new ZIP inventory without `install.ps1` and `uninstall.ps1`. State that users should keep the extracted folder stable because client configuration points directly at the executable.

- [ ] **Step 4: Add complete Kiro examples for both launch modes**

Document workspace `.kiro/settings/mcp.json` and user `%USERPROFILE%/.kiro/settings/mcp.json`. The packaged example must be:

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "command": "C:/Tools/dte-pentaho-mcp/dte-pentaho-mcp.exe",
      "args": [],
      "env": {
        "KETTLE_ROOT": "C:/work/my-pentaho-project",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

The source example uses `"command": "node"` and:

```json
"args": ["C:/src/pentaho-mcp-server/src/index.js"]
```

Tell the user to save the file and reconnect/check `dte-pentaho` in Kiro's MCP panel.

- [ ] **Step 5: Add complete Claude Code examples for both launch modes**

State explicitly that Claude Code project MCP configuration is `.mcp.json` at the project root; `.claude/` is used for the companion skill, not the MCP server entry.

Use this packaged `.mcp.json` example:

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "type": "stdio",
      "command": "C:/Tools/dte-pentaho-mcp/dte-pentaho-mcp.exe",
      "args": [],
      "env": {
        "KETTLE_ROOT": "C:/work/my-pentaho-project",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

The source example uses `"command": "node"` and the same absolute `src/index.js` argument used for Kiro. Explain that project-scoped `.mcp.json` may require workspace trust/approval. Verification commands:

```powershell
claude mcp list
claude mcp get dte-pentaho
```

Also mention `/mcp` inside an interactive Claude Code session. Do not claim the MCP config belongs in `.claude/settings.json`.

- [ ] **Step 6: Add complete Codex examples for both launch modes**

Document project `.codex/config.toml` and user `%USERPROFILE%/.codex/config.toml`. The packaged example must be:

```toml
[mcp_servers.dte-pentaho]
command = "C:/Tools/dte-pentaho-mcp/dte-pentaho-mcp.exe"
args = []

[mcp_servers.dte-pentaho.env]
KETTLE_ROOT = "C:/work/my-pentaho-project"
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

The source example must be:

```toml
[mcp_servers.dte-pentaho]
command = "node"
args = ["C:/src/pentaho-mcp-server/src/index.js"]

[mcp_servers.dte-pentaho.env]
KETTLE_ROOT = "C:/work/my-pentaho-project"
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

Verification:

```powershell
codex mcp list
```

Also mention `/mcp` in Codex TUI and that the IDE extension must be restarted after adding a server through its MCP settings UI.

- [ ] **Step 7: Add the shared companion-skill matrix**

Document that the source tree and ZIP both contain `skills/developing-pentaho-jobs/`, but discovery requires copying that entire directory to one of these destinations:

| Client | Project scope | User scope |
|---|---|---|
| Kiro | `.kiro/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.kiro/skills/developing-pentaho-jobs/` |
| Claude Code | `.claude/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.claude/skills/developing-pentaho-jobs/` |
| Codex | `.agents/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.agents/skills/developing-pentaho-jobs/` |

Do not use `.codex/skills/`; the current Codex repository/user discovery path is `.agents/skills/`.

- [ ] **Step 8: Preserve shared runtime, offline, verification, and removal guidance**

Keep these points in `docs/install.md`:

- `PENTAHO_HOME` is optional and only enables local PDI runtime tools.
- `PENTAHO_ENABLE_EXECUTE="1"` is optional and must be added explicitly to the selected client's `env` block to permit real execution.
- `doctor.ps1` checks the packaged server directly and does not register it in any client.
- Offline source installation can copy the repository with `node_modules` or use an internal npm registry.
- Removal means deleting only the `dte-pentaho` entry/table from the selected client configuration and optionally deleting the copied companion-skill directory.
- Moving or deleting the extracted `.exe` folder breaks configurations that still point to it.

- [ ] **Step 9: Run the focused documentation and packaging tests**

Run:

```powershell
node --test test/packaging.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit the canonical installation guide**

Run:

```powershell
git diff --check
git add docs/install.md test/packaging.test.js
git commit -m "docs: add Kiro Claude Code and Codex setup"
```

---

### Task 3: Reconcile derived documentation and complete release verification

**Files:**

- Modify: `README.md`
- Modify: `docs/configuration.md`
- Modify: `docs/operations.md`
- Modify: `docs/development.md`
- Modify: `docs/architecture.md`
- Modify: `docs/documentation-facts.md`
- Modify: `test/packaging.test.js`

**Interfaces:**

- Consumes: the client-neutral ZIP contract from Task 1 and canonical install guide from Task 2.
- Produces: consistent quick-start, configuration, operations, development, architecture, and source-of-truth documentation.

- [ ] **Step 1: Add a failing stale-reference test**

Add to `test/packaging.test.js`:

```js
test('current documentation has no removed installer workflow', () => {
  for (const relative of [
    'README.md',
    'docs/architecture.md',
    'docs/configuration.md',
    'docs/development.md',
    'docs/documentation-facts.md',
    'docs/install.md',
    'docs/operations.md',
  ]) {
    const text = readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(text, /install\.ps1|uninstall\.ps1/, relative);
  }
});
```

- [ ] **Step 2: Run the stale-reference test and verify red**

Run:

```powershell
node --test --test-name-pattern="removed installer workflow" test/packaging.test.js
```

Expected: FAIL and report the current documents that still describe `install.ps1` or `uninstall.ps1`.

- [ ] **Step 3: Make README client-neutral**

Replace the Kiro-only source registration block with a short three-client matrix and link each row to the detailed section in `docs/install.md`. Keep one compact Kiro JSON example only if the same subsection immediately links the Claude Code JSON and Codex TOML examples; do not label Kiro as the default installation path.

Update the packaged quick start to:

```powershell
npm run build:release -- --version 1.0.0
.\build\release\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
```

Explain that client registration is manual and link `docs/install.md`. Expand the companion-skill list to Kiro, Claude Code, and Codex with their exact project/user paths from Task 2.

- [ ] **Step 4: Reconcile configuration and operations**

In `docs/configuration.md`:

- Replace `Đăng ký source-mode` and `Đăng ký packaged executable` with a client-neutral explanation of the shared command/args/env model.
- Link to the three exact client examples in `docs/install.md` instead of duplicating every block.
- Remove Kiro-specific reconnect wording.

In `docs/operations.md`:

- Change the source-of-truth list from all `packaging/*.ps1` to `packaging/doctor.ps1`, `scripts/*.mjs`, and runtime/workspace sources.
- Expand companion-skill destinations to all three clients.
- Define upgrade as extracting the new ZIP into a new stable folder, editing the selected client's `dte-pentaho` command path, verifying, then retaining or removing the previous folder.
- Define rollback as restoring the old executable path in the same client config.
- Define uninstall as deleting the `dte-pentaho` entry/table and optional copied skill directory.
- Remove the obsolete claim that an installer backs up Kiro JSON.

- [ ] **Step 5: Reconcile maintainer and architecture truth**

In `docs/development.md`, update the exact ZIP inventory to match Task 1 and state that configuration is documented rather than mutated by release scripts.

In `docs/architecture.md`, change the packaging module map from:

```text
install.ps1/uninstall.ps1/doctor.ps1
```

to:

```text
doctor.ps1 plus client-neutral manual configuration in docs/install.md
```

In `docs/documentation-facts.md`:

- Update the ZIP inventory fact to remove installer/uninstaller entries.
- Replace the installer/uninstaller fact with the client-neutral release and manual-removal contract.
- Update companion-skill discovery with exact Kiro, Claude Code, and Codex paths.
- Keep `scripts/build-release.mjs`, `test/packaging.test.js`, and official client documentation as the evidence sources.

- [ ] **Step 6: Scan current documentation for stale client-specific assumptions**

Run:

```powershell
rg -n -g '!docs/superpowers/**' "install\.ps1|uninstall\.ps1|Đăng ký vào Kiro|reconnect MCP trong Kiro|Codex / agent tương thích" README.md docs packaging scripts
```

Expected: no matches in current user-facing or source-of-truth docs, packaging, or scripts. Regression tests may name the removed scripts to assert their absence. Matches under historical `docs/superpowers/specs/` and older plan files may remain because those are immutable historical records; do not rewrite them.

- [ ] **Step 7: Run focused packaging and documentation verification**

Run:

```powershell
node --test test/packaging.test.js
npm pack --dry-run --json
npm run verify:profile
```

Expected: all commands exit `0`; the npm tarball still includes `docs/install.md` and `skills/developing-pentaho-jobs/SKILL.md`, while excluding `docs/superpowers/`.

- [ ] **Step 8: Run the full test suite and rebuild the release**

Run:

```powershell
npm test
npm run build:release -- --version 1.0.0
.\dist\verify-extract\doctor.ps1
```

If `test/packaging.test.js` has already extracted the archive, use its `dist/verify-extract/doctor.ps1`; otherwise extract the ZIP into a temporary folder first. Expected: the full suite passes, build exits `0`, and doctor reports a successful MCP initialize plus `tools/list` with exactly 26 tools and no `pentaho_*` tools.

- [ ] **Step 9: Review the final diff and commit**

Run:

```powershell
git diff --check
git status --short
git diff -- README.md docs test/packaging.test.js scripts/build-release.mjs packaging
git add README.md docs/architecture.md docs/configuration.md docs/development.md docs/documentation-facts.md docs/operations.md test/packaging.test.js
git commit -m "docs: standardize multi-client MCP installation"
```

The final worker report must include:

1. The three commit hashes.
2. Exact focused and full verification commands with pass/fail results.
3. The final ZIP inventory.
4. Confirmation that current docs contain no `install.ps1` or `uninstall.ps1` workflow.
5. Any remaining historical references under `docs/superpowers/`, explicitly identified as historical and intentionally unchanged.

<#
.SYNOPSIS
  Diagnose a DTE Pentaho lifecycle MCP install.

.DESCRIPTION
  Verifies the packaged executable exists, performs an MCP stdio handshake
  (initialize, tools/list), validates an optional .pentaho-mcp.yaml, and probes
  for an optional local PDI. Exits nonzero when the install, handshake, or
  supplied config is invalid. A missing PDI is reported separately and never
  fails the check.

.PARAMETER WorkspaceRoot
  Optional workspace folder to validate .pentaho-mcp.yaml and probe pentaho.home.
#>
[CmdletBinding()]
param(
  [string] $WorkspaceRoot
)

$ErrorActionPreference = 'Stop'
$failures = @()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exePath = Join-Path $scriptDir 'dte-pentaho-mcp.exe'

if (-not (Test-Path -LiteralPath $exePath)) {
  Write-Host "[FAIL] executable missing: $exePath"
  exit 1
}
Write-Host "[OK]   executable present: $exePath"

# --- MCP handshake over stdio -------------------------------------------------
function New-Rpc([int]$id, [string]$method) {
  (@{ jsonrpc = '2.0'; id = $id; method = $method; params = @{} } | ConvertTo-Json -Compress -Depth 6)
}

$init = @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{
  protocolVersion = '2024-11-05'; capabilities = @{}; clientInfo = @{ name = 'doctor'; version = '1' } } } | ConvertTo-Json -Compress -Depth 6

$requests = @(
  $init,
  (New-Rpc 2 'tools/list')
) -join "`n"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $exePath
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$proc = [System.Diagnostics.Process]::Start($psi)
$proc.StandardInput.Write($requests + "`n")
$proc.StandardInput.Close()
$stdout = $proc.StandardOutput.ReadToEnd()
$null = $proc.StandardError.ReadToEnd()
if (-not $proc.WaitForExit(60000)) { $proc.Kill() }

$responses = @()
foreach ($line in ($stdout -split "`r?`n")) {
  $t = $line.Trim()
  if ($t.StartsWith('{')) { try { $responses += ($t | ConvertFrom-Json) } catch {} }
}

$tools = ($responses | Where-Object { $_.id -eq 2 }).result.tools
if ($tools -and $tools.Count -eq 22) {
  Write-Host "[OK]   MCP handshake: $($tools.Count) tools"
} else {
  $count = if ($tools) { $tools.Count } else { 0 }
  Write-Host "[FAIL] MCP handshake: expected 22 tools, got $count"
  $failures += 'handshake'
}

if ($tools | Where-Object { $_.name -like 'pentaho_*' }) {
  Write-Host "[FAIL] lifecycle pentaho_* tools advertised"
  $failures += 'lifecycle-surface'
} else {
  Write-Host "[OK]   no lifecycle pentaho_* tools advertised"
}

# --- Optional workspace config ------------------------------------------------
if ($WorkspaceRoot) {
  $cfg = Join-Path $WorkspaceRoot '.pentaho-mcp.yaml'
  if (-not (Test-Path -LiteralPath $cfg)) {
    Write-Host "[FAIL] .pentaho-mcp.yaml not found in $WorkspaceRoot"
    $failures += 'config'
  } else {
    $text = Get-Content -LiteralPath $cfg -Raw
    $needed = @('schema_version', 'project', 'paths')
    $missing = $needed | Where-Object { $text -notmatch ("(?m)^\s*" + [regex]::Escape($_) + "\s*:") }
    if ($missing.Count -eq 0) {
      Write-Host "[OK]   .pentaho-mcp.yaml has schema_version, project, paths"
    } else {
      Write-Host "[FAIL] .pentaho-mcp.yaml missing keys: $($missing -join ', ')"
      $failures += 'config'
    }

    # Optional PDI probe (never a failure).
    $homeMatch = [regex]::Match($text, "(?m)^\s*home\s*:\s*(.+?)\s*$")
    if ($homeMatch.Success) {
      $pdiHome = $homeMatch.Groups[1].Value.Trim("'`" ")
      $abs = if ([System.IO.Path]::IsPathRooted($pdiHome)) { $pdiHome } else { Join-Path $WorkspaceRoot $pdiHome }
      $kitchen = Join-Path $abs 'Kitchen.bat'
      if (Test-Path -LiteralPath $kitchen) {
        Write-Host "[INFO] optional PDI detected: $kitchen"
      } else {
        Write-Host "[INFO] optional PDI not found under $abs (runtime execution unavailable; validation/generation still work)"
      }
    } else {
      Write-Host "[INFO] no pentaho.home configured; runtime execution disabled"
    }
  }
} else {
  Write-Host "[INFO] no -WorkspaceRoot supplied; skipped config and PDI checks"
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "doctor: FAILED ($($failures -join ', '))"
  exit 1
}
Write-Host ""
Write-Host "doctor: OK"
exit 0

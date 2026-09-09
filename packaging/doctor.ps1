<#
.SYNOPSIS
  Diagnose a DTE Pentaho Kettle MCP install.

.DESCRIPTION
  Verifies the packaged executable exists, performs an MCP stdio handshake
  (initialize, tools/list), and probes an optional local PDI given by
  -PentahoHome. Exits nonzero when the install or handshake is invalid. A
  missing PDI is reported separately and never fails the check.

.PARAMETER PentahoHome
  Optional PDI home (folder containing Kitchen.bat/Pan.bat) to probe. Runtime
  execution is unavailable without it; static tools still work.
#>
[CmdletBinding()]
param(
  [string] $PentahoHome
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
if ($tools -and $tools.Count -eq 26) {
  Write-Host "[OK]   MCP handshake: $($tools.Count) tools"
} else {
  $count = if ($tools) { $tools.Count } else { 0 }
  Write-Host "[FAIL] MCP handshake: expected 26 tools, got $count"
  $failures += 'handshake'
}

if ($tools | Where-Object { $_.name -like 'pentaho_*' }) {
  Write-Host "[FAIL] lifecycle pentaho_* tools advertised"
  $failures += 'lifecycle-surface'
} else {
  Write-Host "[OK]   no lifecycle pentaho_* tools advertised"
}

# --- Optional PDI probe (never a failure) -------------------------------------
if ($PentahoHome) {
  $kitchen = Join-Path $PentahoHome 'Kitchen.bat'
  if (Test-Path -LiteralPath $kitchen) {
    Write-Host "[INFO] optional PDI detected: $kitchen"
  } else {
    Write-Host "[INFO] optional PDI not found under $PentahoHome (runtime execution unavailable; static tools still work)"
  }
} else {
  Write-Host "[INFO] no -PentahoHome supplied; runtime execution disabled, static tools still work"
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "doctor: FAILED ($($failures -join ', '))"
  exit 1
}
Write-Host ""
Write-Host "doctor: OK"
exit 0

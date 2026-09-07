<#
.SYNOPSIS
  Register the DTE Pentaho Kettle MCP as a user-level stdio server in Kiro.

.DESCRIPTION
  Adds (or updates) a single "dte-pentaho" entry in the Kiro user MCP config at
  $HOME\.kiro\settings\mcp.json, pointing at the packaged executable that sits
  next to this script. Existing servers are preserved. The config is backed up
  before it is rewritten. The entry is NOT auto-approved for all tools.

.PARAMETER WorkspaceRoot
  Optional project folder. When supplied it is written as KETTLE_ROOT so the
  server scopes reads/writes to that project. Optional but recommended when the
  MCP client's working directory is unknown.

.PARAMETER PentahoHome
  Optional PDI home (folder containing Kitchen.bat/Pan.bat). When supplied it is
  written as PENTAHO_HOME to enable the optional runtime tools.

.NOTES
  Offline and self-contained: no downloads, no system Node required.
#>
[CmdletBinding()]
param(
  [string] $WorkspaceRoot,
  [string] $PentahoHome
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exePath = Join-Path $scriptDir 'dte-pentaho-mcp.exe'
if (-not (Test-Path -LiteralPath $exePath)) {
  throw "Executable not found next to installer: $exePath"
}

$settingsDir = Join-Path $HOME '.kiro\settings'
$configPath = Join-Path $settingsDir 'mcp.json'
if (-not (Test-Path -LiteralPath $settingsDir)) {
  New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
}

$config = [ordered]@{ mcpServers = [ordered]@{} }
if (Test-Path -LiteralPath $configPath) {
  $backup = "$configPath.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item -LiteralPath $configPath -Destination $backup -Force
  Write-Host "Backed up existing config to $backup"
  $raw = Get-Content -LiteralPath $configPath -Raw
  if ($raw.Trim().Length -gt 0) {
    $existing = $raw | ConvertFrom-Json
    $config = [ordered]@{}
    foreach ($prop in $existing.PSObject.Properties) { $config[$prop.Name] = $prop.Value }
    if (-not $config.Contains('mcpServers') -or $null -eq $config['mcpServers']) {
      $config['mcpServers'] = [ordered]@{}
    }
  }
}

$env = [ordered]@{}
if ($WorkspaceRoot) {
  $resolved = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
  $env['KETTLE_ROOT'] = $resolved
}
if ($PentahoHome) {
  $env['PENTAHO_HOME'] = $PentahoHome
}

$entry = [ordered]@{
  command     = $exePath
  args        = @()
  env         = $env
  disabled    = $false
  autoApprove = @()
}

# Assign the entry without clobbering sibling servers.
$servers = $config['mcpServers']
if ($servers -is [System.Collections.IDictionary]) {
  $servers['dte-pentaho'] = $entry
} else {
  $rebuilt = [ordered]@{}
  foreach ($prop in $servers.PSObject.Properties) { $rebuilt[$prop.Name] = $prop.Value }
  $rebuilt['dte-pentaho'] = $entry
  $config['mcpServers'] = $rebuilt
}

$json = $config | ConvertTo-Json -Depth 12
Set-Content -LiteralPath $configPath -Value $json -Encoding UTF8

Write-Host "Registered 'dte-pentaho' MCP server in $configPath"
Write-Host "Executable: $exePath"
if ($WorkspaceRoot) { Write-Host "KETTLE_ROOT: $($env['KETTLE_ROOT'])" }
if ($PentahoHome) { Write-Host "PENTAHO_HOME: $($env['PENTAHO_HOME'])" }
Write-Host "Reconnect the server from Kiro's MCP panel to load it."

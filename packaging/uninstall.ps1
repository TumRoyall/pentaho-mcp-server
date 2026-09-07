<#
.SYNOPSIS
  Remove the DTE Pentaho Kettle MCP entry from the Kiro user MCP config.

.DESCRIPTION
  Deletes only the "dte-pentaho" server from $HOME\.kiro\settings\mcp.json and
  leaves every other server untouched. The config is backed up first. If the
  entry or the config file does not exist the script is a no-op.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$configPath = Join-Path $HOME '.kiro\settings\mcp.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Host "No Kiro MCP config at $configPath; nothing to remove."
  return
}

$raw = Get-Content -LiteralPath $configPath -Raw
if ($raw.Trim().Length -eq 0) {
  Write-Host "Config is empty; nothing to remove."
  return
}

$existing = $raw | ConvertFrom-Json
$config = [ordered]@{}
foreach ($prop in $existing.PSObject.Properties) { $config[$prop.Name] = $prop.Value }

$servers = $config['mcpServers']
if ($null -eq $servers) {
  Write-Host "No mcpServers section; nothing to remove."
  return
}

$rebuilt = [ordered]@{}
$removed = $false
foreach ($prop in $servers.PSObject.Properties) {
  if ($prop.Name -eq 'dte-pentaho') { $removed = $true; continue }
  $rebuilt[$prop.Name] = $prop.Value
}

if (-not $removed) {
  Write-Host "'dte-pentaho' was not registered; nothing to remove."
  return
}

$backup = "$configPath.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -LiteralPath $configPath -Destination $backup -Force
Write-Host "Backed up existing config to $backup"

$config['mcpServers'] = $rebuilt
$json = $config | ConvertTo-Json -Depth 12
Set-Content -LiteralPath $configPath -Value $json -Encoding UTF8

Write-Host "Removed 'dte-pentaho' MCP server from $configPath"

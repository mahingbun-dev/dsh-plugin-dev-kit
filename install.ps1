# dsh-plugin-dev-kit installer for Windows (PowerShell).
# Copies the skill into the directory your AI coding tool scans. Idempotent.
[CmdletBinding()]
param(
  [ValidateSet('all', 'zcode', 'claude', 'codex')]
  [string]$Tool = 'all',
  [switch]$Project
)

$ErrorActionPreference = 'Stop'
$skillSrc = Join-Path $PSScriptRoot 'skills\dsh-plugin-dev'
$name = 'dsh-plugin-dev'

$targets = @()
if ($Project) {
  $cwd = (Get-Location).Path
  if ($Tool -eq 'codex') {
    Write-Warning 'Codex CLI has no project-level skill directory; install at user scope (drop -Project).'
    return
  }
  if ($Tool -eq 'all' -or $Tool -eq 'zcode') { $targets += @{ Label = 'ZCode (project)'; Path = Join-Path $cwd ".agents\skills\$name" } }
  if ($Tool -eq 'all' -or $Tool -eq 'claude') { $targets += @{ Label = 'Claude Code (project)'; Path = Join-Path $cwd ".claude\skills\$name" } }
}
else {
  if ($Tool -eq 'all' -or $Tool -eq 'zcode') { $targets += @{ Label = 'ZCode'; Path = Join-Path $HOME ".agents\skills\$name" } }
  if ($Tool -eq 'all' -or $Tool -eq 'claude') { $targets += @{ Label = 'Claude Code'; Path = Join-Path $HOME ".claude\skills\$name" } }
  if ($Tool -eq 'all' -or $Tool -eq 'codex') { $targets += @{ Label = 'Codex CLI'; Path = Join-Path $HOME ".codex\skills\$name" } }
}

foreach ($target in $targets) {
  if (Test-Path $target.Path) { Remove-Item -Recurse -Force $target.Path }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target.Path) | Out-Null
  Copy-Item -Recurse -Force $skillSrc $target.Path
  Write-Host "installed ($($target.Label)) -> $($target.Path)"
}

Write-Host ""
Write-Host 'Done. Start a fresh session and ask your agent to build a dsh plugin.'

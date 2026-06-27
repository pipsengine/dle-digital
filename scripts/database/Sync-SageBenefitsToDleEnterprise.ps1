param(
  [string]$DleServerInstance = 'localhost',
  [string]$DleDatabase = 'DLE_Enterprise',
  [switch]$OverwriteExisting,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line -notmatch '=') { return }
    $parts = $line.Split('=', 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..\..')
Set-Location $repoRoot

Read-DotEnv -Path (Join-Path $repoRoot '.env')
Read-DotEnv -Path (Join-Path $repoRoot 'apps\dashboard\.env')

if ([string]::IsNullOrWhiteSpace($env:SAGE_PAYROLL_DB_PASSWORD)) {
  throw 'SAGE_PAYROLL_DB_PASSWORD is required in apps/dashboard/.env'
}

$argsList = @()
if ($DryRun) { $argsList += '--dry-run' } else { $argsList += '--apply' }
if ($OverwriteExisting) { $argsList += '--overwrite' }

Write-Host 'Syncing Sage DLE_JUNE benefits data into DLE_Enterprise...'
Write-Host "Mode: $(if ($DryRun) { 'Dry run' } else { 'Apply' })$(if ($OverwriteExisting) { ' (overwrite existing)' } else { '' })"

& npx tsx --tsconfig (Join-Path $repoRoot 'apps\dashboard\tsconfig.json') (Join-Path $repoRoot 'scripts\database\sync-sage-benefits-runner.ts') @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Sage benefits sync finished.'

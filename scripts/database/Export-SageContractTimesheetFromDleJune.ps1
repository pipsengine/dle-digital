param(
  [string]$Period = '',
  [string]$EmployeeCode = '',
  [string]$OutputRoot = '',
  [switch]$WhatIf
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

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repoRoot

Read-DotEnv -Path (Join-Path $repoRoot '.env')
Read-DotEnv -Path (Join-Path $repoRoot 'apps\dashboard\.env')

if ([string]::IsNullOrWhiteSpace($Period)) {
  $Period = [Environment]::GetEnvironmentVariable('HRIS_ACTIVE_PAYROLL_PERIOD', 'Process')
  if ([string]::IsNullOrWhiteSpace($Period)) { $Period = '2026-06' }
}

$nodeArgs = @('scripts/database/export-sage-contract-timesheet.js', '--period', $Period)
if (-not [string]::IsNullOrWhiteSpace($EmployeeCode)) {
  $nodeArgs += @('--employee', $EmployeeCode.ToUpper())
}
if (-not [string]::IsNullOrWhiteSpace($OutputRoot)) {
  $nodeArgs += @('--output', $OutputRoot)
}

Write-Host "Exporting Sage contract timesheet from DLE_JUNE for period $Period..."
if ($WhatIf) {
  Write-Host "WhatIf: node $($nodeArgs -join ' ')"
  return
}

& node @nodeArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$exportDir = if ($OutputRoot) { $OutputRoot } else { Join-Path $repoRoot "exports\sage-timesheet\$Period" }
$summaryCsv = Join-Path $exportDir "sage-contract-timesheet-summary-$Period.csv"
$detailCsv = Join-Path $exportDir "sage-contract-earn-units-detail-$Period.csv"

if ((Test-Path -LiteralPath $summaryCsv) -and (Get-Command Export-Excel -ErrorAction SilentlyContinue)) {
  $xlsxPath = Join-Path $exportDir "sage-contract-timesheet-$Period.xlsx"
  Import-Csv -LiteralPath $detailCsv | Export-Excel -Path $xlsxPath -WorksheetName 'Earn Units Detail' -ClearSheet -AutoSize
  Import-Csv -LiteralPath $summaryCsv | Export-Excel -Path $xlsxPath -WorksheetName 'Summary' -ClearSheet -AutoSize -Append
  Write-Host "Excel workbook: $xlsxPath"
} else {
  Write-Host "CSV files are ready to open in Excel:"
  Write-Host "  $detailCsv"
  Write-Host "  $summaryCsv"
}

<#
.SYNOPSIS
  HRIS July 2026 cutover orchestrator — DLE_JUNE (Sage) -> DLE_Enterprise (DLE Connect).

.DESCRIPTION
  Phased runbook for replacing Sage 300 People payroll before the August 31 expiry.
  Run each phase in order; use -Phase to execute a single phase.

  Servers (defaults match production topology):
    DLE_Enterprise : 192.168.5.5  — target HRIS database
    Sage payroll   : 192.168.5.8  — legacy source DLE_JUNE (read-only after cutover)

.PARAMETER Phase
  all | schema | sage-import | sage-sync | validate | dry-run

.EXAMPLE
  .\Invoke-HrisJulyCutover.ps1 -Phase schema -DleServerInstance "192.168.5.5" -SaPassword $env:DLE_ENTERPRISE_SA_PASSWORD

.EXAMPLE
  .\Invoke-HrisJulyCutover.ps1 -Phase sage-import -SageServerInstance "192.168.5.8\MSSQLSERVERPEOPL" -DleServerInstance "192.168.5.5"
#>
param(
  [ValidateSet('all', 'schema', 'sage-import', 'sage-sync', 'validate', 'dry-run')]
  [string]$Phase = 'dry-run',
  [string]$DleServerInstance = '192.168.5.5',
  [string]$SageServerInstance = '192.168.5.8\MSSQLSERVERPEOPL',
  [string]$SaPassword = $env:DLE_ENTERPRISE_SA_PASSWORD,
  [string]$SageSaPassword = $env:SAGE_PAYROLL_DB_PASSWORD,
  [string]$BackupRoot = 'C:\SQLBackups\DLE_Enterprise',
  [switch]$SkipEmployeeImport
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Phase([string]$Title) {
  Write-Host ""
  Write-Host "========== $Title ==========" -ForegroundColor Cyan
}

function Assert-Password([string]$Value, [string]$Name) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing $Name. Pass -SaPassword or set DLE_ENTERPRISE_SA_PASSWORD / SAGE_PAYROLL_DB_PASSWORD."
  }
}

Write-Phase "HRIS July 2026 Cutover — Phase: $Phase"
Write-Host "Target : DLE_Enterprise @ $DleServerInstance"
Write-Host "Source : Sage DLE_JUNE @ $SageServerInstance"
Write-Host "Deadline: HRIS complete by 31 Jul 2026 | Sage expires 31 Aug 2026"
Write-Host ""

if ($Phase -eq 'dry-run') {
  Write-Host @"
CUTOVER CHECKLIST (no changes made)

Phase 1 — Schema (DLE_Enterprise @ 192.168.5.5)
  [ ] Run Invoke-DleEnterpriseDatabaseSetup.ps1 (includes 45 payroll runs table)
  [ ] Confirm hris.PayrollRuns, hris.Employees, hris.Timesheet*, security.AuthUsers exist
  [ ] Set apps/dashboard/.env: DLE_ENTERPRISE_DB_HOST=192.168.5.5, SAGE_PAYROLL_DB_NAME=DLE_JUNE

Phase 2 — Sage employee master import (one-time + delta before each parallel run)
  [ ] Import-SagePayrollEmployeesToDleEnterprise.ps1
  [ ] sync-sage-employee-names-addresses.js
  [ ] supervisor-assignment-importer.js

Phase 3 — Sage payroll inputs sync
  [ ] Sync-SagePayrollInputsToDleEnterprise.ps1
  [ ] Sync-SageDailyRatesToDleEnterprise.ps1
  [ ] import-bank-schedule-to-hris.ts (if bank file available)

Phase 4 — Application validation
  [ ] Employee directory count >= HRIS_MIN_EMPLOYEE_SOURCE_COUNT (100)
  [ ] /hris/payroll/sage-migration-review — variance within tolerance
  [ ] Parallel payroll run: DLE Connect vs Sage May period
  [ ] Period workflow: open -> calculate -> approve -> payslips -> bank -> statutory -> post -> close

Phase 5 — JSON -> SQL migration (before go-live)
  [ ] payroll-runs.json dual-write verified to hris.PayrollRuns
  [ ] payroll-periods.json -> consider SQL table (or persistent IIS volume)
  [ ] timesheet-entry.json -> hris.Timesheet* (primary when DB up)
  [ ] ess-requests.json -> leave SQL table (post-cutover backlog if needed)

Phase 6 — Go-live (target: 31 Jul 2026)
  [ ] Sage DLE_JUNE set read-only
  [ ] Final delta sync
  [ ] Production payroll on DLE Connect for August period
  [ ] Sage decommission after August payroll sign-off

IN SCOPE for July: Employees, Organization, Attendance, Timesheets, Payroll (full lifecycle), Leave (ESS), Admin/RBAC
OUT OF SCOPE (scaffold only): Benefits, Recruitment, L&D, Performance, Reports hub, Announcements

Re-run with -Phase schema | sage-import | sage-sync | validate to execute.
"@
  exit 0
}

if ($Phase -in @('all', 'schema')) {
  Write-Phase "Phase 1: DLE_Enterprise schema"
  Assert-Password $SaPassword 'DLE_ENTERPRISE_SA_PASSWORD'
  & (Join-Path $scriptRoot 'Invoke-DleEnterpriseDatabaseSetup.ps1') -ServerInstance $DleServerInstance -SaPassword $SaPassword -BackupRoot $BackupRoot
}

if ($Phase -in @('all', 'sage-import') -and -not $SkipEmployeeImport) {
  Write-Phase "Phase 2: Sage employee import"
  Assert-Password $SaPassword 'DLE_ENTERPRISE_SA_PASSWORD'
  Assert-Password $SageSaPassword 'SAGE_PAYROLL_DB_PASSWORD'
  $env:DLE_ENTERPRISE_DB_HOST = $DleServerInstance
  $env:DLE_ENTERPRISE_DB_PASSWORD = $SaPassword
  $env:SAGE_PAYROLL_DB_HOST = ($SageServerInstance -split '\\')[0]
  $env:SAGE_PAYROLL_DB_INSTANCE = if ($SageServerInstance -match '\\') { ($SageServerInstance -split '\\')[1] } else { 'MSSQLSERVERPEOPL' }
  $env:SAGE_PAYROLL_DB_PASSWORD = $SageSaPassword
  & (Join-Path $scriptRoot 'Import-SagePayrollEmployeesToDleEnterprise.ps1') -DleServerInstance $DleServerInstance
}

if ($Phase -in @('all', 'sage-sync')) {
  Write-Phase "Phase 3: Sage payroll inputs sync"
  Assert-Password $SaPassword 'DLE_ENTERPRISE_SA_PASSWORD'
  Assert-Password $SageSaPassword 'SAGE_PAYROLL_DB_PASSWORD'
  $env:DLE_ENTERPRISE_DB_HOST = $DleServerInstance
  $env:DLE_ENTERPRISE_DB_PASSWORD = $SaPassword
  $env:SAGE_PAYROLL_DB_HOST = ($SageServerInstance -split '\\')[0]
  $env:SAGE_PAYROLL_DB_INSTANCE = if ($SageServerInstance -match '\\') { ($SageServerInstance -split '\\')[1] } else { 'MSSQLSERVERPEOPL' }
  $env:SAGE_PAYROLL_DB_PASSWORD = $SageSaPassword
  & (Join-Path $scriptRoot 'Sync-SagePayrollInputsToDleEnterprise.ps1') -DleServerInstance $DleServerInstance
  & (Join-Path $scriptRoot 'Sync-SageDailyRatesToDleEnterprise.ps1') -DleServerInstance $DleServerInstance
}

if ($Phase -in @('all', 'validate')) {
  Write-Phase "Phase 4: Validation queries"
  Assert-Password $SaPassword 'DLE_ENTERPRISE_SA_PASSWORD'
  $validateSql = @"
USE DLE_Enterprise;
SELECT 'Employees' AS entity, COUNT(*) AS row_count FROM hris.Employees
UNION ALL SELECT 'PayrollSetup', COUNT(*) FROM hris.EmployeePayrollSetup
UNION ALL SELECT 'PayrollRuns', COUNT(*) FROM hris.PayrollRuns
UNION ALL SELECT 'TimesheetHeaders', COUNT(*) FROM hris.TimesheetHeaders
UNION ALL SELECT 'TimesheetPeriods', COUNT(*) FROM hris.TimesheetPeriods;
"@
  $batches = [regex]::Split($validateSql, '(?im)^\s*GO\s*$') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  Add-Type -AssemblyName System.Data
  $conn = [System.Data.SqlClient.SqlConnection]::new("Server=$DleServerInstance;Database=DLE_Enterprise;User ID=sa;Password=$SaPassword;TrustServerCertificate=True")
  $conn.Open()
  try {
    foreach ($batch in $batches) {
      $cmd = $conn.CreateCommand()
      $cmd.CommandText = $batch
      $adapter = [System.Data.SqlClient.SqlDataAdapter]::new($cmd)
      $table = [System.Data.DataTable]::new()
      [void]$adapter.Fill($table)
      $table | Format-Table -AutoSize
    }
  }
  finally {
    $conn.Close()
    $conn.Dispose()
  }
  Write-Host "Next: open /hris/payroll/sage-migration-review and run parallel payroll for active period." -ForegroundColor Green
}

Write-Phase "Done — Phase: $Phase"

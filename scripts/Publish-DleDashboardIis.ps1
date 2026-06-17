param(
  [string]$OutputPath = "deployment\iis\site",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$AppPath = Join-Path $RepoRoot "apps\dashboard"
$BuildPath = Join-Path $AppPath ".next"
$StandalonePath = Join-Path $BuildPath "standalone"
$ResolvedOutputPath = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputPath))

Push-Location $RepoRoot
try {
  if (-not $SkipInstall) {
    npm ci
  }

  npm run build

  if (-not (Test-Path -LiteralPath $StandalonePath)) {
    throw "Standalone build output was not found at $StandalonePath."
  }

  if (Test-Path -LiteralPath $ResolvedOutputPath) {
    Remove-Item -LiteralPath $ResolvedOutputPath -Recurse -Force
  }

  New-Item -ItemType Directory -Path $ResolvedOutputPath | Out-Null

  Copy-Item -Path (Join-Path $StandalonePath "*") -Destination $ResolvedOutputPath -Recurse -Force

  $StaticTarget = Join-Path $ResolvedOutputPath "apps\dashboard\.next\static"
  New-Item -ItemType Directory -Path $StaticTarget -Force | Out-Null
  Copy-Item -Path (Join-Path $BuildPath "static\*") -Destination $StaticTarget -Recurse -Force

  $PublicTarget = Join-Path $ResolvedOutputPath "apps\dashboard\public"
  New-Item -ItemType Directory -Path $PublicTarget -Force | Out-Null
  Copy-Item -Path (Join-Path $AppPath "public\*") -Destination $PublicTarget -Recurse -Force

  Copy-Item -LiteralPath (Join-Path $RepoRoot "deployment\iis\web.config") -Destination (Join-Path $ResolvedOutputPath "web.config") -Force
  Copy-Item -LiteralPath (Join-Path $RepoRoot "deployment\iis\Start-DleDashboard.ps1") -Destination (Join-Path $ResolvedOutputPath "Start-DleDashboard.ps1") -Force

  Write-Host "IIS deployment package created at $ResolvedOutputPath"
  Write-Host "Run Start-DleDashboard.ps1 as a Windows service, then point IIS at this folder."
}
finally {
  Pop-Location
}

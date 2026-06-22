param(
  [int]$Port = 3010,
  [string]$HostName = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Import-DotEnv {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $Line = $_.Trim()
    if (-not $Line -or $Line.StartsWith("#") -or $Line.IndexOf("=") -lt 1) {
      return
    }

    $Key = $Line.Substring(0, $Line.IndexOf("=")).Trim()
    $Value = $Line.Substring($Line.IndexOf("=") + 1).Trim()
    if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
      $Value = $Value.Substring(1, $Value.Length - 2)
    }

    if (-not [System.Environment]::GetEnvironmentVariable($Key, "Process")) {
      [System.Environment]::SetEnvironmentVariable($Key, $Value, "Process")
    }
  }
}

$CandidateServerPaths = @(
  (Join-Path $ScriptRoot "..\site\apps\dashboard\server.js"),
  (Join-Path $ScriptRoot "apps\dashboard\server.js")
)

$ServerPath = $CandidateServerPaths |
  ForEach-Object { [System.IO.Path]::GetFullPath($_) } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1

if (-not $ServerPath) {
  throw "Could not find apps\dashboard\server.js. Run npm run publish:iis first, then start from the published site folder."
}

$env:NODE_ENV = "production"
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:PORT = [string]$Port
$env:HOSTNAME = $HostName

$RuntimeRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ServerPath))
Import-DotEnv -Path (Join-Path $RuntimeRoot ".env")
Import-DotEnv -Path (Join-Path $RuntimeRoot "apps\dashboard\.env")

Set-Location $RuntimeRoot
node $ServerPath

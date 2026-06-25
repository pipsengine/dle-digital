param(
  [Parameter(Mandatory = $true)][int]$Port
)

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
  Write-Host "No listener on port $Port."
  exit 0
}

foreach ($processId in $pids) {
  try {
    $process = Get-Process -Id $processId -ErrorAction Stop
    Write-Host "Stopping $($process.ProcessName) (PID $processId) on port $Port..."
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not stop PID $processId on port ${Port}: $($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 1
Write-Host "Port $Port is free."

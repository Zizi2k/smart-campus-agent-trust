$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Stopping Smart Campus services..." -ForegroundColor Cyan

# Stop processes on project ports (Hardhat 8545, Backend 3100, Vite 5173, 5175)
$ports = @(8545, 3100, 5173, 5175)
foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      if ($procId -and $procId -ne 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

# Stop Docker Postgres container
Set-Location $projectRoot
docker compose stop

Write-Host ""
Write-Host "All Smart Campus services stopped successfully." -ForegroundColor Green

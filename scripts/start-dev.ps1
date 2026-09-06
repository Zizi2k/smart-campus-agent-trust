$projectRoot =
  "C:\smart-campus-agent-trust"

Write-Host "Starting PostgreSQL..." `
  -ForegroundColor Cyan

Set-Location $projectRoot
docker compose up -d postgres

if ($LASTEXITCODE -ne 0) {
  Write-Host `
    "Cannot start PostgreSQL. Check Docker Desktop." `
    -ForegroundColor Red

  exit 1
}Write-Host `
  "Synchronizing agents and permissions..." `
  -ForegroundColor Cyan

Set-Location "$projectRoot\backend"
npm run sync:blockchain

if ($LASTEXITCODE -ne 0) {
  Write-Host `
    "Blockchain synchronization failed." `
    -ForegroundColor Red

  exit 1
}

Write-Host "Starting Hardhat Node..." `
  -ForegroundColor Cyan

Start-Process powershell `
  -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot\contracts'; npx hardhat node"
  )

Start-Sleep -Seconds 4

Write-Host "Deploying smart contract..." `
  -ForegroundColor Cyan

Set-Location "$projectRoot\contracts"

npx hardhat ignition deploy `
  ".\ignition\modules\CampusAgentRegistry.ts" `
  --network localhost `
  --reset

if ($LASTEXITCODE -ne 0) {
  Write-Host `
    "Contract deployment failed." `
    -ForegroundColor Red

  exit 1
}

Write-Host "Starting backend..." `
  -ForegroundColor Cyan

Start-Process powershell `
  -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot\backend'; npm run dev"
  )

Write-Host "Starting frontend..." `
  -ForegroundColor Cyan

Start-Process powershell `
  -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot\frontend'; npm run dev"
  )

Write-Host ""
Write-Host "Smart Campus started." `
  -ForegroundColor Green

Write-Host "Backend:  http://localhost:3100"
Write-Host "Frontend: http://127.0.0.1:5175"
Write-Host "RPC:      http://127.0.0.1:8545"
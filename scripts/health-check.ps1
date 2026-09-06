Write-Host "Checking Smart Campus..." `
  -ForegroundColor Cyan

try {
  $database =
    Invoke-RestMethod `
      "http://localhost:3100/health"

  Write-Host `
    "Database: $($database.database)" `
    -ForegroundColor Green
} catch {
  Write-Host `
    "Backend or database unavailable" `
    -ForegroundColor Red
}

try {
  $chain =
    Invoke-RestMethod `
      "http://localhost:3100/health/blockchain"

  Write-Host `
    "Blockchain: $($chain.blockchain.connected)" `
    -ForegroundColor Green

  Write-Host `
    "Contract: $($chain.blockchain.contractDeployed)" `
    -ForegroundColor Green

  Write-Host `
    "Admin role: $($chain.blockchain.signerHasAdminRole)" `
    -ForegroundColor Green
} catch {
  Write-Host `
    "Blockchain unavailable" `
    -ForegroundColor Red
}
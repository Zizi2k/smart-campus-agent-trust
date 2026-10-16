# ==============================================================================
# SMART CAMPUS AGENT TRUST · ĐÓNG GÓI BÀI NỘP CUỐI KỲ (ZIP PACKAGER)
# Tự động loại bỏ: node_modules, .git, dist, cache, artifacts
# ==============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $projectRoot
$stagingDir = Join-Path $parentDir "staging_pack"
$zipPath = Join-Path $parentDir "Nhom2_DeTai2_SmartCampusAgentTrust.zip"

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "   SMART CAMPUS TRUST - DONG GOI BAI NOP CUOI KY       " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "1. Dang sao chep ma nguon tinh gon (loai bo node_modules, .git)..." -ForegroundColor Yellow

if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
}

robocopy $projectRoot $stagingDir /E /XD node_modules .git dist artifacts cache .tempmediaStorage /XF *.zip | Out-Null

Write-Host "2. Dang nen tep tin zip: $zipPath..." -ForegroundColor Yellow

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath -Force

Write-Host "3. Don dep thu muc dem..." -ForegroundColor Yellow
Remove-Item $stagingDir -Recurse -Force

$zipItem = Get-Item $zipPath
$sizeMB = [math]::Round($zipItem.Length / 1MB, 2)

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "DONG GOI BAI NOP THANH CONG!" -ForegroundColor Green
Write-Host "  - File: $($zipItem.FullName)" -ForegroundColor White
Write-Host "  - Dung luong: $sizeMB MB (Sieu nhe, sach se, chuan nop)" -ForegroundColor Yellow
Write-Host "=======================================================`n" -ForegroundColor Green

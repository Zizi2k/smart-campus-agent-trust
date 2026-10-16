# ==============================================================================
# SMART CAMPUS AGENT TRUST · RESET DATABASE TIỆN ÍCH
# Làm sạch dữ liệu kiểm thử (Action Requests, Approvals, Executions, Permissions, Agents)
# Duy trì an toàn tài khoản Quản trị viên (Admin: admin / campuspassword123)
# ==============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "   SMART CAMPUS TRUST · DATABASE RESET UTILITY         " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Đang làm sạch dữ liệu kiểm thử (Executions, Approvals, Requests, Agents)..." -ForegroundColor Yellow
Write-Host "Bảo toàn tài khoản Admin an toàn...`n" -ForegroundColor Green

# Tự động kiểm tra và khởi động PostgreSQL container nếu chưa chạy
$postgresRunning = docker ps --filter "name=smart-campus-postgres" --filter "status=running" -q
if (-not $postgresRunning) {
    Write-Host "PostgreSQL container chưa chạy. Đang tự động khởi động qua Docker Compose..." -ForegroundColor Yellow
    Set-Location $projectRoot
    docker compose up -d postgres
    Start-Sleep -Seconds 3
}

Set-Location "$projectRoot\backend"
npx tsx src/scripts/resetData.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=======================================================" -ForegroundColor Green
    Write-Host "✓ RESET DỮ LIỆU THÀNH CÔNG!" -ForegroundColor Green
    Write-Host "Tài khoản đăng nhập quản trị không đổi:" -ForegroundColor White
    Write-Host "  - Username: admin" -ForegroundColor Yellow
    Write-Host "  - Password: campuspassword123" -ForegroundColor Yellow
    Write-Host "Giao diện Web sẵn sàng cho một kịch bản test mới hoàn toàn!" -ForegroundColor Cyan
    Write-Host "=======================================================`n" -ForegroundColor Green
} else {
    Write-Host "`n❌ Có lỗi xảy ra khi làm sạch cơ sở dữ liệu." -ForegroundColor Red
}

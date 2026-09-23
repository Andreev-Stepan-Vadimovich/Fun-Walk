$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Npm = Join-Path $env:ProgramFiles "nodejs\npm.cmd"

if (-not (Test-Path $Npm)) {
  Write-Error "npm.cmd не найден. Установите Node.js: https://nodejs.org/"
}

Write-Host ""
Write-Host "Fun-Walk — перезапуск backend" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Освобождаю порт 3000..."
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host "      Завершаю PID $($_.OwningProcess)"
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }

Start-Sleep -Seconds 2

$EnvFile = Join-Path $Backend ".env"
if (-not (Test-Path $EnvFile)) {
  Copy-Item (Join-Path $Backend ".env.example") $EnvFile -ErrorAction SilentlyContinue
  Write-Host "[2/3] Создан backend\.env"
} else {
  Write-Host "[2/3] backend\.env найден"
}

Write-Host "[3/3] Запуск backend..."
Write-Host "      API: http://127.0.0.1:3000/api/health"
Write-Host ""

Start-Process cmd -ArgumentList "/k", "cd /d `"$Backend`" && npm.cmd run start:dev" -WindowStyle Normal

Write-Host "Backend запущен в новом окне." -ForegroundColor Green
Write-Host "Frontend: scripts\start-frontend.bat или npm run dev из корня проекта"
Write-Host ""

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Npm = Join-Path $env:ProgramFiles "nodejs\npm.cmd"

if (-not (Test-Path $Npm)) {
  Write-Error "npm.cmd не найден. Установите Node.js: https://nodejs.org/"
}

$Quick = $args -contains "quick"

if (-not $Quick) {
  Write-Host "==> Установка зависимостей..."
  & $Npm install --prefix $Root
  & $Npm install --prefix "$Root\backend"
  & $Npm install --prefix "$Root\frontend"

  $EnvFile = Join-Path $Root "backend\.env"
  if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $Root "backend\.env.example") $EnvFile
    Write-Host "==> Создан backend\.env"
  }
}

Write-Host "==> Запуск backend + frontend..."
Write-Host "    Остановка: Ctrl+C один раз"
Write-Host ""

Set-Location $Root
& $Npm run dev

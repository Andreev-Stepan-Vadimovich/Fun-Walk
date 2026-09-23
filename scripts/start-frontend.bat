@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] npm.cmd не найден.
  pause
  exit /b 1
)

echo Запуск frontend в новом окне...
echo Откройте: http://127.0.0.1:5173
echo.

start "Fun-Walk Frontend" cmd /k "cd /d \"%FRONTEND%\" && npm.cmd run dev"

pause

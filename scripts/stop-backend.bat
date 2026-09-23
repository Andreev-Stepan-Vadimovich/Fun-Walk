@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo Останавливаю backend (порт 3000)...

set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo   taskkill PID %%a
  taskkill /F /PID %%a >nul 2>&1
  set "FOUND=1"
)

if "%FOUND%"=="0" (
  echo Backend не запущен — порт 3000 свободен.
) else (
  echo Backend остановлен.
)

pause

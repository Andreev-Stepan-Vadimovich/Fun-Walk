@echo off
setlocal

set "ROOT=%~dp0.."
cd /d "%ROOT%"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm.cmd не найден. Добавьте Node.js в PATH или перезапустите Cursor.
  pause
  exit /b 1
)

if /i "%~1"=="quick" goto :run

echo ==^> Установка зависимостей...
call npm.cmd install --prefix "%ROOT%"
call npm.cmd install --prefix "%ROOT%\backend"
call npm.cmd install --prefix "%ROOT%\frontend"

if not exist "%ROOT%\backend\.env" (
  copy "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
  echo ==^> Создан backend\.env
)

:run
echo ==^> Запуск backend + frontend...
echo     Остановка: один раз Ctrl+C, затем Y если спросит
echo     Быстрый перезапуск: scripts\dev.bat quick
echo.

cd /d "%ROOT%"
npm.cmd run dev
exit /b %ERRORLEVEL%

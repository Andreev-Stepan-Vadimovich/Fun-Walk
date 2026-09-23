@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0.."
set "BACKEND=%ROOT%\backend"

echo.
echo ========================================
echo   Fun-Walk — перезапуск backend
echo ========================================
echo.

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] npm.cmd не найден.
  echo Установите Node.js: https://nodejs.org/
  echo Затем перезапустите Cursor.
  pause
  exit /b 1
)

echo [1/3] Освобождаю порт 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo       Завершаю процесс PID %%a
  taskkill /F /PID %%a >nul 2>&1
)

ping 127.0.0.1 -n 3 >nul

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [ПРЕДУПРЕЖДЕНИЕ] Порт 3000 всё ещё занят. Закройте другие терминалы с backend.
) else (
  echo       Порт 3000 свободен.
)

if not exist "%BACKEND%\.env" (
  if exist "%BACKEND%\.env.example" (
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo [2/3] Создан backend\.env
  )
) else (
  echo [2/3] backend\.env найден
)

echo [3/3] Запуск backend в новом окне...
echo       API: http://127.0.0.1:3000/api/health
echo       Закрыть backend: закройте окно «Fun-Walk Backend» или Ctrl+C в нём
echo.

start "Fun-Walk Backend" cmd /k "cd /d \"%BACKEND%\" && npm.cmd run start:dev"

echo.
echo Готово. Backend запускается в отдельном окне.
echo Если frontend не открыт — запустите scripts\start-frontend.bat
echo.
pause

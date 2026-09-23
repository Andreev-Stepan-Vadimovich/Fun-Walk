@echo off
REM Перезапуск backend (освобождает порт 3000 и запускает API)
call "%~dp0restart-backend.bat"

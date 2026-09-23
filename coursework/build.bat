@echo off
REM Wrapper: calls build.ps1 (DOCX only)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
exit /b %ERRORLEVEL%

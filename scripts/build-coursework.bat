@echo off
REM Сборка курсовой работы Fun-Walk: PDF + DOCX
REM Использование: scripts\build.bat   или   cd coursework && build.bat

cd /d "%~dp0.."
if not exist "coursework\main.tex" (
  echo [ERROR] Не найден coursework\main.tex
  exit /b 1
)

cd coursework
call build.bat
exit /b %ERRORLEVEL%

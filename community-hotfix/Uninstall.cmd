@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-Hotfix.ps1"
set "result=%errorlevel%"
echo.
if not "%result%"=="0" echo Uninstall failed with exit code %result%.
pause
exit /b %result%

@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0runtime\Collect-Diagnostics.ps1" %*
set "result=%errorlevel%"
echo.
if not "%result%"=="0" echo Diagnostics failed with exit code %result%.
pause
exit /b %result%

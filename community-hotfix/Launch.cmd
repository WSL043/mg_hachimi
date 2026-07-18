@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0runtime\Launch-Hotfix.ps1" %*
set "result=%errorlevel%"
echo.
if not "%result%"=="0" pause
exit /b %result%

@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch-Hotfix.ps1" -Region Worldwide
set "result=%errorlevel%"
echo.
if not "%result%"=="0" pause
exit /b %result%

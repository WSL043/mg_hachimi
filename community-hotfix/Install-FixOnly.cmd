@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Hotfix.ps1" -Edition FixOnly -NonInteractive
set "result=%errorlevel%"
echo.
if not "%result%"=="0" echo Installation failed with exit code %result%.
pause
exit /b %result%

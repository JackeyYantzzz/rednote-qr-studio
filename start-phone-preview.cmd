@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-phone-preview.ps1"
set "preview_exit=%errorlevel%"

echo.
if not "%preview_exit%"=="0" echo Phone preview stopped with error code %preview_exit%.
echo Press any key to close this window.
pause >nul

exit /b %preview_exit%

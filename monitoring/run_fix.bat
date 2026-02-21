@echo off
cd /d "%~dp0"
echo Requesting Administrator privileges...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: Requires Administrator privileges.
    echo Right-click and "Run as Administrator".
    pause
    exit /b
)

echo Running Fix Script...
powershell -ExecutionPolicy Bypass -File ".\fix_and_install_services.ps1"
pause

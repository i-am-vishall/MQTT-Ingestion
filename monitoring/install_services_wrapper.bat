@echo off
cd /d "%~dp0"
echo Requesting Administrator privileges...

:: Check for Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as Administrator".
    pause
    exit /b
)

echo Running Installation Script...
powershell -ExecutionPolicy Bypass -File ".\install_i2v_services.ps1"
pause

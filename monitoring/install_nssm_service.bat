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

echo Running NSSM Setup Script...
powershell -ExecutionPolicy Bypass -File ".\setup_nssm_service.ps1"
pause

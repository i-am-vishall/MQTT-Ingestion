@echo off
:: Enable UTF-8
chcp 65001 >nul

echo ========================================================
echo   MQTT Ingestion Service - Production Uninstaller
echo ========================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Administrator privileges confirmed.
) else (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click and select "Run as administrator".
    pause
    exit /B 1
)

echo [INFO] Stopping service...
sc stop "MQTT Ingestion Service"
timeout /T 5 /NOBREAK >nul

echo [INFO] Deleting service...
sc delete "MQTT Ingestion Service"

if %errorLevel% == 0 (
    echo [INFO] Service deleted successfully.
) else (
    echo [WARN] Service might not have been deleted (it may not exist).
)

echo.
echo ========================================================
echo   Uninstallation Completed!
echo ========================================================
pause

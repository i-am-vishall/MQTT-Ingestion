@echo off
REM I2V System Uninstallation Script
REM Run as Administrator

echo I2V MQTT Ingestion System - Uninstallation
echo.

setlocal enabledelayedexpansion

set "SERVICE_NAME_INGESTION=I2V-Ingestion-Service"
set "SERVICE_NAME_CONFIG=I2V-Config-Service"

REM Check admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    pause
    exit /b 1
)

echo Stopping and removing services...
sc stop !SERVICE_NAME_INGESTION! >nul 2>&1
timeout /T 5 /NOBREAK >nul
sc delete !SERVICE_NAME_INGESTION! >nul 2>&1

sc stop !SERVICE_NAME_CONFIG! >nul 2>&1
timeout /T 5 /NOBREAK >nul
sc delete !SERVICE_NAME_CONFIG! >nul 2>&1

echo Services removed
echo.
echo Uninstallation completed.
echo.
pause

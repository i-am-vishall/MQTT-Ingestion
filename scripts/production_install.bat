@echo off
REM I2V System Installation Script
REM Run as Administrator

echo.
echo Installation Script - I2V MQTT Ingestion System
echo.

setlocal enabledelayedexpansion

REM Variables
set "INSTALL_DIR=%~dp0"
set "SERVICE_NAME_INGESTION=I2V-Ingestion-Service"
set "SERVICE_NAME_CONFIG=I2V-Config-Service"
set "BIN_DIR=!INSTALL_DIR!bin"
set "LOG_DIR=!INSTALL_DIR!logs"

REM Check admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    pause
    exit /b 1
)

echo [1/4] Installing Ingestion Service...
sc create !SERVICE_NAME_INGESTION! binPath= "!BIN_DIR!\i2v-ingestion-service.exe" start= auto
sc failure !SERVICE_NAME_INGESTION! reset= 0 actions= restart/60000/restart/60000/restart/60000
sc start !SERVICE_NAME_INGESTION!
echo Services installed and started

echo [2/4] Installing Config Service...
sc create !SERVICE_NAME_CONFIG! binPath= "!BIN_DIR!\i2v-config-service.exe" start= auto
sc failure !SERVICE_NAME_CONFIG! reset= 0 actions= restart/60000/restart/60000/restart/60000
sc start !SERVICE_NAME_CONFIG!

echo [3/4] Setting file permissions...
icacls "!INSTALL_DIR!" /grant:r "%USERNAME%":(OI)(CI)F /T >nul 2>&1
icacls "!LOG_DIR!" /grant:r "%USERNAME%":(OI)(CI)F /T >nul 2>&1

echo [4/4] System ready!
echo.
echo Installation completed successfully!
echo.
echo Next steps:
echo   1. Edit .env with your settings
echo   2. Run database initialization scripts
echo   3. Extract Redis.zip and start Redis server
echo   4. Access Config UI at http://localhost:3001
echo.
pause

@echo off
:: ============================================================
:: I2V Smart City - Service Update & Permission Fix Script
:: Run this as Administrator to fix all permission issues
:: ============================================================

setlocal EnableDelayedExpansion

echo ============================================================
echo  I2V Smart City - Service Update Script
echo  MUST BE RUN AS ADMINISTRATOR
echo ============================================================
echo.

:: Check for Admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as Administrator"
    pause
    exit /b 1
)

set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "SOURCE_DIR=C:\Users\mevis\MQTT-Ingetsion\dist\I2V_Smart_City_Release_v1.0.2"

echo [1/6] Stopping all services...
net stop "i2v-config-ui" 2>nul
net stop "i2v-MQTT-Ingestion-Service" 2>nul
net stop "i2v-telegraf" 2>nul
net stop "i2v-influxdb" 2>nul
timeout /t 3 /nobreak >nul

echo [2/6] Killing any remaining processes...
taskkill /F /IM "i2v-config-service.exe" 2>nul
taskkill /F /IM "i2v-ingestion-service.exe" 2>nul
taskkill /F /IM "telegraf.exe" 2>nul
timeout /t 2 /nobreak >nul

echo [3/6] Copying updated executables...
if exist "%SOURCE_DIR%\i2v-config-service.exe" (
    copy /Y "%SOURCE_DIR%\i2v-config-service.exe" "%INSTALL_DIR%\i2v-config-service.exe"
    echo    - Config Service: Updated
) else (
    echo    - Config Service: Source not found, skipping
)

if exist "%SOURCE_DIR%\dist_package\i2v-ingestion-service.exe" (
    copy /Y "%SOURCE_DIR%\dist_package\i2v-ingestion-service.exe" "%INSTALL_DIR%\dist_package\i2v-ingestion-service.exe"
    echo    - Ingestion Service: Updated
) else (
    echo    - Ingestion Service: Source not found, skipping
)

if exist "%SOURCE_DIR%\db\init_schema.sql" (
    copy /Y "%SOURCE_DIR%\db\init_schema.sql" "%INSTALL_DIR%\db\init_schema.sql"
    echo    - Database Schema: Updated
)

echo [4/6] Fixing folder permissions...
icacls "%INSTALL_DIR%" /grant "NETWORK SERVICE":(OI)(CI)F /T >nul 2>&1
icacls "%INSTALL_DIR%" /grant "LOCAL SERVICE":(OI)(CI)F /T >nul 2>&1
icacls "%INSTALL_DIR%" /grant Users:(OI)(CI)F /T >nul 2>&1
icacls "%INSTALL_DIR%\logs" /grant Everyone:(OI)(CI)F /T >nul 2>&1
echo    - Permissions fixed for: %INSTALL_DIR%

echo [5/6] Setting service recovery options...
sc failure "i2v-MQTT-Ingestion-Service" reset=86400 actions=restart/5000/restart/10000/restart/30000 >nul 2>&1
sc failure "i2v-config-ui" reset=86400 actions=restart/5000/restart/10000/restart/30000 >nul 2>&1
sc failure "i2v-telegraf" reset=86400 actions=restart/5000/restart/10000/restart/30000 >nul 2>&1
sc failure "i2v-influxdb" reset=86400 actions=restart/5000/restart/10000/restart/30000 >nul 2>&1
echo    - Auto-restart on failure enabled

echo [6/6] Starting all services...
net start "i2v-mqtt-ingestion-PGSQL-5441" 2>nul
timeout /t 3 /nobreak >nul
net start "i2v-MQTT-Ingestion-Service" 2>nul
net start "i2v-config-ui" 2>nul
net start "i2v-telegraf" 2>nul
net start "i2v-influxdb" 2>nul

echo.
echo ============================================================
echo  UPDATE COMPLETE!
echo ============================================================
echo.
echo Checking service status...
echo.
sc query "i2v-config-ui" | findstr "STATE"
sc query "i2v-MQTT-Ingestion-Service" | findstr "STATE"
sc query "i2v-mqtt-ingestion-PGSQL-5441" | findstr "STATE"
echo.
echo Access the Config UI at: http://localhost:3001
echo.
pause

@echo off
TITLE i2V MQTT Ingestion Uninstaller
cd /d "%~dp0"

set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "PG_SERVICE_NAME=i2v-mqtt-ingestion-PGSQL-5441"
set "APP_SERVICE_NAME=i2v-MQTT-Ingestion-Service"

echo ===================================================
echo      i2V MQTT Ingestion Uninstaller
echo ===================================================

echo [Step 1] Stopping Services...
net stop "%PG_SERVICE_NAME%" >nul 2>&1
sc delete "%PG_SERVICE_NAME%" >nul 2>&1
net stop "%APP_SERVICE_NAME%" >nul 2>&1
sc delete "%APP_SERVICE_NAME%" >nul 2>&1
net stop "MQTT_Ingestion_Service" >nul 2>&1
sc delete "MQTT_Ingestion_Service" >nul 2>&1

echo [Step 2] Cleaning up Processes...
:: Kill specific generic processes
taskkill /F /IM "mqtt-ingestion-service.exe" >nul 2>&1
taskkill /F /IM "postgres.exe" >nul 2>&1
taskkill /F /IM "pg_ctl.exe" >nul 2>&1
taskkill /F /IM "service-wrapper.exe" >nul 2>&1

:: Kill processes running from the Install Dir (Catch-all)
wmic process where "ExecutablePath like '%%i2v-MQTT-Ingestion%%'" call terminate >nul 2>&1

:: Kill Port 5441
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5441" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [Step 3] Removing Files...
timeout /t 2 /nobreak >nul
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
    
    if exist "%INSTALL_DIR%" (
        echo [RETRY] Folder still locked. Waiting 3 seconds...
        timeout /t 3 /nobreak >nul
        rmdir /s /q "%INSTALL_DIR%"
    )
    
    if exist "%INSTALL_DIR%" (
        echo.
        echo [WARNING] Could not delete folder!
        echo ----------------------------------------------------
        echo CAUSE: You probably have the folder open in File Explorer.
        echo ACTION: Please CLOSE all folders and run this script again.
        echo ----------------------------------------------------
        pause
    ) else (
        echo Cleanup Successful.
    )
) else (
    echo Folder already removed.
)

echo ===================================================
echo      UNINSTALL COMPLETED
echo ===================================================
pause

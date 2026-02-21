@echo off
setlocal
TITLE I2V Service Recovery Fixer

echo ===================================================
echo      I2V Service Recovery Fixer
echo      Run this as ADMINISTRATOR
echo ===================================================
echo.

:: Check Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run as Administrator!
    pause
    exit /b 1
)

set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "NSSM=%INSTALL_DIR%\utils\nssm.exe"

echo [1/4] Closing conflicting applications...
echo      - Killing Services UI (mmc.exe) to release locks...
taskkill /F /IM mmc.exe >nul 2>&1
echo      - Killing stuck NSSM processes...
taskkill /F /IM nssm.exe >nul 2>&1
echo      - Killing stuck Service processes...
taskkill /F /IM i2v-ingestion-service.exe >nul 2>&1
taskkill /F /IM influxdb3.exe >nul 2>&1
taskkill /F /IM i2v-influxdb.exe >nul 2>&1
taskkill /F /IM i2v-config-service.exe >nul 2>&1
taskkill /F /IM telegraf.exe >nul 2>&1

echo [2/4] Removing stuck services...
net stop i2v-MQTT-Ingestion-Service >nul 2>&1
sc delete i2v-MQTT-Ingestion-Service >nul 2>&1
net stop i2v-influxdb >nul 2>&1
sc delete i2v-influxdb >nul 2>&1
net stop i2v-config-ui >nul 2>&1
sc delete i2v-config-ui >nul 2>&1
net stop i2v-telegraf >nul 2>&1
sc delete i2v-telegraf >nul 2>&1

echo      Waiting for Windows to clear 'marked for deletion' state...
timeout /t 10 /nobreak >nul

:: Verification Loop
:CheckLoop
sc query i2v-MQTT-Ingestion-Service >nul 2>&1
if %errorlevel% equ 0 (
    echo      - Service still exists. Waiting 5s more...
    timeout /t 5 /nobreak >nul
    goto CheckLoop
)
sc query i2v-config-ui >nul 2>&1
if %errorlevel% equ 0 (
    echo      - Service still exists. Waiting 5s more...
    timeout /t 5 /nobreak >nul
    goto CheckLoop
)
sc query i2v-influxdb >nul 2>&1
if %errorlevel% equ 0 (
    echo      - Service still exists. Waiting 5s more...
    timeout /t 5 /nobreak >nul
    goto CheckLoop
)
sc query i2v-telegraf >nul 2>&1
if %errorlevel% equ 0 (
    echo      - Service still exists. Waiting 5s more...
    timeout /t 5 /nobreak >nul
    goto CheckLoop
)

echo [3/4] Reinstalling with Auto-Restart enabled...

:: Ingestion Service
"%NSSM%" install "i2v-MQTT-Ingestion-Service" "%INSTALL_DIR%\dist_package\i2v-ingestion-service.exe"
"%NSSM%" set "i2v-MQTT-Ingestion-Service" AppDirectory "%INSTALL_DIR%"
"%NSSM%" set "i2v-MQTT-Ingestion-Service" Description "I2V MQTT Ingestion Core"
"%NSSM%" set "i2v-MQTT-Ingestion-Service" AppStdout "%INSTALL_DIR%\logs\ingestion-service.log"
"%NSSM%" set "i2v-MQTT-Ingestion-Service" AppStderr "%INSTALL_DIR%\logs\ingestion-service.log"
:: Configure NSSM to restart the application if it dies
"%NSSM%" set "i2v-MQTT-Ingestion-Service" AppExit Default Restart
"%NSSM%" set "i2v-MQTT-Ingestion-Service" AppThrottle 1500

:: Configure Windows Service Manager to restart the service if NSSM itself dies
sc failure "i2v-MQTT-Ingestion-Service" reset= 86400 actions= restart/60000/restart/60000/restart/60000

:: Config UI Service
"%NSSM%" install "i2v-config-ui" "%INSTALL_DIR%\i2v-config-service.exe"
"%NSSM%" set "i2v-config-ui" AppDirectory "%INSTALL_DIR%"
"%NSSM%" set "i2v-config-ui" Description "I2V Configuration Backend"
"%NSSM%" set "i2v-config-ui" AppEnvironmentExtra "PORT=3001"
"%NSSM%" set "i2v-config-ui" AppStdout "%INSTALL_DIR%\logs\config-service.log"
"%NSSM%" set "i2v-config-ui" AppStderr "%INSTALL_DIR%\logs\config-service.log"
"%NSSM%" set "i2v-config-ui" AppExit Default Restart
"%NSSM%" set "i2v-config-ui" AppThrottle 1500
sc failure "i2v-config-ui" reset= 86400 actions= restart/60000/restart/60000/restart/60000

:: InfluxDB
"%NSSM%" install "i2v-influxdb" "%INSTALL_DIR%\monitoring\influxdb\influxdb3.exe"
"%NSSM%" set "i2v-influxdb" AppDirectory "%INSTALL_DIR%\monitoring\influxdb"
"%NSSM%" set "i2v-influxdb" AppParameters "serve --node-id node1 --object-store file --data-dir \"%INSTALL_DIR%\monitoring\influxdb\data\" --http-bind 127.0.0.1:8088 --admin-token-file \"%INSTALL_DIR%\monitoring\influxdb\admin_token.txt\""
"%NSSM%" set "i2v-influxdb" AppStdout "%INSTALL_DIR%\logs\influx_service.log"
"%NSSM%" set "i2v-influxdb" AppStderr "%INSTALL_DIR%\logs\influx_service.log"
"%NSSM%" set "i2v-influxdb" AppExit Default Restart
sc failure "i2v-influxdb" reset= 86400 actions= restart/60000/restart/60000/restart/60000

:: Telegraf
"%NSSM%" install "i2v-telegraf" "%INSTALL_DIR%\monitoring\telegraf\telegraf-1.29.1\telegraf.exe"
"%NSSM%" set "i2v-telegraf" AppDirectory "%INSTALL_DIR%\monitoring"
"%NSSM%" set "i2v-telegraf" AppParameters "--config \"%INSTALL_DIR%\monitoring\telegraf.conf\""
"%NSSM%" set "i2v-telegraf" AppStdout "%INSTALL_DIR%\monitoring\telegraf.log"
"%NSSM%" set "i2v-telegraf" AppStderr "%INSTALL_DIR%\monitoring\telegraf.log"
"%NSSM%" set "i2v-telegraf" AppExit Default Restart
sc failure "i2v-telegraf" reset= 86400 actions= restart/60000/restart/60000/restart/60000

echo [3/4] Starting Services...
net start i2v-MQTT-Ingestion-Service
net start i2v-config-ui
net start i2v-influxdb
net start i2v-telegraf

echo.
echo ===================================================
echo      Fix Complete!
echo ===================================================
pause

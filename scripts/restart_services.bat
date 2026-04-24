@echo off
TITLE Restarting I2V Services...
cd /d "%~dp0"

echo [INFO] Stopping Services...
net stop "i2v-MQTT-Ingestion-Service" >nul 2>&1
net stop "i2v-Config-Service" >nul 2>&1
net stop "i2v-Config-UI" >nul 2>&1
net stop "i2v-mqtt-ingestion-PGSQL-5441" >nul 2>&1
net stop "i2v-influxdb" >nul 2>&1
net stop "i2v-telegraf" >nul 2>&1

echo [INFO] Waiting for 5 seconds...
timeout /t 5 /nobreak >nul

echo [INFO] Starting Services...
net start "i2v-mqtt-ingestion-PGSQL-5441" >nul 2>&1
net start "i2v-influxdb" >nul 2>&1
net start "i2v-telegraf" >nul 2>&1
net start "i2v-MQTT-Ingestion-Service" >nul 2>&1

:: Attempt to start both potential service names for Config UI
net start "i2v-Config-Service" >nul 2>&1
net start "i2v-Config-UI" >nul 2>&1

echo [INFO] Services Restarted.
exit

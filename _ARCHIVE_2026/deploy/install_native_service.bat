@echo off
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Requesting Admin privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [INFO] Stopping Old Service...
net stop "MQTT_Ingestion_Service"
sc delete "MQTT_Ingestion_Service"

echo [INFO] Installing Service Wrapper (Fixes Error 1053)...
cd "c:\Users\mevis\MQTT-Ingetsion\ingestion-service"
node scripts/install_wrapper.js

echo [SUCCESS] Service Replaced.
timeout /t 5

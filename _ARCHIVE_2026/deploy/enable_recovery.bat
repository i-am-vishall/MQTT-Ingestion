@echo off
TITLE Enable Service Recovery
echo Configuring Auto-Restart for MQTT_Ingestion_Service...
sc failure "MQTT_Ingestion_Service" reset= 0 actions= restart/5000/restart/10000/restart/60000
if errorlevel 1 (
    echo [ERROR] Failed to set failure actions. Run as Admin.
    pause
    exit /b 1
)
echo [SUCCESS] Service configured to restart on failure.
sc qfailure "MQTT_Ingestion_Service"
pause

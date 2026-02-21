@echo off
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Requesting Admin privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [INFO] Admin rights confirmed.
echo [INFO] Configuring service to Auto-Start...
echo [INFO] Configuring service to Auto-Start...
sc config "i2v-MQTT-Ingestion-Service" start= auto

echo [INFO] Configuring Auto-Restart on Crash...
sc failure "i2v-MQTT-Ingestion-Service" reset= 0 actions= restart/5000/restart/10000/restart/60000

echo [INFO] Starting Service...
net start "i2v-MQTT-Ingestion-Service"

if errorlevel 1 (
    echo [ERROR] Failed to start service. It might be already running or disabled.
) else (
    echo [SUCCESS] Service started successfully.
)

echo.
echo Checking status:
sc query "i2v-MQTT-Ingestion-Service" | find "STATE"
timeout /t 10

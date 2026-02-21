@echo off
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Requesting Admin privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [INFO] Stopping Service...
net stop "MQTT_Ingestion_Service"

echo [INFO] Replacing Executable...
copy /Y "c:\Users\mevis\MQTT-Ingetsion\ingestion-service\dist\mqtt-ingestion-service-v4.exe" "C:\Program Files (x86)\i2v-MQTT-Ingestion\mqtt-ingestion-service.exe"

if errorlevel 1 (
    echo [ERROR] Failed to copy file. Is the service truly stopped?
    pause
    exit /b 1
)

echo [INFO] Starting Service...
net start "MQTT_Ingestion_Service"

echo [SUCCESS] Service Updated.
timeout /t 5

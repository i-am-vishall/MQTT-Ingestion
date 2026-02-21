@echo off
setlocal
echo [INFO] Checking for Administrator privileges...
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [INFO] Requesting Admin rights...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ===================================================
echo   I2V MQTT Ingestion Service - Applying Hotfix
echo ===================================================
echo.

echo [STEP 1] Stopping Service...
net stop "i2v-mqtt-ingestion-service"

echo.
echo [STEP 2] Overwriting Service Executable...
copy /Y "c:\Users\mevis\MQTT-Ingetsion\dist_package\mqtt-ingestion-service.exe" "c:\Users\mevis\MQTT-Ingetsion\ingestion-service\dist\mqtt-ingestion-service-v4.exe"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to copy file!
    pause
    exit /b
)

echo.
echo [STEP 3] Starting Service...
net start "i2v-mqtt-ingestion-service"

echo.
echo [SUCCESS] Hotfix applied successfully.
echo You can close this window.
pause

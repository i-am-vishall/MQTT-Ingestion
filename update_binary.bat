@echo off
echo ===================================================
echo      Updating Service Binary
echo ===================================================
echo.
echo [1/3] Stopping i2v-mqtt-ingestion-service...
net stop "i2v-mqtt-ingestion-service"

echo.
echo [2/3] Restoring Wrapper and Updating App...
:: Restore the Service Wrapper (The "Service" itself)
copy /Y "C:\Users\mevis\MQTT-Ingetsion\dist_package\service-wrapper.exe" "C:\Users\mevis\MQTT-Ingetsion\ingestion-service\dist\daemon\mqtt_ingestion_service.exe"

:: Update the Application Binary (The "Code" run by the wrapper)
:: XML points to mqtt-ingestion-service-v4.exe, so we overwrite THAT.
copy /Y "C:\Users\mevis\MQTT-Ingetsion\dist_package\mqtt-ingestion-service.exe" "C:\Users\mevis\MQTT-Ingetsion\ingestion-service\dist\mqtt-ingestion-service-v4.exe"

:: Ensure .env is available
copy /Y "C:\Users\mevis\MQTT-Ingetsion\ingestion-service\.env" "C:\Users\mevis\MQTT-Ingetsion\ingestion-service\dist\daemon\.env"

echo.
echo [3/3] Starting i2v-mqtt-ingestion-service...
net start "i2v-mqtt-ingestion-service"

echo.
echo ===================================================
echo                 UPDATE COMPLETE
echo ===================================================
pause

@echo off
echo ===================================================
echo      I2V MQTT Ingestion Service Fixer
echo ===================================================
echo This script will remove duplicate services and 
echo register the correct "i2v-mqtt-ingestion-service".
echo.
echo IMPORTANT: Run this as Administrator!
echo.
pause

echo.
echo [1/4] Stopping potential conflicting services...
net stop "MQTT Ingestion Service" 2>nul
net stop "MQTT_Ingestion_Service" 2>nul
net stop "mqtt_ingestion_service.exe" 2>nul
net stop "i2v-mqtt-ingestion-service" 2>nul

echo.
echo [2/4] Removing old/duplicate services...
sc delete "MQTT Ingestion Service" 2>nul
sc delete "MQTT_Ingestion_Service" 2>nul
sc delete "mqtt_ingestion_service.exe" 2>nul
:: Delete the target one just in case we need to recreate cleanly
sc delete "i2v-mqtt-ingestion-service" 2>nul

echo.
echo [3/4] Creating new service: i2v-mqtt-ingestion-service
sc create "i2v-mqtt-ingestion-service" binPath= "C:\Users\mevis\MQTT-Ingetsion\ingestion-service\dist\daemon\mqtt_ingestion_service.exe" start= auto displayname= "I2V MQTT Ingestion Service"

echo.
echo [4/4] Starting new service...
net start "i2v-mqtt-ingestion-service"

echo.
echo ===================================================
echo                 DONE
echo ===================================================
pause

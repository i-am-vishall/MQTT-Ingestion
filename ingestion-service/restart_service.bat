@echo off
echo Stopping I2V MQTT Ingestion Service...
net stop "i2v-mqtt-ingestion-service"
timeout /t 2
echo Starting I2V MQTT Ingestion Service...
net start "i2v-mqtt-ingestion-service"
echo Done.
pause

@echo off
:: Run as Administrator to restart the ingestion service and activate new config
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo Must be run as Administrator!
    pause & exit /b 1
)
set NSSM="C:\Program Files (x86)\I2V\Common\nssm.exe"
echo Restarting i2v-MQTT-Ingestion-Service...
%NSSM% restart i2v-MQTT-Ingestion-Service
echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul
sc query i2v-MQTT-Ingestion-Service | findstr "STATE"
echo.
echo Done. Check logs at:
echo   C:\Program Files (x86)\i2v-MQTT-Ingestion\logs\ingestion-stdout.log
echo   for [PartitionMgr] lines confirming retention is active.
pause

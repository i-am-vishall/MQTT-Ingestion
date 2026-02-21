@echo off
cd /d "%~dp0"
echo Stopping Old Service...
net stop "MQTT Ingestion Service"
echo Uninstalling Old Service (Wrapper)...
node scripts\uninstall_service.js
timeout /t 5
echo Installing New Service (Node Wrapper)...
node scripts\install_service.js
echo Done!
pause

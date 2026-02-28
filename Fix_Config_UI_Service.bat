@echo off
echo ===================================================
echo CLEANING AND RESTARTING I2V-CONFIG-UI SERVICE
echo ===================================================
echo.

echo 1. Stopping the service...
"C:\Users\mevis\MQTT-Ingetsion\monitoring\nssm.exe" stop i2v-Config-UI >nul 2>&1

echo 2. forcefully terminating all lingering Node.js background processes...
taskkill /F /IM node.exe /T >nul 2>&1

echo 3. Unlocking ports and files...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo 4. Starting the service cleanly...
"C:\Users\mevis\MQTT-Ingetsion\monitoring\nssm.exe" start i2v-Config-UI

echo.
echo 5. Validating status...
"C:\Users\mevis\MQTT-Ingetsion\monitoring\nssm.exe" status i2v-Config-UI

echo.
echo Check the status above. It should say SERVICE_RUNNING.
echo The previous EPERM log locks have been killed.
pause

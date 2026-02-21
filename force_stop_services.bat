@echo off
:: ============================================================
:: FORCE STOP STUCK SERVICES
:: Run as Administrator to force-stop stuck services
:: ============================================================

echo ============================================================
echo  FORCE STOP STUCK SERVICES
echo  This will forcefully terminate stuck services
echo ============================================================
echo.

:: Check for Admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/4] Force-killing all service processes...
taskkill /F /IM "i2v-config-service.exe" 2>nul
taskkill /F /IM "i2v-ingestion-service.exe" 2>nul
taskkill /F /IM "influxdb3.exe" 2>nul
taskkill /F /IM "telegraf.exe" 2>nul
taskkill /F /IM "postgres.exe" 2>nul
taskkill /F /IM "pg_ctl.exe" 2>nul
echo    Processes killed.

echo [2/4] Waiting for processes to terminate...
timeout /t 5 /nobreak >nul

echo [3/4] Force-deleting stuck services...
sc delete "i2v-config-ui" 2>nul
sc delete "i2v-Config-Service" 2>nul
sc delete "i2v-MQTT-Ingestion-Service" 2>nul
sc delete "i2v-influxdb" 2>nul
sc delete "i2v-telegraf" 2>nul
sc delete "i2v-mqtt-ingestion-PGSQL-5441" 2>nul
sc delete "i2v-Grafana" 2>nul
echo    Services deleted.

echo [4/4] Verifying cleanup...
echo.
sc query "i2v-config-ui" 2>&1 | findstr "1060" >nul && echo    i2v-config-ui: DELETED || echo    i2v-config-ui: MAY REQUIRE REBOOT
sc query "i2v-influxdb" 2>&1 | findstr "1060" >nul && echo    i2v-influxdb: DELETED || echo    i2v-influxdb: MAY REQUIRE REBOOT

echo.
echo ============================================================
echo  CLEANUP COMPLETE!
echo ============================================================
echo.
echo If services still show as "Stopping" or exist:
echo   1. Close services.msc
echo   2. Run this script again
echo   3. If still stuck, REBOOT your computer
echo.
pause

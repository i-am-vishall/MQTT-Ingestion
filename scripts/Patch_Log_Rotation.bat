@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V MQTT INGESTION - LOG ROTATION PATCH APP_VERSION_1.0.3
echo ==============================================================
echo.

set "NSSM_PATH=%~dp0..\utils\nssm.exe"

if not exist "%NSSM_PATH%" (
    echo [ERROR] NSSM tool not found at "%NSSM_PATH%"!
    echo Are you sure I2V is installed on this machine?
    pause
    exit /b 1
)

echo [1/3] Enabling NSSM Daily Log Rotation (Rotate Every 86400 seconds)...
echo.

set "SERVICES=i2v-MQTT-Ingestion-Service i2v-config-ui i2v-influxdb i2v-telegraf"

for %%S in (%SERVICES%) do (
    echo Patching log rotation for service: %%S
    
    REM 1 = Rotate. 86400 = 1 day
    "%NSSM_PATH%" set "%%S" AppRotateFiles 1 >nul 2>&1
    "%NSSM_PATH%" set "%%S" AppRotateOnline 1 >nul 2>&1
    "%NSSM_PATH%" set "%%S" AppRotateSeconds 86400 >nul 2>&1
    
    echo   [OK] Log rotation enabled!
)

echo.
echo [2/3] Restarting services to apply the patch...
for %%S in (%SERVICES%) do (
    echo Restarting %%S...
    net stop "%%S" >nul 2>&1
    net start "%%S" >nul 2>&1
)

echo.
echo ==============================================================
echo SUCCESS! All logs will now be automatically rotated daily!
echo Old logs will be renamed to filename-YYYYMMDD.log.
echo ==============================================================
pause

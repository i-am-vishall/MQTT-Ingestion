@echo off
echo ==========================================
echo      FIXING INFLUXDB SERVICE CONFIG
echo ==========================================
echo.

:: Check for Admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click and select "Run as Administrator".
    pause
    exit /b 1
)

set "SERVICE_NAME=i2v-influxdb"
set "INFLUX_DIR=C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb"
set "EXE=%INFLUX_DIR%\influxdb3.exe"
set "DATA_DIR=%INFLUX_DIR%\data"
set "TOKEN_FILE=%INFLUX_DIR%\admin_token.txt"

echo [1/3] Setting Application Path...
reg add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%\Parameters" /v Application /t REG_EXPAND_SZ /d "%EXE%" /f

echo [2/3] Setting App Directory...
reg add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%\Parameters" /v AppDirectory /t REG_EXPAND_SZ /d "%INFLUX_DIR%" /f

echo [3/3] Setting App Parameters...
:: Note: Escaping quotes for REG ADD is tricky. We use outer quotes for the whole string.
set "PARAMS=serve --node-id node1 --object-store file --data-dir \"%DATA_DIR%\" --http-bind 127.0.0.1:8088 --admin-token-file \"%TOKEN_FILE%\" --admin-token-recovery-http-bind"

reg add "HKLM\SYSTEM\CurrentControlSet\Services\%SERVICE_NAME%\Parameters" /v AppParameters /t REG_EXPAND_SZ /d "%PARAMS%" /f

echo.
echo [4/4] Restarting Service...
net stop %SERVICE_NAME%
net start %SERVICE_NAME%

if %errorLevel% equ 0 (
    echo.
    echo SUCCESS: InfluxDB Service repaired and started!
) else (
    echo.
    echo FAILED: Could not start service. Please check logs.
    sc query %SERVICE_NAME%
)

pause

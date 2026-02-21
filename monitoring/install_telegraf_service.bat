@echo off
set "TELEGRAF_EXE=C:\Program Files\InfluxData\telegraf\telegraf-1.37.1\telegraf.exe"
set "CONFIG_FILE=C:\Users\mevis\MQTT-Ingetsion\monitoring\telegraf.conf"

echo Installing Telegraf Service...
echo Config: %CONFIG_FILE%

"%TELEGRAF_EXE%" service install --config "%CONFIG_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo Service installed successfully.
    echo Starting service...
    net start telegraf
) else (
    echo FAILED to install service. Please run as Administrator.
)
pause

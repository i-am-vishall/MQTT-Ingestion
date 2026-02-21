@echo off
set "INFLUX_DIR=C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb"
set "EXE=%INFLUX_DIR%\influxdb3.exe"
set "DATA_DIR=%INFLUX_DIR%\data"
set "TOKEN_FILE=%INFLUX_DIR%\admin_token.txt"

echo Starting InfluxDB 3...
echo   Data Dir: %DATA_DIR%
echo   HTTP Bind: 127.0.0.1:8088
echo   Admin Recovery: Enabled (127.0.0.1:8182)

"%EXE%" serve --node-id node1 --object-store file --data-dir "%DATA_DIR%" --http-bind 127.0.0.1:8088 --admin-token-file "%TOKEN_FILE%" --admin-token-recovery-http-bind
pause

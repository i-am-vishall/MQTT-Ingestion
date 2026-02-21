@echo off
TITLE i2V MQTT Data Verification
echo Checking record count in database...
"C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe" -P pager=off -h 127.0.0.1 -p 5441 -U postgres -d mqtt_alerts_db -c "SELECT count(*) as total_events, max(event_time) as last_event_time FROM mqtt_events;"
if errorlevel 1 (
    echo [ERROR] Could not connect to database on Port 5441.
) else (
    echo.
    echo [SUCCESS] connection successful.
)
pause

@echo off
TITLE i2V MQTT Data Debug
echo.
echo === LATEST 5 EVENTS ===
"C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe" -P pager=off -h 127.0.0.1 -p 5441 -U postgres -d mqtt_alerts_db -c "SELECT id, event_time, camera_id, event_type FROM mqtt_events ORDER BY id DESC LIMIT 5;" > "%~dp0db_debug_output.txt" 2>&1
echo.
echo === COUNT ===
"C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe" -h 127.0.0.1 -p 5441 -U postgres -d mqtt_alerts_db -c "SELECT count(*) FROM mqtt_events;" >> "%~dp0db_debug_output.txt" 2>&1
pause

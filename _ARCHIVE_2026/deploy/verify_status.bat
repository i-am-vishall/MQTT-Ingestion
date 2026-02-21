@echo off
cd /d "%~dp0"
echo DATE: %DATE% %TIME% > status_report.txt
echo =================================== >> status_report.txt
echo SERVICE STATUS: >> status_report.txt
sc query "mqtt_ingestion_service.exe" >> status_report.txt 2>&1
echo =================================== >> status_report.txt
echo DATABASE COUNT: >> status_report.txt
"C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe" -h 127.0.0.1 -p 5441 -U postgres -d mqtt_alerts_db -c "SELECT count(*) FROM mqtt_events;" >> status_report.txt 2>&1
echo =================================== >> status_report.txt

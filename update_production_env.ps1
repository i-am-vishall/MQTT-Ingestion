$prodEnvPath = "C:\Program Files (x86)\i2v-MQTT-Ingestion\.env"
$correctContent = @"
MQTT_BROKER_URL=mqtt://103.205.115.74:1883,mqtt://103.205.114.241:1883
MQTT_TOPICS=#
DB_USER=postgres
DB_HOST=127.0.0.1
DB_NAME=mqtt_alerts_db
DB_PASSWORD=
DB_PORT=5441
BATCH_SIZE=100
BATCH_TIMEOUT=1000
LOG_LEVEL=info
MQTT_BROKER_ID=VMS_103_205_115_74,ANPR_103_205_114_241
"@

Write-Host "Updating Production Environment Configuration..." -ForegroundColor Cyan
Set-Content -Path $prodEnvPath -Value $correctContent -Encoding ASCII

Write-Host "Configuration Updated. Restarting Service..." -ForegroundColor Cyan
Restart-Service -Name "i2v-MQTT-Ingestion-Service" -Force

Write-Host "Success! ANPR Ingestion should resume momentarily." -ForegroundColor Green
Start-Sleep -Seconds 2

$env:INFLUXDB3_HOST = "http://127.0.0.1:8088"
$token = Get-Content "C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb\admin_token.txt" | ConvertFrom-Json | Select-Object -ExpandProperty token
$exe = "C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb\influxdb3.exe"

Write-Host "Querying InfluxDB..."
& $exe query --database camera_monitoring "SELECT source, url, result_code FROM ping LIMIT 5" --token $token 2>&1

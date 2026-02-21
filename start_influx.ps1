$influxDir = "C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb"
$exe = "$influxDir\influxdb3.exe"
$argsList = "serve --node-id node1 --object-store file --data-dir $influxDir\data"

Write-Host "Starting InfluxDB 3..."
Start-Process -FilePath $exe -ArgumentList $argsList -WindowStyle Hidden
Write-Host "InfluxDB 3 started in background."

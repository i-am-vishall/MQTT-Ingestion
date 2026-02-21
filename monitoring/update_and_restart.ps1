$adminToken = "apiv3_pPignodoymU5KNfoig3neUB3xyinBBoWRysCbaq32OqNMxLZikuyLB5C1_O1U3XoGt9CZVL7b0DTVOmcgMbcuQ"
$configFile = "C:\Users\mevis\MQTT-Ingetsion\monitoring\telegraf.conf"

# Generate IP List
$ips = 106..225 | ForEach-Object { "`"192.168.1.$_`"" }
$ipString = $ips -join ", "

# Config Content
$configContent = @"
[agent]
  interval = "30s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000
  collection_jitter = "0s"
  flush_interval = "10s"
  flush_jitter = "0s"
  precision = ""
  debug = true

[[inputs.ping]]
  urls = [$ipString]
  count = 1
  timeout = 2.0
  [inputs.ping.tags]
    role = "camera"

[[outputs.influxdb_v2]]
  urls = ["http://127.0.0.1:8088"]
  token = "$adminToken"
  organization = "default"
  bucket = "camera_monitoring"
"@

Write-Host "Updating config file..."
Set-Content -Path $configFile -Value $configContent

Write-Host "Restarting i2v-telegraf service..."
Restart-Service i2v-telegraf
Write-Host "Service restarted."

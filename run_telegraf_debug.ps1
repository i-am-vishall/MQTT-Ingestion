$telegrafExe = "C:\Program Files\InfluxData\telegraf\telegraf-1.37.1\telegraf.exe"
$config = "C:\Users\mevis\MQTT-Ingetsion\monitoring\telegraf.conf"

Write-Host "Running Telegraf..."
& $telegrafExe --config $config --once --debug > telegraf_output.log 2>&1
Get-Content telegraf_output.log

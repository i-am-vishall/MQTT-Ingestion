$influxDir = "C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb"
$exe = "$influxDir\influxdb3.exe"
$argsList = "serve --node-id node1 --object-store file --data-dir $influxDir\data --http-bind 127.0.0.1:8088 --admin-token-file $influxDir\admin_token.txt"

Write-Host "Starting InfluxDB..."
$p = Start-Process -FilePath $exe -ArgumentList $argsList -RedirectStandardOutput "c:\Users\mevis\MQTT-Ingetsion\influx_stdout.log" -RedirectStandardError "c:\Users\mevis\MQTT-Ingetsion\influx_stderr.log" -PassThru
Start-Sleep -Seconds 2

if ($p.HasExited) {
    Write-Host "Process Exited immediately. ExitCode: $($p.ExitCode)"
}
else {
    Write-Host "Process is running (PID: $($p.Id))."
}

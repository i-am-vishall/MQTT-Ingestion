$influxDir = "C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb"
$exe = "$influxDir\influxdb3.exe"

$env:INFLUXDB3_HOST = "http://127.0.0.1:8182"

Try {
    Write-Host "Creating database 'camera_monitoring'..."
    $dbOut = & $exe create database camera_monitoring 2>&1
    Write-Host $dbOut

    Write-Host "Creating admin token..."
    $tokenOut = & $exe create token --admin 2>&1
    
    # Extract token if mixed with text
    Write-Host "RAW_TOKEN_OUTPUT: $tokenOut"
}
Catch {
    Write-Error $_
}

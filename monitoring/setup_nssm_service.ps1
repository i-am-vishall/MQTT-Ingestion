$nssmZip = "C:\Users\mevis\Downloads\nssm-2.24-103-gdee49fc.zip"
$workDir = "C:\Users\mevis\MQTT-Ingetsion\monitoring"
$nssmExeDest = "$workDir\nssm.exe"

# 1. Extract NSSM if not present
if (-not (Test-Path $nssmExeDest)) {
    Write-Host "Extracting NSSM..."
    $tempDir = "$workDir\temp_nssm"
    Expand-Archive -Path $nssmZip -DestinationPath $tempDir -Force
    
    # Locate win64 nssm.exe (adjust path matching the zip structure)
    $nssmSource = Get-ChildItem -Path $tempDir -Recurse -Filter "nssm.exe" | Where-Object { $_.DirectoryName -like "*win64*" } | Select-Object -First 1
    
    if ($nssmSource) {
        Copy-Item $nssmSource.FullName -Destination $nssmExeDest
        Write-Host "NSSM copied to $nssmExeDest"
    }
    else {
        Write-Error "Could not find nssm.exe (win64) in zip."
        exit 1
    }
    Remove-Item $tempDir -Recurse -Force
}

# 2. Cleanup Previous Scheduled Task
Write-Host "Removing Scheduled Task..."
Unregister-ScheduledTask -TaskName "i2v-influxdb-task" -Confirm:$false -ErrorAction SilentlyContinue

# 3. Cleanup Previous Service (if any)
Write-Host "Ensuring all old InfluxDB processes are dead..."
Stop-Process -Name "influxdb3" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$serviceName = "i2v-influxdb"
if (Get-Service $serviceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing service..."
    Stop-Service $serviceName -Force -ErrorAction SilentlyContinue
    & $nssmExeDest remove $serviceName confirm
}

# 4. Install Service via NSSM
Write-Host "Installing $serviceName via NSSM..."
$influxDir = "$workDir\influxdb"
$influxExe = "$influxDir\influxdb3.exe"
$dataDir = "$influxDir\data"
$tokenFile = "$influxDir\admin_token.txt"

# Arguments
$influxArgs = "serve --node-id node1 --object-store file --data-dir `"$dataDir`" --http-bind 127.0.0.1:8088 --admin-token-file `"$tokenFile`" --admin-token-recovery-http-bind"

& $nssmExeDest install $serviceName "$influxExe" $influxArgs
& $nssmExeDest set $serviceName AppDirectory "$influxDir"
& $nssmExeDest set $serviceName DisplayName "i2v InfluxDB 3 Server"
& $nssmExeDest set $serviceName Description "InfluxDB 3 Core "
& $nssmExeDest set $serviceName Start SERVICE_AUTO_START

# Redirect I/O for logging (Prevent hanging)
& $nssmExeDest set $serviceName AppStdout "$workDir\influx_service.log"
& $nssmExeDest set $serviceName AppStderr "$workDir\influx_service.err"

# Start Service
Write-Host "Starting Service..."
Start-Service $serviceName

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: InfluxDB is running as a Service (NSSM)."
}

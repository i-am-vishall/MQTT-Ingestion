# specific prefix for user request
$prefix = "i2v"
$influxServiceName = "$prefix-influxdb"
$telegrafServiceName = "$prefix-telegraf"

$workDir = "C:\Users\mevis\MQTT-Ingetsion\monitoring"
$influxDir = "$workDir\influxdb"
$influxExe = "$influxDir\influxdb3.exe"
$influxData = "$influxDir\data"
$influxToken = "$influxDir\admin_token.txt"

$telegrafDir = "C:\Program Files\InfluxData\telegraf\telegraf-1.37.1"
$telegrafExe = "$telegrafDir\telegraf.exe"
$telegrafConf = "$workDir\telegraf.conf"

# --- 0. Clean Up Existing Processes ---
Write-Host "--- Cleaning up existing processes ---"
Stop-Process -Name "influxdb3" -ErrorAction SilentlyContinue -Force
Stop-Process -Name "telegraf" -ErrorAction SilentlyContinue -Force
Start-Sleep -Seconds 2

# --- 1. Install InfluxDB Service ---
Write-Host "--- Configuring Service: $influxServiceName ---"

# Stop/Remove if exists
if (Get-Service $influxServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing service..."
    Stop-Service $influxServiceName -Force
    Write-Host "Removing existing service..."
    sc.exe delete $influxServiceName
    Start-Sleep -Seconds 2
}

# Construct Binary Path
# Note: Windows Service command line arguments
$influxArgs = "serve --node-id node1 --object-store file --data-dir ""$influxData"" --http-bind 127.0.0.1:8088 --admin-token-file ""$influxToken"""
$binPath = "`"$influxExe`" $influxArgs"

Write-Host "Creating service $influxServiceName..."
# Using sc.exe for reliable binPath with arguments (New-Service can be picky about args)
sc.exe create $influxServiceName binPath= $binPath start= auto DisplayName= "i2v InfluxDB 3 Server"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Starting $influxServiceName..."
    Start-Service $influxServiceName
}
else {
    Write-Error "Failed to create InfluxDB service."
}

# --- 2. Install Telegraf Service ---
Write-Host "`n--- Configuring Service: $telegrafServiceName ---"

# Telegraf handles its own install/uninstall via CLI
# We need to uninstall if it exists under this specific name, or the default 'telegraf' if user installed it previously?
# User asked for specific name, so we manage that.

# Check if service exists via Get-Service to stop it first
if (Get-Service $telegrafServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing $telegrafServiceName..."
    Stop-Service $telegrafServiceName -Force
    # Telegraf remove command needs the service name
    & $telegrafExe service uninstall --service-name $telegrafServiceName
}

Write-Host "Installing $telegrafServiceName..."
# Install with custom name
& $telegrafExe service install --config "$telegrafConf" --service-name "$telegrafServiceName" --service-display-name "i2v Telegraf Collector"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Starting $telegrafServiceName..."
    Start-Service $telegrafServiceName
}
else {
    Write-Error "Failed to install Telegraf service."
}

Write-Host "`n--- Installation Complete ---"
Get-Service $influxServiceName, $telegrafServiceName | Select-Object Name, Status, DisplayName

$ErrorActionPreference = "Stop"
$influxServiceName = "i2v-influxdb"
$telegrafServiceName = "i2v-telegraf"
$workDir = "C:\Users\mevis\MQTT-Ingetsion\monitoring"
$influxRunner = "$workDir\influx_service_runner.bat"
$telegrafExe = "C:\Program Files\InfluxData\telegraf\telegraf-1.37.1\telegraf.exe"
$telegrafConf = "$workDir\telegraf.conf"

Write-Host "--- CLEANUP & FIX ---"

# 1. Stop and Delete Stuck InfluxDB Service
Write-Host "Checking for stuck $influxServiceName..."
if (Get-Service $influxServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping..."
    Stop-Service $influxServiceName -Force -ErrorAction SilentlyContinue
    # Kill process if stuck
    Get-Process "influxdb3" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Deleting service..."
    sc.exe delete $influxServiceName
    Start-Sleep -Seconds 2
}
else {
    Write-Host "Service $influxServiceName not found (Good)."
}

# 2. Create Scheduled Task for InfluxDB (Alternative to Service)
# This mimics a service by running at startup with SYSTEM privileges
Write-Host "`n--- Configuring InfluxDB as Scheduled Task ---"
$taskName = "i2v-influxdb-task"

# Unregister if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $influxRunner
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0

Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -TaskName $taskName -Description "InfluxDB 3 Server for i2v"

Write-Host "Task $taskName created. Starting now..."
Start-ScheduledTask -TaskName $taskName

# 3. Install Telegraf (Native Service)
Write-Host "`n--- Configuring Telegraf Service ---"

# Cleanup old telegraf service if exists
if (Get-Service $telegrafServiceName -ErrorAction SilentlyContinue) {
    Stop-Service $telegrafServiceName -Force -ErrorAction SilentlyContinue
    & $telegrafExe service uninstall --service-name "$telegrafServiceName"
}

Write-Host "Installing $telegrafServiceName..."
# Note: Using correct --config flag
& $telegrafExe --config "$telegrafConf" --service-name "$telegrafServiceName" --service-display-name "i2v Telegraf Collector" service install

if ($LASTEXITCODE -eq 0) {
    Write-Host "Starting $telegrafServiceName..."
    Start-Service $telegrafServiceName
    Write-Host "SUCCESS: Telegraf Service Installed and Started."
}
else {
    Write-Error "Failed to install Telegraf service."
}

Write-Host "`n--- SETUP COMPLETE ---"
Write-Host "InfluxDB: Running as Scheduled Task '$taskName'"
Write-Host "Telegraf: Running as Service '$telegrafServiceName'"

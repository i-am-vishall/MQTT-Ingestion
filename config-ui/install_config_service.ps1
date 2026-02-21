$serviceName = "i2v-config-ui"
$nssmPath = "C:\Users\mevis\MQTT-Ingetsion\monitoring\nssm.exe"
$nodePath = (Get-Command node).Source
$scriptPath = "C:\Users\mevis\MQTT-Ingetsion\config-ui\server\index.js"
$appDir = "C:\Users\mevis\MQTT-Ingetsion\config-ui\server"

# Check for NSSM
if (-not (Test-Path $nssmPath)) {
    Write-Host "Error: NSSM not found at $nssmPath" -ForegroundColor Red
    exit 1
}

# Stop existing service if any
& $nssmPath stop $serviceName
& $nssmPath remove $serviceName confirm

# Install Service
Write-Host "Installing $serviceName..."
& $nssmPath install $serviceName $nodePath
& $nssmPath set $serviceName AppParameters """$scriptPath"""
& $nssmPath set $serviceName AppDirectory $appDir
& $nssmPath set $serviceName DisplayName "i2v-Config-UI-3001"
& $nssmPath set $serviceName Description "Configuration Interface for MQTT Ingestion Stack (Port 3001)"
& $nssmPath set $serviceName Start SERVICE_AUTO_START

# Logging
& $nssmPath set $serviceName AppStdout "$appDir\service.log"
& $nssmPath set $serviceName AppStderr "$appDir\service_error.log"

# Stability / Hardening Settings
& $nssmPath set $serviceName AppStopMethodSkip 0
& $nssmPath set $serviceName AppStopMethodConsole 3000
& $nssmPath set $serviceName AppStopMethodWindow 2000
& $nssmPath set $serviceName AppStopMethodThreads 2000
& $nssmPath set $serviceName AppKillProcessTree 1

# Start Service
Write-Host "Starting $serviceName..."
& $nssmPath start $serviceName

# Verify
Start-Sleep -Seconds 2
$status = Get-Service $serviceName
Write-Host "Service Status: $($status.Status)" -ForegroundColor Green

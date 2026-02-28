#!/usr/bin/env powershell
# I2V Production Release Builder

param([string]$Version = "1.0.3", [string]$OutputDir = "dist")

$ErrorActionPreference = "Stop"
$startTime = Get-Date
$RootDir = Get-Location
$DistDir = Join-Path $RootDir $OutputDir
$Release = "I2V_MQTT_Ingestion_System_v${Version}"
$ReleaseDir = Join-Path $DistDir $Release

Write-Host ""
Write-Host "=========================================================="
Write-Host "  I2V MQTT Ingestion System - Production Builder v${Version}"
Write-Host "=========================================================="
Write-Host ""

# Prerequisites
Write-Host "[1/6] Checking prerequisites..."
node --version
npm --version

# Cleanup
Write-Host "[2/6] Preparing directories..."
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force -ErrorAction SilentlyContinue }
@($ReleaseDir, (Join-Path $ReleaseDir "bin"), (Join-Path $ReleaseDir "logs")) | ForEach-Object {
    New-Item -Path $_ -ItemType Directory -Force | Out-Null
}
Write-Host "Done"

# Ingestion Service
Write-Host "[3/6] Building Ingestion Service..."
Push-Location (Join-Path $RootDir "ingestion-service")
npm install --production 2>&1 | Select-Object -Last 1
npx pkg . --targets node18-win-x64 --compress GZip 2>&1 | Select-Object -Last 1
if (Test-Path "dist/ingestion-service.exe") {
    Copy-Item "dist/ingestion-service.exe" (Join-Path $ReleaseDir "bin/i2v-ingestion-service.exe")
}
Pop-Location
Write-Host "Done"

# Frontend
Write-Host "[4/6] Building Frontend..."
Push-Location (Join-Path $RootDir "config-ui/client")
npm install 2>&1 | Select-Object -Last 1
npm run build 2>&1 | Select-Object -Last 1
if (Test-Path "dist") {
    Copy-Item "dist" (Join-Path $ReleaseDir "client") -Recurse -Force
}
Pop-Location
Write-Host "Done"

# Config Service
Write-Host "[5/6] Building Config Service..."
Push-Location (Join-Path $RootDir "config-ui/server")
npm install --production 2>&1 | Select-Object -Last 1
npx pkg . --targets node18-win-x64 --compress GZip 2>&1 | Select-Object -Last 1
if (Test-Path "dist/server.exe") {
    Copy-Item "dist/server.exe" (Join-Path $ReleaseDir "bin/i2v-config-service.exe")
}
Pop-Location
Write-Host "Done"

# Assemble Release
Write-Host "[6/6] Assembling release..."

# DB scripts
Copy-Item (Join-Path $RootDir "db/*.sql") (Join-Path $ReleaseDir "db/") -Force -ErrorAction SilentlyContinue

# .env template
$envFile = Join-Path $ReleaseDir ".env.example"
Add-Content $envFile "# MQTT Configuration"
Add-Content $envFile "MQTT_BROKERS=localhost:1883"
Add-Content $envFile ""
Add-Content $envFile "# PostgreSQL Configuration"
Add-Content $envFile "POSTGRES_HOST=localhost"
Add-Content $envFile "POSTGRES_PORT=5432"
Add-Content $envFile "POSTGRES_DB=i2v_ingestion"
Add-Content $envFile "POSTGRES_USER=postgres"
Add-Content $envFile "POSTGRES_PASSWORD="
Add-Content $envFile ""
Add-Content $envFile "# Service Configuration"
Add-Content $envFile "LOG_LEVEL=info"
Add-Content $envFile "HEALTH_PORT=3333"
Add-Content $envFile "CONFIG_PORT=3001"

# Installing batch file
$batFile = Join-Path $ReleaseDir "install.bat"
Set-Content $batFile "@echo off"
Add-Content $batFile "REM I2V Installation"
Add-Content $batFile "set INSTALL_DIR=%~dp0"
Add-Content $batFile "nssm install I2V-Ingestion-Service ""%INSTALL_DIR%\bin\i2v-ingestion-service.exe"""
Add-Content $batFile "nssm install I2V-Config-Service ""%INSTALL_DIR%\bin\i2v-config-service.exe"""
Add-Content $batFile "nssm start I2V-Ingestion-Service"
Add-Content $batFile "nssm start I2V-Config-Service"
Add-Content $batFile "echo Installation complete"
Add-Content $batFile "pause"

# Uninstall batch file
$batFile2 = Join-Path $ReleaseDir "uninstall.bat"
Set-Content $batFile2 "@echo off"
Add-Content $batFile2 "REM I2V Uninstallation"
Add-Content $batFile2 "nssm stop I2V-Ingestion-Service"
Add-Content $batFile2 "nssm remove I2V-Ingestion-Service confirm"
Add-Content $batFile2 "nssm stop I2V-Config-Service"
Add-Content $batFile2 "nssm remove I2V-Config-Service confirm"
Add-Content $batFile2 "pause"

# README
$readmeFile = Join-Path $ReleaseDir "README.md"
Set-Content $readmeFile "# I2V MQTT Ingestion System v${Version}"
Add-Content $readmeFile ""
Add-Content $readmeFile "## Installation"
Add-Content $readmeFile "1. Extract the ZIP or copy to C:\I2V"
Add-Content $readmeFile "2. Run install.bat as Administrator"
Add-Content $readmeFile "3. Edit .env with your configuration"
Add-Content $readmeFile "4. Access http://localhost:3001"
Add-Content $readmeFile ""
Add-Content $readmeFile "## Services"
Add-Content $readmeFile "- Ingestion Service: http://localhost:3333/health"
Add-Content $readmeFile "- Config Dashboard: http://localhost:3001"
Add-Content $readmeFile ""
Add-Content $readmeFile "## Support"
Add-Content $readmeFile "https://github.com/i-am-vishall/MQTT-Ingestion"

# Create ZIP
Write-Host "Creating portable archive..."
$zipPath = Join-Path $DistDir "I2V-MQTT-Ingestion-Portable-v${Version}.zip"
Compress-Archive -Path $ReleaseDir -DestinationPath $zipPath -Force

# Summary
Write-Host ""
Write-Host "=========================================================="
Write-Host "BUILD COMPLETE" -ForegroundColor Green
Write-Host "=========================================================="
Write-Host "Release: $ReleaseDir"
Write-Host "Archive: $zipPath"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. Extract ZIP to C:\I2V"
Write-Host "2. Run install.bat as Administrator"
Write-Host "3. Edit .env with your database and MQTT settings"
Write-Host "4. Access http://localhost:3001"
Write-Host ""

$duration = New-TimeSpan -Start $startTime -End (Get-Date)
Write-Host "Build completed in $($duration.TotalSeconds) seconds"

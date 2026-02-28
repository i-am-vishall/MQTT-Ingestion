#Requires -Version 5.1
<#
.SYNOPSIS
    I2V MQTT Ingestion System - Production Release Builder
.DESCRIPTION
    Builds and packages the complete I2V system
#>

param([string]$Version = "1.0.3", [string]$OutputDir = "dist")

$ErrorActionPreference = "Stop"
$startTime = Get-Date

# Configuration
$RootDir = Get-Location
$IngestionDir = Join-Path $RootDir "ingestion-service"
$ConfigUiDir = Join-Path $RootDir "config-ui"
$DbDir = Join-Path $RootDir "db"
$DistDir = Join-Path $RootDir $OutputDir
$ReleaseName = "I2V_MQTT_Ingestion_System_v${Version}"
$ReleaseDir = Join-Path $DistDir $ReleaseName

# Clear screen and show header
Clear-Host
Write-Host ("=" * 60)
Write-Host "I2V MQTT Ingestion System - Production Builder v${Version}" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host ""

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..."
try {
    node --version | Out-Host
    npm --version | Out-Host
} catch {
    Write-Host "ERROR: Node.js or npm not found" -ForegroundColor Red
    exit 1
}

# Cleanup
Write-Host "[2/5] Cleaning previous builds..."
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -Path $ReleaseDir -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $ReleaseDir "bin") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $ReleaseDir "logs") -ItemType Directory -Force | Out-Null

# Build Ingestion Service
Write-Host "[3/5] Building Ingestion Service..."
Push-Location $IngestionDir
npm install --production 2>&1 | Select-Object -Last 2
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
npx pkg . --targets node18-win-x64 --compress GZip 2>&1 | Select-Object -Last 2
if (Test-Path "dist/ingestion-service.exe") {
    Copy-Item "dist/ingestion-service.exe" (Join-Path $ReleaseDir "bin/i2v-ingestion-service.exe")
    Write-Host "✓ Ingestion Service built" -ForegroundColor Green
}
Pop-Location

# Build Frontend
Write-Host "[4/5] Building Frontend..."
Push-Location (Join-Path $ConfigUiDir "client")
npm install 2>&1 | Select-Object -Last 2
npm run build 2>&1 | Select-Object -Last 2
if (Test-Path "dist") {
    Copy-Item "dist" (Join-Path $ReleaseDir "client") -Recurse -Force
    Write-Host "✓ Frontend built" -ForegroundColor Green
}
Pop-Location

# Build Config Service
Write-Host "[5/5] Building Config Service..."
Push-Location (Join-Path $ConfigUiDir "server")
npm install --production 2>&1 | Select-Object -Last 2
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
npx pkg . --targets node18-win-x64 --compress GZip 2>&1 | Select-Object -Last 2
if (Test-Path "dist/server.exe") {
    Copy-Item "dist/server.exe" (Join-Path $ReleaseDir "bin/i2v-config-service.exe")
    Write-Host "✓ Config Service built" -ForegroundColor Green
}
Pop-Location

# Assemble release
Write-Host ""
Write-Host "Assembling release package..."

# Database scripts
Copy-Item (Join-Path $DbDir "*.sql") (Join-Path $ReleaseDir "db/") -Force -ErrorAction SilentlyContinue

# Environment template
$envContent = @"
# MQTT Configuration
MQTT_BROKERS=localhost:1883

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=i2v_ingestion
POSTGRES_USER=postgres
POSTGRES_PASSWORD=

# Service Configuration
LOG_LEVEL=info
HEALTH_PORT=3333
CONFIG_PORT=3001
"@
$envContent | Out-File (Join-Path $ReleaseDir ".env.example")

# Installation script
$installScript = @"
@echo off
REM I2V Installation Script
echo Installing I2V Services...
set INSTALL_DIR=%~dp0
nssm install I2V-Ingestion-Service "%INSTALL_DIR%\bin\i2v-ingestion-service.exe"
nssm install I2V-Config-Service "%INSTALL_DIR%\bin\i2v-config-service.exe"
nssm start I2V-Ingestion-Service
nssm start I2V-Config-Service
echo Installation complete! Access http://localhost:3001
pause
"@
$installScript | Out-File (Join-Path $ReleaseDir "install.bat") -Encoding ASCII

# Uninstall script
$uninstallScript = @"
@echo off
REM I2V Uninstallation Script
echo Uninstalling I2V Services...
nssm stop I2V-Ingestion-Service
nssm remove I2V-Ingestion-Service confirm
nssm stop I2V-Config-Service
nssm remove I2V-Config-Service confirm
echo Uninstalled
pause
"@
$uninstallScript | Out-File (Join-Path $ReleaseDir "uninstall.bat") -Encoding ASCII

# README
$readmeContent = @"
# I2V MQTT Ingestion System v${Version}

## Installation

1. Extract the ZIP file
2. Run install.bat as Administrator
3. Edit .env with your configuration
4. Access dashboard at http://localhost:3001

## Services
- Ingestion Service (localhost:3333/health)
- Config UI (localhost:3001)

## Support
https://github.com/i-am-vishall/MQTT-Ingestion
"@
$readmeContent | Out-File (Join-Path $ReleaseDir "README.md")

# Create ZIP
Write-Host "Creating portable package..."
$zipPath = Join-Path $DistDir "I2V-MQTT-Ingestion-Portable-v${Version}.zip"
Compress-Archive -Path $ReleaseDir -DestinationPath $zipPath -Force

# Summary
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "BUILD COMPLETE" -ForegroundColor Green
Write-Host ("=" * 60)
Write-Host "Release: $ReleaseDir"
Write-Host "Archive: $zipPath"
Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. Extract the ZIP file"
Write-Host "2. Run install.bat as Administrator"
Write-Host "3. Configure .env with your settings"
Write-Host "4. Access http://localhost:3001"
Write-Host ""

$duration = New-TimeSpan -Start $startTime -End (Get-Date)
Write-Host "Build time: $([Math]::Round($duration.TotalSeconds)) seconds"

#Requires -Version 5.1
<#
.SYNOPSIS
    I2V MQTT Ingestion System - Production Release Builder
.DESCRIPTION
    Builds and packages the complete I2V system with exe/msi installers
.PARAMETER Version
    Release version number (default: 1.0.3)
.PARAMETER OutputDir
    Output directory (default: dist)
#>

param(
    [string]$Version = "1.0.3",
    [string]$OutputDir = "dist",
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$startTime = Get-Date

# =====================================================================
# CONFIGURATION
# =====================================================================
$ProjectName = "I2V_MQTT_Ingestion_System"
$ReleaseName = "${ProjectName}_v${Version}"
$RootDir = Get-Location
$IngestionDir = Join-Path $RootDir "ingestion-service"
$ConfigUiDir = Join-Path $RootDir "config-ui"
$DbDir = Join-Path $RootDir "db"
$DistDir = Join-Path $RootDir $OutputDir
$ReleaseDir = Join-Path $DistDir $ReleaseName

# =====================================================================
# HELPER FUNCTIONS
# =====================================================================
function Write-Status {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    throw $Message
}

# =====================================================================
# MAIN BUILD PROCESS
# =====================================================================
Clear-Host
Write-Host "`n╔════════════════════════════════════════════════════════════╗"
Write-Host "║  I2V MQTT Ingestion System - Production Builder v$Version         ║"
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Prerequisites check
Write-Status "Checking prerequisites..."
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Success "Node.js: $nodeVersion"
    Write-Success "npm: $npmVersion"
} catch {
    Write-Error-Custom "Node.js or npm not found. Install from https://nodejs.org"
}

# Cleanup old builds
Write-Status "`nCleaning previous builds..."
if (Test-Path $DistDir) {
    Remove-Item $DistDir -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
}
New-Item -Path $ReleaseDir -ItemType Directory -Force | Out-Null
Write-Success "Build directories created"

# =====================================================================
# BUILD INGESTION SERVICE
# =====================================================================
Write-Status "`n[1/4] Building Ingestion Service..."
Push-Location $IngestionDir
try {
    Write-Host "  → Installing dependencies..."
    npm install --production 2>&1 | Select-Object -Last 1
    
    Write-Host "  → Compiling to EXE..."
    $TargetExe = Join-Path $ReleaseDir "..\build-ingestion.exe"
    npx pkg . --targets node18-win-x64 --output $TargetExe --compress GZip 2>&1 | Select-Object -Last 2
    
    if (Test-Path $TargetExe) {
        Copy-Item $TargetExe (Join-Path $ReleaseDir "bin\i2v-ingestion-service.exe") -Force
        Remove-Item $TargetExe -Force
        $size = (Get-Item (Join-Path $ReleaseDir "bin\i2v-ingestion-service.exe")).Length / 1MB
        Write-Success "Ingestion Service ($([Math]::Round($size, 1)) MB)"
    }
} catch {
    Write-Host "  ⚠ Build skipped (set -SkipBuild to continue)`n" -ForegroundColor Yellow
}
Pop-Location

# =====================================================================
# BUILD FRONTEND
# =====================================================================
Write-Status "`n[2/4] Building Frontend..."
$ClientDir = Join-Path $ConfigUiDir "client"
Push-Location $ClientDir
try {
    Write-Host "  → Installing dependencies..."
    npm install 2>&1 | Select-Object -Last 1
    
    Write-Host "  → Building with Vite..."
    npm run build 2>&1 | Select-Object -Last 2
    
    if (Test-Path "dist") {
        Copy-Item "dist" (Join-Path $ReleaseDir "client") -Recurse -Force
        $size = (Get-ChildItem "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Success "Frontend ($([Math]::Round($size, 1)) MB)"
    }
} catch {
    Write-Host "  ⚠ Build skipped`n" -ForegroundColor Yellow
}
Pop-Location

# =====================================================================
# BUILD CONFIG SERVICE
# =====================================================================
Write-Status "`n[3/4] Building Config Service..."
$ServerDir = Join-Path $ConfigUiDir "server"
Push-Location $ServerDir
try {
    Write-Host "  → Installing dependencies..."
    npm install --production 2>&1 | Select-Object -Last 1
    
    Write-Host "  → Compiling to EXE..."
    $TargetExe = Join-Path $ReleaseDir "..\build-config.exe"
    npx pkg . --targets node18-win-x64 --output $TargetExe --compress GZip 2>&1 | Select-Object -Last 2
    
    if (Test-Path $TargetExe) {
        Copy-Item $TargetExe (Join-Path $ReleaseDir "bin\i2v-config-service.exe") -Force
        Remove-Item $TargetExe -Force
        $size = (Get-Item (Join-Path $ReleaseDir "bin\i2v-config-service.exe")).Length / 1MB
        Write-Success "Config Service ($([Math]::Round($size, 1)) MB)"
    }
} catch {
    Write-Host "  ⚠ Build skipped`n" -ForegroundColor Yellow
}
Pop-Location

# =====================================================================
# ASSEMBLE RELEASE
# =====================================================================
Write-Status "`n[4/4] Assembling Release Package..."

# Create directories
New-Item -Path (Join-Path $ReleaseDir "bin") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $ReleaseDir "db") -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $ReleaseDir "logs") -ItemType Directory -Force | Out-Null

Write-Host "  → Copying database scripts..."
Get-ChildItem $DbDir -Filter "*.sql" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_ (Join-Path $ReleaseDir "db\") -Force
}
Write-Success "Database scripts copied"

Write-Host "  → Creating configuration template..."
@"
# MQTT Configuration
MQTT_BROKERS=localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

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
"@ | Out-File (Join-Path $ReleaseDir ".env.example") -Force
Write-Success "Configuration template created"

Write-Host "  → Creating installation scripts..."
$installBat = @'
@echo off
setlocal enabledelayedexpansion
set "INSTALL_DIR=%~dp0"
set "BIN_DIR=!INSTALL_DIR!bin"
set "LOG_DIR=!INSTALL_DIR!logs"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Run as Administrator
    pause
    exit /b 1
)

echo Installing I2V Services...
nssm install I2V-Ingestion-Service "!BIN_DIR!\i2v-ingestion-service.exe"
nssm set I2V-Ingestion-Service AppDirectory "!INSTALL_DIR!"
nssm set I2V-Ingestion-Service AppStdout "!LOG_DIR!\ingestion.log"
nssm set I2V-Ingestion-Service AppStderr "!LOG_DIR!\ingestion-error.log"
nssm start I2V-Ingestion-Service

nssm install I2V-Config-Service "!BIN_DIR!\i2v-config-service.exe"
nssm set I2V-Config-Service AppDirectory "!INSTALL_DIR!"
nssm set I2V-Config-Service AppStdout "!LOG_DIR!\config.log"
nssm set I2V-Config-Service AppStderr "!LOG_DIR!\config-error.log"
nssm start I2V-Config-Service

echo Installation complete!
echo Services: I2V-Ingestion-Service, I2V-Config-Service
echo Dashboard: http://localhost:3001
pause
'@
$installBat | Out-File (Join-Path $ReleaseDir "install.bat") -Encoding ASCII -Force

$uninstallBat = @'
@echo off
setlocal enabledelayedexpansion

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Run as Administrator
    pause
    exit /b 1
)

echo Uninstalling I2V Services...
nssm stop I2V-Ingestion-Service >nul 2>&1
nssm remove I2V-Ingestion-Service confirm >nul 2>&1
nssm stop I2V-Config-Service >nul 2>&1
nssm remove I2V-Config-Service confirm >nul 2>&1

echo Uninstallation complete!
pause
'@
$uninstallBat | Out-File (Join-Path $ReleaseDir "uninstall.bat") -Encoding ASCII -Force
Write-Success "Installation scripts created"

Write-Host "  → Creating documentation..."
$readme = @"
# I2V MQTT Ingestion System v$Version

## Quick Start

1. **Extract package** to installation directory
2. **Run** `install.bat` as Administrator
3. **Configure** .env with your database and MQTT settings
4. **Initialize** database with sql files in db/
5. **Access** Config UI at http://localhost:3001

## Configuration

Create .env file:
\`\`\`env
MQTT_BROKERS=localhost:1883
POSTGRES_HOST=localhost
POSTGRES_DB=i2v_ingestion
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
\`\`\`

## Services

- **Ingestion Service** - MQTT to PostgreSQL pipeline
- **Config UI** - Web dashboard on port 3001
- **Health Check** - http://localhost:3333/health

## Support

https://github.com/i-am-vishall/MQTT-Ingestion
"@
$readme | Out-File (Join-Path $ReleaseDir "README.md") -Force
Write-Success "Documentation created"

# =====================================================================
# CREATE PORTABLE ZIP
# =====================================================================
Write-Status "`nCreating portable package..."
$zipPath = Join-Path $DistDir "I2V-MQTT-Ingestion-Portable-v${Version}.zip"
Compress-Archive -Path $ReleaseDir -DestinationPath $zipPath -Force
$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Success "Portable ZIP ($([Math]::Round($zipSize, 1)) MB)"

# =====================================================================
# SUMMARY
# =====================================================================
$duration = New-TimeSpan -Start $startTime -End (Get-Date)

Write-Host "`n╔════════════════════════════════════════════════════════════╗"
Write-Host "║                   BUILD COMPLETE                            ║"
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Release Location:"
Write-Host "  Directory:  $ReleaseDir" -ForegroundColor Gray
Write-Host "  Portable:   $zipPath" -ForegroundColor Gray

Write-Host "`nArtifacts:"
Write-Host "  • Ingestion Service EXE" -ForegroundColor Gray
Write-Host "  • Config Service EXE" -ForegroundColor Gray
Write-Host "  • Frontend SPA (React + Vite)" -ForegroundColor Gray
Write-Host "  • Database Scripts" -ForegroundColor Gray
Write-Host "  • Installation/Configuration Files" -ForegroundColor Gray

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "  1. Extract ZIP or copy release directory"
Write-Host "  2. Edit .env with your settings"
Write-Host "  3. Run install.bat (as Administrator)"
Write-Host "  4. Access http://localhost:3001"

Write-Host "`nBuild Time: $($duration.TotalSeconds) seconds`n"

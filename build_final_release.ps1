<#
    I2V Smart City - Master Release Builder
    ---------------------------------------
    Automates the compilation and assembly of the full production suite.
    
    Outputs:
    dist/
      └── I2V_Smart_City_Release_vX.X/   <-- The Deployable Folder
#>

$ErrorActionPreference = "Stop"
$Version = "1.0.2"
$ReleaseName = "I2V_Smart_City_Release_v$Version"

$RootDir = Get-Location
$IngestionDir = Join-Path $RootDir "ingestion-service"
$ConfigUiDir = Join-Path $RootDir "config-ui"
$SetupDir = Join-Path $RootDir "Unified_Setup"
$DistDir = Join-Path $RootDir "dist"
$ReleaseDir = Join-Path $DistDir $ReleaseName

# Helper
function Log($Msg, $Color = "Cyan") { Write-Host "[BUILD] $Msg" -ForegroundColor $Color }

Clear-Host
Log "Starting Build: $ReleaseName" "Green"

# 1. CLEANUP
# --------------------------------------------------------------------------
Log "Cleaning previous builds..."
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
New-Item -Path $DistDir -ItemType Directory | Out-Null
New-Item -Path $ReleaseDir -ItemType Directory | Out-Null

# 2. BUILD INGESTION SERVICE
# --------------------------------------------------------------------------
Log "Building Ingestion Service..."
Push-Location $IngestionDir
try {
    # Clean install to ensure no dev deps
    if (-not (Test-Path "node_modules")) { npm install }
    
    # Compile to EXE
    $TargetExe = Join-Path $ReleaseDir "dist_package\i2v-ingestion-service.exe"
    New-Item -Path (Split-Path $TargetExe) -ItemType Directory -Force | Out-Null
    
    Log "  -> Compiling EXE (pkg)..."
    npx pkg . --targets node18-win-x64 --output $TargetExe --compress GZip
}
catch {
    Write-Error "Ingestion Service Build Failed: $_"
}
finally {
    Pop-Location
}

# 3. BUILD CONFIG UI
# --------------------------------------------------------------------------
Log "Building Config UI..."

# 3a. Client (Frontend)
Log "  -> Frontend (Vite Build)..."
Push-Location "$ConfigUiDir\client"
try {
    if (-not (Test-Path "node_modules")) { npm install }
    npm run build
}
catch { Write-Error "Frontend Build Failed: $_" }
finally { Pop-Location }

# 3b. Server (Backend)
Log "  -> Backend (PKG)..."
Push-Location "$ConfigUiDir\server"
try {
    if (-not (Test-Path "node_modules")) { npm install }
    
    $TargetExe = Join-Path $ReleaseDir "components\i2v-config-service.exe"
    New-Item -Path (Split-Path $TargetExe) -ItemType Directory -Force | Out-Null
    
    npx pkg . --targets node18-win-x64 --output $TargetExe --compress GZip
}
catch { Write-Error "Backend Build Failed: $_" }
finally { Pop-Location }

# 4. ASSEMBLE RELEASE
# --------------------------------------------------------------------------
Log "Assembling Release Artifacts..."

# Copy Configuration & Assets
Log "  -> Copying Frontend Assets..."
$ClientDist = Join-Path $ReleaseDir "client\dist"
Copy-Item -Path "$ConfigUiDir\client\dist" -Destination $ClientDist -Recurse -Force

Log "  -> Copying Database Scripts (Clean)..."
# Create Db dir
$DbDest = Join-Path $ReleaseDir "db"
New-Item -Path $DbDest -ItemType Directory -Force | Out-Null
    
# Copy manually or exclude
# Powershell Copy-Item -Exclude is flaky with Recurse. 
# Better to use specific folders or Robocopy.
# For now, we assume 'Unified_Setup/db' is the source.
Copy-Item -Path "$SetupDir\db\*" -Destination $DbDest -Recurse -Force -Exclude "data", "pgsql"
    
# We notably need pgsql binaries, but WITHOUT data/doc/include
$PgsqlSrc = Join-Path "$SetupDir\db" "pgsql"
$PgsqlDest = Join-Path $DbDest "pgsql"
if (Test-Path $PgsqlSrc) {
    Log "     -> Copying PostgreSQL Binaries (Complete)..."
    # Bundling everything except data/debug_symbols (to keep it clean but functional)
    $RoboSrc = $PgsqlSrc
    $RoboDest = $PgsqlDest
    robocopy $RoboSrc $RoboDest /E /MT:32 /NFL /NDL /XD "data" "debug_symbols" "doc" "include" | Out-Null
}

Log "  -> Copying Monitoring Configs (Clean)..."
$MonDest = Join-Path $ReleaseDir "monitoring"
New-Item -Path $MonDest -ItemType Directory -Force | Out-Null
# We skip grafana (already installed) and heavy logs.
robocopy "$SetupDir\monitoring" $MonDest /E /MT:32 /NFL /NDL /XD "data" "wal" "grafana" "influx_service.log" "influx_service.err" "telegraf_debug.log" | Out-Null

Log "  -> Copying Utilities (NSSM)..."
Copy-Item -Path "$SetupDir\utils" -Destination "$ReleaseDir\utils" -Recurse -Force

Log "  -> Copying Installer Scripts..."
# IMPORTANT: Use the DEBUG INSTALLER we fixed as the main installer
# It has the path fixes and exclusions.
$FixedInstaller = Join-Path "$SetupDir" "debug_install.bat"
    
if (Test-Path $FixedInstaller) {
    Copy-Item -Path $FixedInstaller -Destination "$ReleaseDir\install.bat"
}
else {
    Write-Warning "Fixed installer not found in manual dist location. Using source production_install.bat"
    Copy-Item -Path "$SetupDir\production_install.bat" -Destination "$ReleaseDir\install.bat"
}
    
# Add Cleanup Script if exists
$CleanupScript = "C:\Users\mevis\MQTT-Ingetsion\dist\I2V_Smart_City_Release_v1.0.0\cleanup.bat"
if (Test-Path $CleanupScript) {
    Copy-Item -Path $CleanupScript -Destination "$ReleaseDir\cleanup.bat"
}

Copy-Item -Path "$SetupDir\uninstall.bat" -Destination "$ReleaseDir\uninstall.bat"
Copy-Item -Path "$SetupDir\check_prerequisites.ps1" -Destination "$ReleaseDir\check_prerequisites.ps1"

# 5. GENERATE PRODUCTION ENV TEMPLATES
# --------------------------------------------------------------------------
Log "Generating Default Configuration (production.env)..."

$EnvContent = @"
# ----------------------------------------
# I2V Smart City - Production Config
# ----------------------------------------

MQTT_BROKER_URL=mqtt://103.205.115.74:1883,mqtt://103.205.114.241:1883
MQTT_TOPICS=#
DB_USER=postgres
DB_HOST=127.0.0.1
DB_NAME=mqtt_alerts_db
DB_PASSWORD=
DB_PORT=5441
BATCH_SIZE=100
BATCH_TIMEOUT=1000
LOG_LEVEL=info
MQTT_BROKER_ID=VMS_103_205_115_74,ANPR_103_205_114_241

"@

Set-Content -Path "$ReleaseDir\.env.example" -Value $EnvContent -Encoding ASCII
# Also place it as .env so it works out of the box if they just edit it
Set-Content -Path "$ReleaseDir\.env" -Value $EnvContent -Encoding ASCII


# 6. VERIFY
# --------------------------------------------------------------------------
Log "Verifying Build..."
$CriticalFiles = @(
    "dist_package\i2v-ingestion-service.exe",
    "components\i2v-config-service.exe",
    "client\dist\index.html",
    "install.bat",
    "utils\nssm.exe"
)

foreach ($file in $CriticalFiles) {
    if (-not (Test-Path (Join-Path $ReleaseDir $file))) {
        Write-Warning "MISSING ARTIFACT: $file"
    }
}

Log "===================================================" "Green"
Log " BUILD COMPLETE: $ReleaseDir" "Green"
Log " You can zip this folder and deploy it anywhere." "Green"
Log "===================================================" "Green"

# 7. Open Directory
Invoke-Item $DistDir

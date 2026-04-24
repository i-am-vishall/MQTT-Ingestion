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
    
Copy-Item -Path "$RootDir\db\*" -Destination $DbDest -Recurse -Force -Exclude "data", "pgsql"
    
$PgsqlSrc = "$RootDir\pgsql"
if (-not (Test-Path $PgsqlSrc)) { $PgsqlSrc = "C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql" }

if (Test-Path $PgsqlSrc) {
    Log "     -> Copying PostgreSQL Binaries (Complete)..."
    $PgsqlDest = Join-Path $DbDest "pgsql"
    robocopy $PgsqlSrc $PgsqlDest /E /MT:32 /NFL /NDL /XD "data" "debug_symbols" "doc" "include" | Out-Null
}

Log "  -> Copying Monitoring Configs (Clean)..."
$MonDest = Join-Path $ReleaseDir "monitoring"
New-Item -Path $MonDest -ItemType Directory -Force | Out-Null

$TelegrafExePath = Join-Path "$RootDir\monitoring" "telegraf.exe"
if (-not (Test-Path $TelegrafExePath)) {
    Log "     -> Missing telegraf.exe! Downloading from InfluxData..." "Yellow"
    Invoke-WebRequest -Uri "https://dl.influxdata.com/telegraf/releases/telegraf-1.28.3_windows_amd64.zip" -OutFile "$MonDest\telegraf.zip"
    Expand-Archive -Path "$MonDest\telegraf.zip" -DestinationPath "$MonDest\temp" -Force
    Copy-Item "$MonDest\temp\telegraf-1.28.3\telegraf.exe" "$RootDir\monitoring\telegraf.exe" -Force
    Remove-Item -Path "$MonDest\temp" -Recurse -Force
    Remove-Item -Path "$MonDest\telegraf.zip" -Force
}

robocopy "$RootDir\monitoring" $MonDest /E /MT:32 /NFL /NDL /XD "data" "wal" "grafana" "influx_service.log" "influx_service.err" "telegraf_debug.log" | Out-Null

Log "  -> Copying Utilities (NSSM)..."
Copy-Item -Path "$RootDir\utils" -Destination "$ReleaseDir\utils" -Recurse -Force

Log "  -> Generating Universal Installer Scripts..."

$InstallContent = @"
@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V SMART CITY PLATFORM - UNIVERSAL INSTALLER
echo ==============================================================

>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' ( echo Requesting Admin... ^& goto UACPrompt ) else ( goto gotAdmin )
:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs" & exit /B
:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%" & CD /D "%~dp0"

set "INSTALL_DIR=%~dp0"
set "NSSM=%~dp0utils\nssm.exe"

echo [1/4] Installing PostgreSQL Service...
"%NSSM%" install "i2v-mqtt-ingestion-PGSQL-5441" "%~dp0db\pgsql\bin\pg_ctl.exe"
"%NSSM%" set "i2v-mqtt-ingestion-PGSQL-5441" AppParameters "run -D \"%%INSTALL_DIR%%db\pgsql\data\""
"%NSSM%" set "i2v-mqtt-ingestion-PGSQL-5441" Start SERVICE_AUTO_START

echo [2/4] Installing Config UI Service...
"%NSSM%" install "i2v-config-ui" "%~dp0components\i2v-config-service.exe"
"%NSSM%" set "i2v-config-ui" AppDirectory "%~dp0components"
"%NSSM%" set "i2v-config-ui" Start SERVICE_AUTO_START

echo [3/4] Installing MQTT Ingestion Service...
"%NSSM%" install "i2v-MQTT-Ingestion-Service" "%~dp0dist_package\i2v-ingestion-service.exe"
"%NSSM%" set "i2v-MQTT-Ingestion-Service" AppDirectory "%~dp0dist_package"
"%NSSM%" set "i2v-MQTT-Ingestion-Service" Start SERVICE_AUTO_START

echo [4/4] Installing Telegraf Monitoring...
"%NSSM%" install "i2v-telegraf" "%~dp0monitoring\telegraf.exe"
"%NSSM%" set "i2v-telegraf" AppParameters "--config \"%%INSTALL_DIR%%monitoring\telegraf.conf\""
"%NSSM%" set "i2v-telegraf" AppDirectory "%~dp0monitoring"
"%NSSM%" set "i2v-telegraf" Start SERVICE_AUTO_START

echo Starting all services...
net start i2v-mqtt-ingestion-PGSQL-5441
net start i2v-telegraf
net start i2v-config-ui
net start i2v-MQTT-Ingestion-Service

echo DONE! Platform deployed.
pause
"@

$UninstallContent = @"
@echo off
echo ==============================================================
echo UNINSTALLING I2V PLATFORM
echo ==============================================================
net stop i2v-MQTT-Ingestion-Service
net stop i2v-telegraf
net stop i2v-config-ui
net stop i2v-mqtt-ingestion-PGSQL-5441

"%~dp0utils\nssm.exe" remove i2v-MQTT-Ingestion-Service confirm
"%~dp0utils\nssm.exe" remove i2v-config-ui confirm
"%~dp0utils\nssm.exe" remove i2v-telegraf confirm
"%~dp0utils\nssm.exe" remove i2v-mqtt-ingestion-PGSQL-5441 confirm

echo All services removed.
pause
"@

Set-Content -Path "$ReleaseDir\install.bat" -Value $InstallContent -Encoding ASCII
Set-Content -Path "$ReleaseDir\uninstall.bat" -Value $UninstallContent -Encoding ASCII

Log "  -> Bundling Custom Utility Scripts..."
$UtilsToBundle = @("scripts\Run_Auto_Partition.bat", "scripts\Verify_DB.bat", "scripts\Setup_and_Verify_DB.bat", "scripts\Rename_DB_to_Grafana.bat", "scripts\apply_telegraf_patch.bat")
foreach ($Util in $UtilsToBundle) {
    $UtilSrc = Join-Path "$RootDir" $Util
    if (Test-Path $UtilSrc) {
        Copy-Item -Path $UtilSrc -Destination "$ReleaseDir" -Force
    }
}


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

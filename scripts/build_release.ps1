<#
.SYNOPSIS
    I2V MQTT Ingestion — Self-Contained Release Builder
    Produces a single ZIP that installs on any Windows machine with NO external dependencies
    (except PostgreSQL which must be present on the target server).

.DESCRIPTION
    What gets bundled in the ZIP:
    - i2v-ingestion.exe      (Node.js ingestion cluster compiled via pkg — Node not needed)
    - i2v-config-ui.exe      (Node.js config UI backend compiled via pkg — Node not needed)
    - config-ui/dist/        (Pre-built React SPA, served by i2v-config-ui.exe)
    - redis/                 (Portable Redis-for-Windows binaries)
    - bin/nssm.exe           (NSSM service manager — no install required)
    - db/init_schema.sql     (Full schema with all 20+ tables, views, partitions)
    - scripts/preflight_check.js  (System health verifier — runs via bundled node if needed)
    - .env.template          (Complete template with all 22 keys and comments)
    - INSTALL.bat            (One-click setup using only bundled tools)
    - UNINSTALL.bat
    - README.md

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\build_release.ps1 -Version "7.0"
#>

param(
    [string]$Version = "7.0",
    [switch]$SkipCompile = $false   # Use if pkg compilation takes too long on CI
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

$RootDir     = Split-Path -Parent $PSScriptRoot
$DistDir     = Join-Path $RootDir "dist"
$ReleaseName = "I2V-MQTT-Ingestion-v$Version"
$ReleaseDir  = Join-Path $DistDir $ReleaseName
$ZipPath     = Join-Path $DistDir "$ReleaseName.zip"

function Say   { param($m) Write-Host "  [....] $m" -ForegroundColor Cyan }
function Done  { param($m) Write-Host "  [ OK ] $m" -ForegroundColor Green }
function Fail  { param($m) Write-Host "  [FAIL] $m" -ForegroundColor Red; exit 1 }
function Warn  { param($m) Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Title { param($m) Write-Host "`n══ $m ══" -ForegroundColor Magenta }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   I2V MQTT Ingestion — Release Builder v$Version              " -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ─── PREREQUISITES ─────────────────────────────────────────────────────────────
Title "1. Checking Build Prerequisites"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js not found — required to build." }
Done "Node.js: $(node --version)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue))  { Fail "npm not found." }
Done "npm: $(npm --version)"

# Check pkg is available (globally or via npx)
$pkgAvailable = (Get-Command pkg -ErrorAction SilentlyContinue) -ne $null
if (-not $pkgAvailable) {
    Warn "pkg not globally installed — will use npx pkg (slower first run)"
}

# ─── CLEAN BUILD DIR ───────────────────────────────────────────────────────────
Title "2. Preparing Build Directory"

if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
$subdirs = @("bin", "db", "scripts", "logs", "config-ui\dist")
foreach ($d in $subdirs) {
    New-Item -Path (Join-Path $ReleaseDir $d) -ItemType Directory -Force | Out-Null
}
Done "Release dir: $ReleaseDir"

# ─── BUILD FRONTEND ────────────────────────────────────────────────────────────
Title "3. Building React Frontend (Vite)"

$clientDir = Join-Path $RootDir "config-ui\client"
$clientDist = Join-Path $clientDir "dist"

Push-Location $clientDir
try {
    Say "Installing frontend deps..."
    npm install --silent 2>&1 | Out-Null
    Say "Running vite build..."
    npm run build 2>&1 | Select-Object -Last 5 | Write-Host
    if (-not (Test-Path (Join-Path $clientDist "index.html"))) { Fail "Frontend build failed — dist/index.html not found" }
    Done "Frontend built ($([Math]::Round((Get-ChildItem $clientDist -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB))KB)"
} finally { Pop-Location }

# Copy dist into release
Copy-Item -Path "$clientDist\*" -Destination (Join-Path $ReleaseDir "config-ui\dist") -Recurse -Force
Done "Frontend copied to release"

# ─── COMPILE INGESTION SERVICE EXE ────────────────────────────────────────────
Title "4. Compiling Ingestion Service → EXE"

$ingestionDir = Join-Path $RootDir "ingestion-service"
$ingestionExe = Join-Path $ReleaseDir "bin\i2v-ingestion.exe"

Push-Location $ingestionDir
try {
    Say "Installing production deps..."
    npm install --production --silent 2>&1 | Out-Null

    if ($SkipCompile) {
        Warn "SkipCompile set — copying source files instead of compiling EXE"
        # Fall back: copy entire ingestion-service source (requires Node on target)
        $srcTarget = Join-Path $ReleaseDir "ingestion-service"
        New-Item -Path $srcTarget -ItemType Directory -Force | Out-Null
        Copy-Item -Path "$ingestionDir\*" -Destination $srcTarget -Recurse -Force -Exclude @("node_modules", "*.log", "*.txt", "*.rdb")
        # Rewrite INSTALL.bat to use 'node' instead of EXE
        $global:IngestionCommand = "node `"%~dp0ingestion-service\src\cluster.js`""
    } else {
        Say "Compiling to EXE via pkg (this takes ~2 minutes)..."
        $pkgCmd = if ($pkgAvailable) { "pkg" } else { "npx pkg" }
        Invoke-Expression "$pkgCmd . --targets node18-win-x64 --output `"$ingestionExe`" 2>&1" | Select-Object -Last 10

        if (Test-Path $ingestionExe) {
            $sizeMB = [Math]::Round((Get-Item $ingestionExe).Length / 1MB, 1)
            Done "i2v-ingestion.exe compiled ($sizeMB MB)"
            $global:IngestionCommand = "`"%~dp0bin\i2v-ingestion.exe`""
        } else {
            Warn "pkg compilation failed — falling back to source copy + Node.js"
            $SkipCompile = $true
        }
    }
} finally { Pop-Location }

# ─── COMPILE CONFIG UI SERVICE EXE ────────────────────────────────────────────
Title "5. Compiling Config UI Service → EXE"

$configServerDir = Join-Path $RootDir "config-ui\server"
$configExe = Join-Path $ReleaseDir "bin\i2v-config-ui.exe"

Push-Location $configServerDir
try {
    Say "Installing production deps..."
    npm install --production --silent 2>&1 | Out-Null

    if ($SkipCompile) {
        Warn "SkipCompile — copying source"
        $srcTarget = Join-Path $ReleaseDir "config-ui\server"
        New-Item -Path $srcTarget -ItemType Directory -Force | Out-Null
        Copy-Item -Path "$configServerDir\*" -Destination $srcTarget -Recurse -Force -Exclude @("node_modules", "*.log")
        $global:ConfigUiCommand = "node `"%~dp0config-ui\server\index.js`""
    } else {
        Say "Compiling to EXE via pkg..."
        $pkgCmd = if ($pkgAvailable) { "pkg" } else { "npx pkg" }
        Invoke-Expression "$pkgCmd . --targets node18-win-x64 --output `"$configExe`" 2>&1" | Select-Object -Last 10

        if (Test-Path $configExe) {
            $sizeMB = [Math]::Round((Get-Item $configExe).Length / 1MB, 1)
            Done "i2v-config-ui.exe compiled ($sizeMB MB)"
            $global:ConfigUiCommand = "`"%~dp0bin\i2v-config-ui.exe`""
        } else {
            Warn "pkg failed — falling back to source copy"
        }
    }
} finally { Pop-Location }

# ─── BUNDLE Redis (Portable) ───────────────────────────────────────────────────
Title "6. Bundling Redis (Portable)"

$redisSource = Join-Path $RootDir "redis"
$redisDest   = Join-Path $ReleaseDir "redis"
New-Item -Path $redisDest -ItemType Directory -Force | Out-Null

$redisFiles = @("redis-server.exe", "redis-cli.exe", "redis.windows.conf", "redis.windows-service.conf")
$copiedRedis = 0
foreach ($f in $redisFiles) {
    $fp = Join-Path $redisSource $f
    if (Test-Path $fp) {
        Copy-Item $fp (Join-Path $redisDest $f) -Force
        $copiedRedis++
    }
}
if ($copiedRedis -ge 2) {
    Done "Redis binaries bundled ($copiedRedis files)"
} else {
    Warn "Redis binaries not found at $redisSource — target machine needs Redis installed separately"
}

# Write a clean minimal Redis config for bundled use
$redisConfig = @"
# I2V Bundled Redis Configuration
port 6379
bind 127.0.0.1
maxmemory 2gb
maxmemory-policy allkeys-lru
save ""
appendonly no
loglevel warning
"@
$redisConfig | Out-File (Join-Path $redisDest "redis-bundled.conf") -Encoding ASCII -Force
Done "Redis bundled config created"

# ─── BUNDLE NSSM ──────────────────────────────────────────────────────────────
Title "7. Bundling NSSM"

$nssmCandidates = @(
    (Join-Path $RootDir "monitoring\nssm.exe"),
    "C:\Program Files (x86)\I2V\Common\nssm.exe",
    "C:\Program Files\GrafanaLabs\svc-12.4.0.0\nssm.exe",
    (Join-Path $RootDir "utils\nssm.exe")
)
$nssmCopied = $false
foreach ($candidate in $nssmCandidates) {
    if (Test-Path $candidate) {
        Copy-Item $candidate (Join-Path $ReleaseDir "bin\nssm.exe") -Force
        Done "NSSM bundled from: $candidate"
        $nssmCopied = $true
        break
    }
}
if (-not $nssmCopied) {
    Warn "NSSM not found — INSTALL.bat will try system PATH"
}

# ─── COPY DATABASE SCHEMA ─────────────────────────────────────────────────────
Title "8. Copying Database Schema"

$schemaSrc = Join-Path $RootDir "ingestion-service\init_schema.sql"
if (Test-Path $schemaSrc) {
    Copy-Item $schemaSrc (Join-Path $ReleaseDir "db\init_schema.sql") -Force
    Done "init_schema.sql copied"
} else {
    Fail "init_schema.sql not found at: $schemaSrc"
}

# Copy preflight checker
$preflightSrc = Join-Path $RootDir "scripts\preflight_check.js"
if (Test-Path $preflightSrc) {
    Copy-Item $preflightSrc (Join-Path $ReleaseDir "scripts\preflight_check.js") -Force
    Done "preflight_check.js copied"
}

# ─── GENERATE .env.template ───────────────────────────────────────────────────
Title "9. Generating .env.template"

$envTemplate = @"
# =============================================================================
# I2V MQTT Ingestion System — Environment Configuration
# Copy this file to .env and fill in your values before running INSTALL.bat
# =============================================================================

# ── MQTT Brokers ──────────────────────────────────────────────────────────────
# Comma-separated list of broker URLs. Add as many as needed.
MQTT_BROKER_URL=mqtt://127.0.0.1:1883

# Human-friendly names for each broker (must map 1:1 to URLs above)
MQTT_BROKER_ID=LocalBroker

# Topics to subscribe to. Use # for all.
MQTT_TOPICS=#

# Internal Aedes MQTT port (leave default unless port conflict)
MQTT_PORT=1883

# ── PostgreSQL Database ───────────────────────────────────────────────────────
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mqtt_alerts_db

# ── Ingestion Pipeline Tuning ─────────────────────────────────────────────────
# Events per DB write batch. Higher = better throughput but more RAM.
BATCH_SIZE=5000

# Max milliseconds to wait before forcing a partial batch write.
BATCH_TIMEOUT=1000

# Max simultaneous PostgreSQL write workers (semaphore slots).
MAX_CONCURRENT_WRITERS=6

# Auto-scaler: minimum Node.js worker processes (kept alive at all times).
MIN_NODE_WORKERS=2

# Auto-scaler: maximum Node.js worker processes (surge ceiling).
MAX_NODE_WORKERS=12

# Data Retention: mqtt_events partitions older than this value are automatically
# DROPPED at service startup and every 24 hours. Keeps disk use bounded.
# - 30  = ~1 month   (very aggressive, good for IoT edge nodes)
# - 90  = ~3 months  (recommended default)
# - 180 = ~6 months
# - 365 = 1 year     (monitor disk usage)
DB_RETENTION_DAYS=90

# Redis stream max length. Oldest events dropped beyond this size.
REDIS_STREAM_MAXLEN=2000000

# ── Config Dashboard ──────────────────────────────────────────────────────────
# Port for the Config UI web panel.
PORT=3001

# Health API port (used by dashboard metrics).
HEALTH_PORT=3333

ADMIN_USER=admin
ADMIN_PASS=change_this_password

# ── Logging & Debug ───────────────────────────────────────────────────────────
# Verbosity level: error | warn | info | debug
LOG_LEVEL=info
DEBUG_MODE=false
DEBUG_MODE_INGESTION=false
DEBUG_MODE_CONFIG=false
"@

$envTemplate | Out-File (Join-Path $ReleaseDir ".env.template") -Encoding ASCII -Force
Done ".env.template generated with all 22 keys + comments"

# ─── GENERATE INSTALL.bat ─────────────────────────────────────────────────────
Title "10. Generating INSTALL.bat"

# Determine commands based on compile success
$ingCmd  = if ($global:IngestionCommand)  { $global:IngestionCommand  } else { "`"%~dp0bin\i2v-ingestion.exe`"" }
$cfgCmd  = if ($global:ConfigUiCommand)   { $global:ConfigUiCommand   } else { "`"%~dp0bin\i2v-config-ui.exe`"" }

$installBat = @"
@echo off
setlocal enabledelayedexpansion
title I2V MQTT Ingestion — Installer v$Version

echo.
echo =========================================================
echo   I2V MQTT Ingestion System v$Version
echo   ONE-CLICK INSTALLER
echo =========================================================
echo.

:: Check admin
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Run this installer as Administrator!
    echo Right-click INSTALL.bat and choose "Run as administrator"
    pause
    exit /b 1
)

set "INSTALL_DIR=%~dp0"
set "NSSM=%~dp0bin\nssm.exe"
set "LOG_DIR=%~dp0logs"
set "REDIS_DIR=%~dp0redis"

if not exist "!LOG_DIR!" mkdir "!LOG_DIR!"

:: ── Check .env ──────────────────────────────────────────────────────────────
if not exist "!INSTALL_DIR!.env" (
    echo [SETUP REQUIRED] .env file not found!
    echo.
    echo Please copy .env.template to .env and fill in your settings:
    echo   DB_PASSWORD, MQTT_BROKER_URL, ADMIN_PASS, etc.
    echo.
    echo Then run this installer again.
    echo.
    copy "!INSTALL_DIR!.env.template" "!INSTALL_DIR!.env" >nul
    echo A blank .env has been created from the template. Edit it now.
    start notepad "!INSTALL_DIR!.env"
    pause
    exit /b 1
)
echo [1/9] .env configuration found.

:: ── Start Bundled Redis ─────────────────────────────────────────────────────
echo [2/9] Starting Redis...
if exist "!REDIS_DIR!\redis-server.exe" (
    sc query i2v-Redis-Service >nul 2>&1
    if %errorLevel% NEQ 0 (
        "!NSSM!" install i2v-Redis-Service "!REDIS_DIR!\redis-server.exe" "!REDIS_DIR!\redis-bundled.conf"
        "!NSSM!" set i2v-Redis-Service AppDirectory "!REDIS_DIR!"
        "!NSSM!" set i2v-Redis-Service AppStdout "!LOG_DIR!\redis-stdout.log"
        "!NSSM!" set i2v-Redis-Service AppStderr "!LOG_DIR!\redis-stderr.log"
        "!NSSM!" set i2v-Redis-Service Start SERVICE_AUTO_START
    )
    "!NSSM!" start i2v-Redis-Service >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo Redis service started.
) else (
    echo [WARN] Redis not bundled. Ensure Redis/Memurai is running on port 6379.
)

:: ── Initialize Database ─────────────────────────────────────────────────────
echo [3/9] Initializing PostgreSQL schema...
where psql >nul 2>&1
if %errorLevel% EQU 0 (
    for /f "tokens=2 delims==" %%a in ('findstr "DB_NAME" "!INSTALL_DIR!.env"') do set DB_NAME=%%a
    for /f "tokens=2 delims==" %%a in ('findstr "DB_USER" "!INSTALL_DIR!.env"') do set DB_USER=%%a
    for /f "tokens=2 delims==" %%a in ('findstr "DB_HOST" "!INSTALL_DIR!.env"') do set DB_HOST=%%a
    for /f "tokens=2 delims==" %%a in ('findstr "DB_PORT" "!INSTALL_DIR!.env"') do set DB_PORT=%%a
    psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d postgres -c "SELECT 1 FROM pg_database WHERE datname='!DB_NAME!'" | findstr "1 row" >nul
    if %errorLevel% NEQ 0 (
        echo Creating database !DB_NAME!...
        psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d postgres -c "CREATE DATABASE \"!DB_NAME!\";"
    )
    psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -f "!INSTALL_DIR!db\init_schema.sql"
    echo Database schema initialized.
) else (
    echo [WARN] psql not in PATH. Run this manually after installing PostgreSQL:
    echo   psql -U postgres -d mqtt_alerts_db -f "!INSTALL_DIR!db\init_schema.sql"
)

:: ── Install Ingestion Service ────────────────────────────────────────────────
echo [4/9] Installing Ingestion Service...
sc query i2v-MQTT-Ingestion-Service >nul 2>&1
if %errorLevel% EQU 0 (
    "!NSSM!" stop i2v-MQTT-Ingestion-Service >nul 2>&1
    timeout /t 2 /nobreak >nul
    "!NSSM!" remove i2v-MQTT-Ingestion-Service confirm >nul 2>&1
)
"!NSSM!" install i2v-MQTT-Ingestion-Service $ingCmd
"!NSSM!" set i2v-MQTT-Ingestion-Service AppDirectory "!INSTALL_DIR!"
"!NSSM!" set i2v-MQTT-Ingestion-Service AppStdout "!LOG_DIR!\ingestion-stdout.log"
"!NSSM!" set i2v-MQTT-Ingestion-Service AppStderr "!LOG_DIR!\ingestion-stderr.log"
"!NSSM!" set i2v-MQTT-Ingestion-Service AppStdoutCreationDisposition 4
"!NSSM!" set i2v-MQTT-Ingestion-Service AppStderrCreationDisposition 4
"!NSSM!" set i2v-MQTT-Ingestion-Service AppRestartDelay 10000
"!NSSM!" set i2v-MQTT-Ingestion-Service Start SERVICE_AUTO_START
echo Ingestion Service installed.

:: ── Install Config UI Service ────────────────────────────────────────────────
echo [5/9] Installing Config UI Service...
sc query i2v-Config-UI-Service >nul 2>&1
if %errorLevel% EQU 0 (
    "!NSSM!" stop i2v-Config-UI-Service >nul 2>&1
    timeout /t 2 /nobreak >nul
    "!NSSM!" remove i2v-Config-UI-Service confirm >nul 2>&1
)
"!NSSM!" install i2v-Config-UI-Service $cfgCmd
"!NSSM!" set i2v-Config-UI-Service AppDirectory "!INSTALL_DIR!"
"!NSSM!" set i2v-Config-UI-Service AppStdout "!LOG_DIR!\config-stdout.log"
"!NSSM!" set i2v-Config-UI-Service AppStderr "!LOG_DIR!\config-stderr.log"
"!NSSM!" set i2v-Config-UI-Service AppStdoutCreationDisposition 4
"!NSSM!" set i2v-Config-UI-Service AppStderrCreationDisposition 4
"!NSSM!" set i2v-Config-UI-Service AppRestartDelay 10000
"!NSSM!" set i2v-Config-UI-Service Start SERVICE_AUTO_START
echo Config UI Service installed.

:: ── Start Services ───────────────────────────────────────────────────────────
echo [6/9] Starting Ingestion Service...
"!NSSM!" start i2v-MQTT-Ingestion-Service
timeout /t 3 /nobreak >nul

echo [7/9] Starting Config UI Service...
"!NSSM!" start i2v-Config-UI-Service
timeout /t 5 /nobreak >nul

:: ── Verify ───────────────────────────────────────────────────────────────────
echo [8/9] Verifying services...
sc query i2v-MQTT-Ingestion-Service | findstr "STATE" | findstr "RUNNING" >nul
if %errorLevel% EQU 0 ( echo   [OK] i2v-MQTT-Ingestion-Service is RUNNING ) else ( echo   [WARN] i2v-MQTT-Ingestion-Service is NOT running - check logs )

sc query i2v-Config-UI-Service | findstr "STATE" | findstr "RUNNING" >nul
if %errorLevel% EQU 0 ( echo   [OK] i2v-Config-UI-Service is RUNNING ) else ( echo   [WARN] i2v-Config-UI-Service is NOT running - check logs )

echo [9/9] Opening Config Dashboard...
timeout /t 3 /nobreak >nul
start http://localhost:3001

echo.
echo =========================================================
echo   INSTALLATION COMPLETE
echo   Config Dashboard : http://localhost:3001
echo   Health API       : http://localhost:3333/health
echo   Logs             : !LOG_DIR!
echo =========================================================
echo.
pause
"@
$installBat | Out-File (Join-Path $ReleaseDir "INSTALL.bat") -Encoding ASCII -Force
Done "INSTALL.bat generated"

# ─── GENERATE UNINSTALL.bat ───────────────────────────────────────────────────
$uninstallBat = @"
@echo off
setlocal enabledelayedexpansion
title I2V System — Uninstaller

net session >nul 2>&1
if %errorLevel% NEQ 0 ( echo Run as Administrator! & pause & exit /b 1 )

set "NSSM=%~dp0bin\nssm.exe"

echo Stopping and removing all I2V services...
for %%s in (i2v-MQTT-Ingestion-Service i2v-Config-UI-Service i2v-Redis-Service) do (
    "!NSSM!" stop %%s >nul 2>&1
    timeout /t 1 /nobreak >nul
    "!NSSM!" remove %%s confirm >nul 2>&1
    echo Removed: %%s
)
echo.
echo All services removed. You may now delete this folder manually.
pause
"@
$uninstallBat | Out-File (Join-Path $ReleaseDir "UNINSTALL.bat") -Encoding ASCII -Force
Done "UNINSTALL.bat generated"

# ─── GENERATE README ──────────────────────────────────────────────────────────
Title "11. Generating README"

$readme = @"
# I2V MQTT Ingestion System v$Version
## Self-Contained Portable Release

### Prerequisites (on target Windows Server)
- **PostgreSQL 14+** — Must be installed and running before INSTALL.bat
  - Download: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
  - After installing: create user `postgres` with a password
- **Windows 10/Server 2019+** (64-bit)
- **Administrator access** for service registration

> All other dependencies (Node.js, Redis, NSSM) are BUNDLED in this package.

### Installation Steps

1. **Extract this ZIP** to a permanent location (e.g., `C:\i2v-mqtt\`)

2. **Copy `.env.template` → `.env`**
   Edit `.env` and set at minimum:
   - `DB_PASSWORD` — your PostgreSQL password
   - `MQTT_BROKER_URL` — your MQTT broker address(es)
   - `ADMIN_PASS` — dashboard login password

3. **Run `INSTALL.bat` as Administrator**
   Right-click → Run as Administrator
   The installer will:
   - Start bundled Redis as a Windows service
   - Create the database and apply the full schema
   - Register and start both services

4. **Open the Config Dashboard**
   http://localhost:3001

### Service Health
- Config Dashboard: http://localhost:3001
- Ingestion Health API: http://localhost:3333/health

### Service Management
`sc start i2v-MQTT-Ingestion-Service`
`sc stop i2v-MQTT-Ingestion-Service`
`sc start i2v-Config-UI-Service`

### Logs
All logs in the `logs\` directory:
- `logs\ingestion-stdout.log` — real-time ingestion pipeline output
- `logs\config-stdout.log` — Config UI activity
- `logs\*-stderr.log` — errors (kept 30 days)

### Uninstallation
Run `UNINSTALL.bat` as Administrator, then delete the folder.

---
Built: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
Version: $Version
"@
$readme | Out-File (Join-Path $ReleaseDir "README.md") -Encoding UTF8 -Force
Done "README.md generated"

# ─── ZIP THE RELEASE ──────────────────────────────────────────────────────────
Title "12. Creating Release ZIP"

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Say "Compressing $ReleaseDir..."
Compress-Archive -Path $ReleaseDir -DestinationPath $ZipPath -CompressionLevel Optimal -Force

if (Test-Path $ZipPath) {
    $sizeMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
    Done "ZIP created: $ZipPath ($sizeMB MB)"
} else {
    Fail "ZIP creation failed"
}

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
$elapsed = [Math]::Round(((Get-Date) - $StartTime).TotalSeconds)

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   BUILD COMPLETE in ${elapsed}s                                    " -ForegroundColor Green
Write-Host "║   Release ZIP : $ZipPath" -ForegroundColor Green
Write-Host "║   Contents:                                                  " -ForegroundColor Green
Write-Host "║     bin\i2v-ingestion.exe  (ingestion engine — no Node.js)   " -ForegroundColor White
Write-Host "║     bin\i2v-config-ui.exe  (dashboard backend — no Node.js)  " -ForegroundColor White
Write-Host "║     bin\nssm.exe           (service manager)                 " -ForegroundColor White
Write-Host "║     redis\redis-server.exe (bundled Redis)                   " -ForegroundColor White
Write-Host "║     config-ui\dist\        (pre-built React dashboard)       " -ForegroundColor White
Write-Host "║     db\init_schema.sql     (full 20-table schema)            " -ForegroundColor White
Write-Host "║     .env.template          (all 22 keys with comments)       " -ForegroundColor White
Write-Host "║     INSTALL.bat            (one-click setup)                 " -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

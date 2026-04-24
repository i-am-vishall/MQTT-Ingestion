<#
.SYNOPSIS
    I2V MQTT Ingestion System — One-Shot Windows Server Installer
    Run this script AS ADMINISTRATOR on a fresh Windows Server to install everything.

.DESCRIPTION
    This script:
    1. Validates all prerequisites (Node.js, npm, PostgreSQL, Redis, NSSM)
    2. Copies project files to C:\Program Files (x86)\i2v-MQTT-Ingestion\
    3. Builds the React frontend
    4. Installs all Node.js dependencies 
    5. Runs the pre-flight verifier (aborts if DB/Redis not reachable)
    6. Registers both Windows services via NSSM with crash-recovery policies
    7. Starts both services and confirms they are RUNNING
    8. Hits health endpoints to confirm HTTP is alive

.EXAMPLE
    # From project root as Administrator:
    powershell -ExecutionPolicy Bypass -File .\scripts\Install_On_New_Server.ps1
#>

param(
    [string]$InstallDir = "C:\Program Files (x86)\i2v-MQTT-Ingestion",
    [switch]$SkipPrereqCheck = $false,
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# ─── COLORS ──────────────────────────────────────────────────────────────────
function OK   { param($m) Write-Host "  [OK]  $m" -ForegroundColor Green }
function FAIL { param($m) Write-Host "  [FAIL] $m" -ForegroundColor Red; exit 1 }
function WARN { param($m) Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function INFO { param($m) Write-Host "  [....] $m" -ForegroundColor Cyan }
function SECTION { param($m) Write-Host "`n══ $m ══`n" -ForegroundColor Magenta }

# ─── ADMIN CHECK ──────────────────────────────────────────────────────────────
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    FAIL "This script MUST be run as Administrator! Right-click PowerShell → Run as Administrator."
}

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   I2V MQTT Ingestion System - Server Installer           ║" -ForegroundColor Cyan
Write-Host "║   Source:  $ProjectRoot" -ForegroundColor Cyan
Write-Host "║   Target:  $InstallDir" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ─── 1. PREREQUISITES ─────────────────────────────────────────────────────────
SECTION "1. Prerequisite Validation"

if (-not $SkipPrereqCheck) {
    # Node.js
    try {
        $nodeVer = node --version 2>&1
        OK "Node.js: $nodeVer"
    } catch { FAIL "Node.js not found. Install from https://nodejs.org/en/download (LTS recommended)" }

    # npm
    try {
        $npmVer = npm --version 2>&1
        OK "npm: v$npmVer"
    } catch { FAIL "npm not found. Reinstall Node.js." }

    # NSSM
    $nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $nssmPath) {
        $nssmAlt = "C:\nssm\nssm.exe"
        if (Test-Path $nssmAlt) {
            $env:PATH += ";C:\nssm"
            OK "NSSM found at $nssmAlt"
        } else {
            FAIL "NSSM not found. Download from https://nssm.cc/download and place nssm.exe in C:\nssm\"
        }
    } else {
        OK "NSSM: $($nssmPath.Source)"
    }

    # PostgreSQL
    try {
        $pgVer = psql --version 2>&1
        OK "PostgreSQL client: $pgVer"
    } catch { WARN "PostgreSQL client (psql) not in PATH — DB auto-init will run via Node.js instead." }

    # Redis / Memurai
    try {
        $redisPong = redis-cli ping 2>&1
        if ($redisPong -match "PONG") { OK "Redis: PONG received" }
        else { WARN "Redis ping returned: $redisPong — ensure Memurai/Redis is installed and running." }
    } catch { WARN "redis-cli not found — ensure Memurai is installed and running on port 6379." }
}

# ─── 2. COPY FILES ────────────────────────────────────────────────────────────
SECTION "2. Copying Project Files"

INFO "Destination: $InstallDir"

# Ensure destination exists
if (-not (Test-Path $InstallDir)) {
    New-Item -Path $InstallDir -ItemType Directory -Force | Out-Null
}

# Directories to copy
$copyDirs = @(
    "ingestion-service\src",
    "ingestion-service\utils",
    "config-ui\server",
    "config-ui\client\dist"
)

foreach ($d in $copyDirs) {
    $src = Join-Path $ProjectRoot $d
    $dst = Join-Path $InstallDir $d
    if (Test-Path $src) {
        if (-not (Test-Path $dst)) { New-Item -Path $dst -ItemType Directory -Force | Out-Null }
        Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force
        OK "Copied $d"
    } else {
        WARN "Source not found, skipping: $src"
    }
}

# Copy package.json files (needed for npm install)
$pkgFiles = @(
    @{ Src = "ingestion-service\package.json"; Dst = "ingestion-service\package.json" },
    @{ Src = "ingestion-service\package-lock.json"; Dst = "ingestion-service\package-lock.json" },
    @{ Src = "config-ui\server\package.json"; Dst = "config-ui\server\package.json" },
    @{ Src = "config-ui\server\package-lock.json"; Dst = "config-ui\server\package-lock.json" }
)
foreach ($f in $pkgFiles) {
    $src = Join-Path $ProjectRoot $f.Src
    $dst = Join-Path $InstallDir $f.Dst
    if (Test-Path $src) {
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -Path $dstDir -ItemType Directory -Force | Out-Null }
        Copy-Item -Path $src -Destination $dst -Force
    }
}

# Copy .env
$envSrc = Join-Path $ProjectRoot ".env"
$envDst = Join-Path $InstallDir ".env"
if (Test-Path $envSrc) {
    Copy-Item $envSrc $envDst -Force
    OK "Copied .env"
} else {
    WARN ".env not found at $envSrc — you must create it manually before starting services!"
}

# Copy SQL schema
$sqlSrc = Join-Path $ProjectRoot "ingestion-service\init_schema.sql"
$sqlDst = Join-Path $InstallDir "db\init_schema.sql"
if (Test-Path $sqlSrc) {
    $dbDir = Join-Path $InstallDir "db"
    if (-not (Test-Path $dbDir)) { New-Item -Path $dbDir -ItemType Directory -Force | Out-Null }
    Copy-Item $sqlSrc $sqlDst -Force
    OK "Copied init_schema.sql to db\"
}

# Copy scripts
$scriptsSrc = Join-Path $ProjectRoot "scripts"
$scriptsDst = Join-Path $InstallDir "scripts"
Copy-Item -Path "$scriptsSrc\*" -Destination $scriptsDst -Recurse -Force -ErrorAction SilentlyContinue
OK "Copied scripts\"

# Create logs directory
$logsDir = Join-Path $InstallDir "logs"
New-Item -Path $logsDir -ItemType Directory -Force | Out-Null
OK "Created logs\"

# ─── 3. INSTALL NODE.JS DEPENDENCIES ─────────────────────────────────────────
SECTION "3. Installing Node.js Dependencies"

$ingestionNodeDir = Join-Path $InstallDir "ingestion-service"
$configNodeDir   = Join-Path $InstallDir "config-ui\server"

INFO "Installing ingestion-service dependencies..."
Push-Location $ingestionNodeDir
try {
    npm install --production 2>&1 | Select-Object -Last 3
    OK "ingestion-service dependencies installed"
} catch { FAIL "npm install failed in ingestion-service: $_" }
finally { Pop-Location }

INFO "Installing config-ui server dependencies..."
Push-Location $configNodeDir
try {
    npm install --production 2>&1 | Select-Object -Last 3
    OK "config-ui server dependencies installed"
} catch { FAIL "npm install failed in config-ui server: $_" }
finally { Pop-Location }

# ─── 4. BUILD FRONTEND (if not pre-built) ─────────────────────────────────────
SECTION "4. Frontend Build"

$distDir = Join-Path $InstallDir "config-ui\client\dist\index.html"
if (Test-Path $distDir) {
    OK "Frontend dist already present — skipping build"
} elseif (-not $SkipBuild) {
    $clientSrcDir = Join-Path $ProjectRoot "config-ui\client"
    if (Test-Path $clientSrcDir) {
        INFO "Building React frontend..."
        Push-Location $clientSrcDir
        try {
            npm install 2>&1 | Select-Object -Last 2
            npm run build 2>&1 | Select-Object -Last 5
            # Copy built dist to install dir
            $builtDist = Join-Path $clientSrcDir "dist"
            $dstDist   = Join-Path $InstallDir "config-ui\client\dist"
            Copy-Item -Path "$builtDist\*" -Destination $dstDist -Recurse -Force
            OK "Frontend built and copied"
        } catch { FAIL "Frontend build failed: $_" }
        finally { Pop-Location }
    } else {
        WARN "Frontend source not found — skipping"
    }
} else {
    WARN "SkipBuild flag set — using existing dist (may be stale)"
}

# ─── 5. PRE-FLIGHT CHECK ──────────────────────────────────────────────────────
SECTION "5. Pre-Flight Verification"

$preflightScript = Join-Path $InstallDir "scripts\preflight_check.js"
if (Test-Path $preflightScript) {
    INFO "Running preflight_check.js..."
    Push-Location $InstallDir
    try {
        $result = node $preflightScript 2>&1
        Write-Host $result
        if ($LASTEXITCODE -ne 0) {
            FAIL "Pre-flight check FAILED. Fix the issues above before continuing."
        } else {
            OK "Pre-flight check PASSED"
        }
    } catch {
        WARN "Could not run pre-flight check: $_"
    } finally { Pop-Location }
} else {
    WARN "preflight_check.js not found at $preflightScript — skipping"
}

# ─── 6. REGISTER WINDOWS SERVICES ─────────────────────────────────────────────
SECTION "6. NSSM Service Registration"

$ingestionExe = "node"
$ingestionArgs = "`"$(Join-Path $InstallDir 'ingestion-service\src\cluster.js')`""
$configExe = "node"
$configArgs = "`"$(Join-Path $InstallDir 'config-ui\server\index.js')`""

$ingestionLog = Join-Path $logsDir "ingestion-stdout.log"
$ingestionErr = Join-Path $logsDir "ingestion-stderr.log"
$configLog    = Join-Path $logsDir "config-stdout.log"
$configErr    = Join-Path $logsDir "config-stderr.log"

function RegisterService {
    param($Name, $Exe, $Args, $WorkDir, $StdOut, $StdErr)

    $existing = sc.exe query $Name 2>&1
    if ($existing -match "SERVICE_NAME") {
        INFO "Service $Name already exists — updating..."
        nssm stop $Name 2>&1 | Out-Null
        nssm remove $Name confirm 2>&1 | Out-Null
    }

    nssm install $Name $Exe $Args | Out-Null
    nssm set $Name AppDirectory $WorkDir | Out-Null
    nssm set $Name AppStdout $StdOut | Out-Null
    nssm set $Name AppStderr $StdErr | Out-Null
    nssm set $Name AppStdoutCreationDisposition 4 | Out-Null  # Append
    nssm set $Name AppStderrCreationDisposition 4 | Out-Null
    nssm set $Name AppRestartDelay 10000 | Out-Null   # 10s restart delay on crash
    nssm set $Name Start SERVICE_AUTO_START | Out-Null
    OK "Service '$Name' registered"
}

RegisterService `
    -Name "i2v-MQTT-Ingestion-Service" `
    -Exe $ingestionExe `
    -Args $ingestionArgs `
    -WorkDir (Join-Path $InstallDir "ingestion-service") `
    -StdOut $ingestionLog `
    -StdErr $ingestionErr

RegisterService `
    -Name "i2v-Config-UI-Service" `
    -Exe $configExe `
    -Args $configArgs `
    -WorkDir (Join-Path $InstallDir "config-ui\server") `
    -StdOut $configLog `
    -StdErr $configErr

# ─── 7. START SERVICES ────────────────────────────────────────────────────────
SECTION "7. Starting Services"

INFO "Starting i2v-MQTT-Ingestion-Service..."
nssm start i2v-MQTT-Ingestion-Service 2>&1 | Out-Null
Start-Sleep -Seconds 3

INFO "Starting i2v-Config-UI-Service..."
nssm start i2v-Config-UI-Service 2>&1 | Out-Null
Start-Sleep -Seconds 5

# ─── 8. VERIFY SERVICES RUNNING ───────────────────────────────────────────────
SECTION "8. Service Health Verification"

$services = @("i2v-MQTT-Ingestion-Service", "i2v-Config-UI-Service")
foreach ($svc in $services) {
    $status = sc.exe query $svc 2>&1
    if ($status -match "RUNNING") {
        OK "$svc → RUNNING"
    } else {
        WARN "$svc is NOT RUNNING. Check logs at: $logsDir"
    }
}

# HTTP health endpoints
INFO "Checking HTTP health endpoints (wait 5s for services to bind)..."
Start-Sleep -Seconds 5

try {
    $healthResp = Invoke-RestMethod -Uri "http://localhost:3333/health" -TimeoutSec 5
    if ($healthResp.status -eq "UP") {
        OK "Ingestion Health API: UP (http://localhost:3333/health)"
    } else {
        WARN "Ingestion Health returned: $($healthResp | ConvertTo-Json -Compress)"
    }
} catch { WARN "Could not reach http://localhost:3333/health — ingestion service may still be starting" }

try {
    $configResp = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing
    if ($configResp.StatusCode -eq 200) {
        OK "Config UI: HTTP 200 (http://localhost:3001)"
    }
} catch { WARN "Could not reach http://localhost:3001 — config UI may still be starting" }

# ─── FINAL SUMMARY ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   INSTALLATION COMPLETE                                   ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Install Dir:  $InstallDir" -ForegroundColor Green
Write-Host "║  Log Dir:      $logsDir" -ForegroundColor Green
Write-Host "║  Config UI:    http://localhost:3001                      ║" -ForegroundColor Green
Write-Host "║  Health API:   http://localhost:3333/health               ║" -ForegroundColor Green
Write-Host "╠═══════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Service Control:                                         ║" -ForegroundColor White
Write-Host "║    nssm restart i2v-MQTT-Ingestion-Service                ║" -ForegroundColor White
Write-Host "║    nssm restart i2v-Config-UI-Service                     ║" -ForegroundColor White
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build executor with validation and error handling
.DESCRIPTION
    Wrapper around build_production_release.ps1 with setup verification
#>

param(
    [string]$Version = "1.0.3",
    [switch]$SkipTests = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$Script:StartTime = Get-Date

function Step {
    param([string]$Message)
    Write-Host "`n► $Message" -ForegroundColor Cyan -BackgroundColor Black
}

function Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Error {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
    throw $Message
}

Step "I2V MQTT Ingestion System - Build Executor"
Write-Host "  Version: $Version" -ForegroundColor Yellow
Write-Host "  Mode: $(if($DryRun) { 'DRY RUN' } else { 'EXECUTE' })" -ForegroundColor Yellow

# Validation
Step "Validating environment..."

# Check Node.js
try {
    $nodeVersion = (node --version) -replace 'v', ''
    $nodeVersionNum = [version]$nodeVersion
    if ($nodeVersionNum.Major -lt 18) {
        throw "Node.js 18+ required, found $nodeVersion"
    }
    Success "Node.js $nodeVersion"
} catch {
    Error "Node.js not found or version too old"
}

# Check npm
try {
    $npmVersion = (npm --version)
    Success "npm $npmVersion"
} catch {
    Error "npm not found"
}

# Check git
try {
    $gitVersion = (git --version).Split(' ')[2]
    Success "git $gitVersion"
} catch {
    Error "git not found"
}

# Optional: Check Inno Setup
if (Test-Path "C:\Program Files (x86)\Inno Setup 6\iscc.exe") {
    Success "Inno Setup 6 found"
} else {
    Write-Host "  ⚠ Inno Setup not found (installer won't be created)" -ForegroundColor Yellow
}

# Validate project structure
Step "Validating project structure..."
$requiredDirs = @(
    "ingestion-service",
    "config-ui/client",
    "config-ui/server",
    "db"
)

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Success $dir
    } else {
        Error "Missing required directory: $dir"
    }
}

# Validate package.json files
$packageJsons = @(
    "ingestion-service/package.json",
    "config-ui/client/package.json",
    "config-ui/server/package.json"
)

foreach ($pkg in $packageJsons) {
    if (Test-Path $pkg) {
        $content = Get-Content $pkg | ConvertFrom-Json
        Success "$pkg (v$($content.version))"
    } else {
        Error "Missing: $pkg"
    }
}

# Check git status
Step "Checking git status..."
$status = git status --porcelain
if ($status) {
    Write-Host "  ⚠ Uncommitted changes detected:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "    $_" }
    Write-Host "  (These will be included in the release)" -ForegroundColor Yellow
} else {
    Success "Working directory clean"
}

# Confirmation
Step "Ready to build"
if (-not $DryRun) {
    Write-Host ""
    Write-Host "Press Enter to proceed with build, or Ctrl+C to cancel..."
    Read-Host | Out-Null
}

# Run the build
Step "Executing build script..."
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN: Build would execute with:" -ForegroundColor Yellow
    Write-Host "  .\build_production_release.ps1 -Version '$Version' -SkipTests:`$$($SkipTests)" -ForegroundColor Gray
} else {
    & ".\build_production_release.ps1" -Version $Version -SkipTests:$SkipTests
}

# Summary
$duration = Get-Date - $Script:StartTime
Step "Build Process Complete"
Write-Host "  Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Green
Write-Host ""
Write-Host "Artifacts location: dist/" -ForegroundColor Cyan
Write-Host "  • dist/I2V_MQTT_Ingestion_System_v${Version}/" -ForegroundColor Gray
Write-Host "  • dist/I2V-MQTT-Ingestion-Installer-v${Version}.exe" -ForegroundColor Gray
Write-Host "  • dist/I2V-MQTT-Ingestion-Portable-v${Version}.zip" -ForegroundColor Gray
Write-Host "  • dist/BUILD_REPORT.txt" -ForegroundColor Gray

Write-Host ""
Write-Host "Next: Deploy the installer/portable package to target systems" -ForegroundColor Cyan

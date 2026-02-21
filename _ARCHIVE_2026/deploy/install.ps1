# PowerShell Installer for MQTT Ingestion Service (Debug Mode)
$ErrorActionPreference = "Stop"

# Ensure Administrator Privileges
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host "Attempting to restart with elevated permissions..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

function Pause-Exit {
    Read-Host "Press Enter to exit..."
    exit
}

try {
    $SourceDir = $PSScriptRoot
    $InstallDir = "C:\Program Files (x86)\i2v-MQTT-Ingestion"
    $DataDir = "$InstallDir\data"
    $PgServiceName = "i2v-mqtt-ingestion-PGSQL-5441"
    $AppServiceName = "i2v-MQTT-Ingestion-Service"
    $OldAppServiceName = "MQTT_Ingestion_Service"
    
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   i2V MQTT Ingestion Installer (DEBUG)" -ForegroundColor Cyan
    Write-Host "=========================================="
    Write-Host "Source: $SourceDir"
    Write-Host "Target: $InstallDir"

    # DEBUG: Check Source PGSQL
    if (-not (Test-Path "$SourceDir\pgsql\bin\initdb.exe")) {
        Write-Warning "Source pgsql\bin\initdb.exe NOT FOUND in $SourceDir"
        Write-Warning "Checking $SourceDir\pgsql exists? $(Test-Path "$SourceDir\pgsql")"
        if (Test-Path "$SourceDir\pgsql") {
            Write-Host "Contents of $SourceDir\pgsql:"
            Get-ChildItem "$SourceDir\pgsql" | Select-Object Name
        }
    }
    else {
        Write-Host "Source binaries verified." -ForegroundColor Green
    }

    # 1. Cleanup
    Write-Host "`n[1/6] Cleaning up previous installations..." -ForegroundColor Yellow
    
    function Kill-Port-Process ($Port) {
        $found = $false
        Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | ForEach-Object {
            $pidToKill = $_.OwningProcess
            Write-Host "Killing PID $pidToKill on port $Port..."
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            $found = $true
        }
        return $found
    }

    try {
        Stop-Service $PgServiceName -ErrorAction SilentlyContinue
        Stop-Service "PostgreSQL-5441" -ErrorAction SilentlyContinue
        Stop-Service $AppServiceName -ErrorAction SilentlyContinue
        Stop-Service $OldAppServiceName -ErrorAction SilentlyContinue

        # Explicitly delete the OLD service if it exists (since wrapper config changed)
        sc.exe delete $OldAppServiceName *>$null
        
        # Kill multiple times to be sure
        Kill-Port-Process 5441
        Start-Sleep -Seconds 2
        Kill-Port-Process 5441
    }
    catch {
        Write-Host "Cleanup warning: $_" -ForegroundColor DarkGray
    }

    if (Test-Path $DataDir) {
        Write-Host "Attempting to remove old data directory..."
        Remove-Item $DataDir -Recurse -Force -ErrorAction SilentlyContinue
        
        if (Test-Path $DataDir) {
            Write-Warning "Could not delete $DataDir. Attempting to rename..."
            $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $BackupDir = "$DataDir.old.$Timestamp"
            try {
                Rename-Item -Path $DataDir -NewName $BackupDir -ErrorAction Stop
                Write-Host "Renamed locked data dir to $BackupDir" -ForegroundColor Green
            }
            catch {
                Write-Warning "Could not rename data directory. Switching to FRESH data directory..."
                $DataDir = "$InstallDir\data_$Timestamp"
                Write-Host "New Data Target: $DataDir" -ForegroundColor Cyan
            }
        }
    }

    # 2. Copy Files
    Write-Host "`n[2/6] Installing files..." -ForegroundColor Yellow
    if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir | Out-Null }
    
    Write-Host "Copying from $SourceDir to $InstallDir..."
    Copy-Item "$SourceDir\*" "$InstallDir\" -Recurse -Force
    
    # 3. Identify and Isolate PG
    Write-Host "`n[3/6] Configuring PostgreSQL..." -ForegroundColor Yellow
    Set-Location $InstallDir

    $PgBin = "$InstallDir\pgsql\bin"
    Write-Host "Checking for binaries at: $PgBin"
    
    if (-not (Test-Path "$PgBin\initdb.exe")) {
        Write-Warning "Binaries NOT FOUND at $PgBin"
        Write-Warning "Attempting search..."
        
        # Try finding it
        $PotentialPaths = @(
            "$SourceDir\pgsql\bin",
            "C:\Program Files\PostgreSQL\*\bin",
            "C:\Program Files (x86)\PostgreSQL\*\bin"
        )
        
        foreach ($path in $PotentialPaths) {
            $found = Get-ChildItem $path -Filter "initdb.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $PgBin = $found.DirectoryName
                Write-Host "Found alternative binaries at: $PgBin" -ForegroundColor Cyan
                break
            }
        }
    }

    if (-not (Test-Path "$PgBin\initdb.exe")) {
        throw "Could not find PostgreSQL binaries 'initdb.exe'. Installation cannot continue."
    }

    Write-Host "Using PostgreSQL at: $PgBin"
    
    # Ensure binaries are in InstallDir for isolation
    if ($PgBin -ne "$InstallDir\pgsql\bin") {
        Write-Host "Isolating binaries to installation folder..."
        if (-not (Test-Path "$InstallDir\pgsql")) { New-Item -ItemType Directory -Path "$InstallDir\pgsql" | Out-Null }
        Copy-Item "$PgBin\..\*" "$InstallDir\pgsql\" -Recurse -Force
        $PgBin = "$InstallDir\pgsql\bin"
    }

    # 4. Init DB
    Write-Host "`n[4/6] Initializing Database..." -ForegroundColor Yellow
    if (-not (Test-Path "$DataDir\postgresql.conf")) {
        Write-Host "Executing initdb..."
        & "$PgBin\initdb.exe" -D "$DataDir" -U postgres -A trust -E UTF8
        
        if ($LASTEXITCODE -ne 0) { throw "initdb failed with exit code $LASTEXITCODE" }
        
        Add-Content "$DataDir\postgresql.conf" "`nport = 5441"
        Add-Content "$DataDir\postgresql.conf" "`nlisten_addresses = '*'"
    }

    # 5. Register Services
    Write-Host "`n[5/6] Registering Services..." -ForegroundColor Yellow

    # DB Service
    Write-Host "Registering DB Service..."
    if (Get-Service $PgServiceName -ErrorAction SilentlyContinue) {
        Write-Host "Unregistering existing service..."
        & "$PgBin\pg_ctl.exe" unregister -N $PgServiceName -D "$DataDir"
    }
    else {
        Write-Host "Service not found, skipping unregister."
    }

    # Register
    & "$PgBin\pg_ctl.exe" register -N $PgServiceName -D "$DataDir" -S auto
    
    # Start
    Write-Host "Starting DB Service..."
    Start-Service $PgServiceName
    Start-Sleep -Seconds 5

    # Schema
    Write-Host "Running Schema Setup..."
    & ".\setup_db.exe"
    if ($LASTEXITCODE -ne 0) { Write-Warning "setup_db reported errors." }

    # App Service
    Write-Host "Installing App Service..."
    & ".\service-wrapper.exe" uninstall *>$null
    & ".\service-wrapper.exe" install
    & ".\service-wrapper.exe" start

    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host "      INSTALLATION COMPLETE" -ForegroundColor Green
    Write-Host "=========================================="
    Pause-Exit

}
catch {
    Write-Host "`n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "      INSTALLATION FAILED" -ForegroundColor Red
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    Write-Host "Error Details: $_" -ForegroundColor Red
    Write-Host "Script Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
    Pause-Exit
}

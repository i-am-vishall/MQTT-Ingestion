# I2V MQTT Ingestion System - Build Process Guide

## Overview

This document describes the complete build process for creating production-ready installer packages and executable binaries from the source code.

## Build Architecture

```
Source Code (git)
    ↓
[build_production_release.ps1]
    ├─→ Tests (Jest: 128 tests)
    │
    ├─→ Ingestion Service Build
    │   ├─ npm install (dependencies)
    │   ├─ pkg compile (Node.js → EXE)
    │   └─ Output: i2v-ingestion-service.exe
    │
    ├─→ Frontend Build
    │   ├─ npm install (dependencies)
    │   ├─ Vite build (React → optimized bundles)
    │   └─ Output: client/dist/ (static assets)
    │
    ├─→ Config Service Build
    │   ├─ npm install (dependencies)
    │   ├─ pkg compile (Node.js → EXE)
    │   └─ Output: i2v-config-service.exe
    │
    └─→ Release Assembly
        ├─ Copy binaries to bin/
        ├─ Copy frontend assets to client/
        ├─ Copy db scripts to db/
        ├─ Create install.bat / uninstall.bat
        ├─ Create .env.example template
        ├─ Generate documentation
        └─ Create portable ZIP
        
                    ↓
        
[unified_installer.iss (Inno Setup)]
    ├─ Compile installer
    ├─ Package all releases
    ├─ Create MSI/EXE
    └─ Output: I2V-MQTT-Ingestion-Installer.exe

                    ↓
                
Final Artifacts (dist/)
├─ I2V_MQTT_Ingestion_System_v1.0.3/     (Release directory)
├─ I2V-MQTT-Ingestion-Installer.exe       (Windows installer)
├─ I2V-MQTT-Ingestion-Portable.zip        (Portable package)
└─ BUILD_REPORT.txt                       (Build report)
```

## Quick Start

### 1. Build Everything

```powershell
cd c:\Users\mevis\MQTT-Ingetsion

# Run the build executor (with validation)
.\run_build.ps1 -Version "1.0.3"

# Or run the build directly
.\build_production_release.ps1 -Version "1.0.3"
```

### 2. Verify Artifacts

```powershell
# Run verification tests
.\verify_release.ps1 -Version "1.0.3"
```

### 3. Deploy

```powershell
# Use the installer
.\dist\I2V-MQTT-Ingestion-Installer-v1.0.3.exe

# Or extract portable ZIP
Expand-Archive .\dist\I2V-MQTT-Ingestion-Portable-v1.0.3.zip -DestinationPath "C:\I2V"
```

## Detailed Build Steps

### Prerequisites

#### System Requirements
- **Windows 10/11 or Windows Server 2019+**
- **Node.js 18.x or higher**
- **npm 9.x or higher**
- **PowerShell 5.1 or Core 7.x**
- **4 GB RAM minimum**
- **1 GB free disk space**

#### Optional: Installer Creation
- **Inno Setup 6** (for creating .exe installer)
  - Download: https://jrsoftware.org/ispack.php
  - Install: Default installation recommended
  - Verify: `Get-Item "C:\Program Files (x86)\Inno Setup 6\iscc.exe"`

#### Optional: Service Management
- **NSSM (Network Service Script Manager)** (for Windows service registration)
  - Download: https://nssm.cc/download
  - Extract to `C:\Program Files\NSSM`
  - Add to PATH

### Setup

```powershell
# 1. Clone repository (if not already done)
git clone https://github.com/i-am-vishall/MQTT-Ingestion.git
cd MQTT-Ingestion

# 2. Verify Node.js and npm
node --version    # Should be v18.x or higher
npm --version     # Should be 9.x or higher

# 3. Verify project structure
ls ingestion-service
ls config-ui
ls db
```

### Step 1: Unit & Integration Tests

```powershell
# Run test suite
npm test

# Expected output:
# Test Suites: 6 passed, 6 total
# Tests:       128 passed, 128 total
# Time:        ~5 seconds
```

### Step 2: Build Ingestion Service

```powershell
cd ingestion-service

# Install dependencies
npm install --production

# Compile to Windows executable
npx pkg . --targets node18-win-x64 --output dist/i2v-ingestion-service.exe

# Verify
.\dist\i2v-ingestion-service.exe --help  # Should show help or execute
```

**Output**: `ingestion-service/dist/i2v-ingestion-service.exe`

### Step 3: Build Frontend (React + Vite)

```powershell
cd config-ui/client

# Install dependencies
npm install

# Build production-optimized bundles
npm run build

# Output: dist/ folder with:
# - index.html
# - assets/
# - favicon.svg
# - vite.svg
```

**Output**: `config-ui/client/dist/` (optimized static assets)

### Step 4: Build Backend Config Service

```powershell
cd config-ui/server

# Install dependencies
npm install --production

# Compile to Windows executable
npx pkg . --targets node18-win-x64 --output dist/i2v-config-service.exe

# Verify
.\dist\i2v-config-service.exe --help
```

**Output**: `config-ui/server/dist/i2v-config-service.exe`

### Step 5: Assemble Release Package

```powershell
# Directory structure created:
# dist/
# └─ I2V_MQTT_Ingestion_System_v1.0.3/
#    ├─ bin/
#    │  ├─ i2v-ingestion-service.exe
#    │  └─ i2v-config-service.exe
#    ├─ client/
#    │  ├─ index.html
#    │  └─ assets/
#    ├─ db/
#    │  ├─ init_schema.sql
#    │  └─ init_mapping_schema.sql
#    ├─ config/
#    ├─ scripts/
#    ├─ logs/  (empty, created for service logs)
#    ├─ .env.example
#    ├─ install.bat
#    ├─ uninstall.bat
#    └─ README.md
```

### Step 6: Create Portable Package

```powershell
# Create ZIP archive
Compress-Archive -Path "I2V_MQTT_Ingestion_System_v1.0.3" `
                 -DestinationPath "I2V-MQTT-Ingestion-Portable-v1.0.3.zip"

# Size: ~100-200 MB (depending on dependencies)
```

**Output**: `dist/I2V-MQTT-Ingestion-Portable-v1.0.3.zip`

### Step 7: Create Windows Installer (Optional)

```powershell
# Use Inno Setup to package as .exe installer
iscc I2V_Installer_1.0.3.iss

# Generates:
# - I2V-MQTT-Ingestion-Installer-v1.0.3.exe
# - Includes all files from release directory
# - Automatic service registration
# - Desktop shortcuts
# - Uninstall support
```

**Output**: `dist/I2V-MQTT-Ingestion-Installer-v1.0.3.exe`

## Build Configuration

### Package.json Configuration

#### Ingestion Service (`ingestion-service/package.json`)

```json
{
  "name": "i2v-ingestion-service",
  "version": "1.0.2",
  "description": "MQTT to PostgreSQL ingestion service",
  "main": "src/index.js",
  "bin": "src/index.js",
  "pkg": {
    "targets": ["node18-win-x64"],
    "outputPath": "dist",
    "scripts": ["src/**/*.js"],
    "assets": ["config/**/*", "db/**/*"]
  }
}
```

#### Frontend (`config-ui/client/package.json`)

```json
{
  "name": "i2v-config-ui",
  "version": "1.0.3",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^6.20.0"
  }
}
```

#### Config Service (`config-ui/server/package.json`)

```json
{
  "name": "i2v-config-service",
  "version": "1.0.3",
  "main": "index.js",
  "bin": "index.js",
  "pkg": {
    "targets": ["node18-win-x64"],
    "outputPath": "dist"
  }
}
```

## Environmental Variables

### Build-Time Variables

Set in PowerShell before running build:

```powershell
# Version
$env:BUILD_VERSION = "1.0.3"

# Feature flags
$env:SKIP_TESTS = $false
$env:BUILD_INSTALLER = $true
$env:BUILD_PORTABLE = $true

# Output
$env:OUTPUT_DIR = "dist"
```

### Runtime Variables

Created in `.env.example` during build:

```env
# MQTT Configuration
MQTT_BROKERS=localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_USE_TLS=false

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
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
```

## Build Output Analysis

### Size Breakdown

```
Component                    Size (approx)
────────────────────────────────────────
ingestion-service.exe        75-90 MB   (Node.js + dependencies compiled)
config-service.exe           70-85 MB   (Express + React assets)
Frontend assets              15-20 MB   (Optimized SPA)
Database scripts             200 KB     (SQL files)
Documentation                100 KB     (README, guides)
────────────────────────────────────────
Total release directory      ~170 MB
Portable ZIP                 ~60-80 MB  (compressed)
Installer EXE                ~80-100 MB (includes all above)
```

### Compression Ratios

```
Format              Compressed Size   Compression Ratio
─────────────────────────────────────────────────
Original Release    ~170 MB          100%
ZIP (GZip)          ~60-80 MB        35-47%
Installer (LZMA2)   ~80-100 MB       47-59%
```

## Build Troubleshooting

### Issue: "npm install" fails with permission errors

**Solution**:
```powershell
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json

# Reinstall
npm install --production
```

### Issue: "pkg" fails to compile executable

**Solution**:
```powershell
# Update pkg to latest
npm install -g pkg@latest

# Check Node.js version
node --version  # Must be 18.x or higher

# Try with specific compression
npx pkg . --targets node18-win-x64 --output app.exe --compress GZip
```

### Issue: Port conflicts (3001, 3333 already in use)

**Solution**:
```powershell
# Check what's using the port
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess

# Kill the process
Stop-Process -Id 1234 -Force

# Or change port in .env
HEALTH_PORT=3334
CONFIG_PORT=3002
```

### Issue: Inno Setup compiler not found

**Solution**:
```powershell
# Install Inno Setup 6
# Download: https://jrsoftware.org/ispack.php
# Then verify:
Get-Item "C:\Program Files (x86)\Inno Setup 6\iscc.exe"

# Or run build without installer
.\build_production_release.ps1 -Version "1.0.3" -SkipTests
```

### Issue: Insufficient disk space

**Solution**:
```powershell
# Check available space
Get-PSDrive C | Select-Object Name, Used, Free

# Free up space
Remove-Item dist -Recurse -Force  # Delete old builds
Remove-Item **/node_modules -Recurse -Force  # Delete dependencies (can reinstall)
```

## Build Automation (CI/CD)

### GitHub Actions Workflow

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
      
      - name: Install Inno Setup
        run: |
          choco install innosetup -y
      
      - name: Run build
        run: |
          .\build_production_release.ps1 -Version ${{ github.ref_name }}
      
      - name: Verify release
        run: |
          .\verify_release.ps1 -Version ${{ github.ref_name }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-${{ github.ref_name }}
          path: dist/
```

## Build Validation Checklist

- [ ] Node.js 18+ installed
- [ ] npm 9+ installed
- [ ] PowerShell 5.1+ available
- [ ] Project structure verified (ingestion-service, config-ui, db folders)
- [ ] All source files present
- [ ] Git history clean or commits documented
- [ ] Database schemas in db/ folder
- [ ] Tests passing (128/128)
- [ ] No development dependencies in production build
- [ ] Version numbers consistent across package.json files
- [ ] .env.example contains all required variables
- [ ] install.bat and uninstall.bat scripts tested
- [ ] README.md documentation complete
- [ ] Inno Setup installed (for installer)
- [ ] Sufficient disk space available (2+ GB)

## Post-Build Steps

1. **Verify Artifacts**
   ```powershell
   .\verify_release.ps1 -Version "1.0.3"
   ```

2. **Test On Clean System**
   - Use virtual machine or fresh Windows installation
   - Follow DEPLOYMENT_GUIDE.md installation steps
   - Verify all services start
   - Test MQTT connectivity
   - Check database operations

3. **Create Release Notes**
   ```markdown
   # v1.0.3 Release Notes
   
   ## New Features
   - ...
   
   ## Bug Fixes
   - Fixed batch queue race conditions
   - Added MQTT connection state monitoring
   - Improved admin authentication security
   
   ## Installation
   Run I2V-MQTT-Ingestion-Installer-v1.0.3.exe
   ```

4. **Tag Release in Git**
   ```powershell
   git tag -a v1.0.3 -m "Release v1.0.3: Production release with bug fixes"
   git push origin v1.0.3
   ```

5. **Publish Artifacts**
   - GitHub Releases
   - Internal artifact repository
   - SharePoint/network drive
   - Update download links

## Support

- **Build Issues**: Check build logs in `dist/BUILD_REPORT.txt`
- **Installation Issues**: See `DEPLOYMENT_GUIDE.md`
- **Runtime Issues**: Check service logs in `logs/` directory
- **GitHub**: https://github.com/i-am-vishall/MQTT-Ingestion/issues

---

**Last Updated**: 2024-01-15
**Version**: 1.0.3

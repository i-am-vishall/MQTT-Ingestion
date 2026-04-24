const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'I2V_Ultimate_Deployment_v9.1');

console.log('🚀 INITIALIZING ULTIMATE ZERO-DEPENDENCY RELEASE BUILD (v9.1)');
console.log('============================================================');

// Cleanup
if (fs.existsSync(distDir)) {
    try {
        fs.rmSync(distDir, { recursive: true, force: true });
    } catch(e) { console.warn('Could not completely remove distDir, might be locked. Proceeding.'); }
}
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const binDir = path.join(distDir, 'bin');
const dbBinDir = path.join(binDir, 'pgsql');
const mqttBinDir = path.join(binDir, 'mosquitto');
const redisBinDir = path.join(binDir, 'redis');

[binDir, dbBinDir, mqttBinDir, redisBinDir, path.join(distDir, 'logs')].forEach(d => fs.mkdirSync(d, { recursive: true }));

// 1. Build Ingestion Service
console.log('\n📦 [1/7] Building Ingestion Service EXE...');
try {
    execSync('npx pkg . --targets node18-win-x64 --output ../I2V_Ultimate_Deployment_v9.1/bin/i2v-ingestion-service.exe', { 
        cwd: path.join(rootDir, 'ingestion-service'), stdio: 'inherit' 
    });
} catch(e) { console.error('Failed ingestion build', e); }

// 2. Build Config UI Backend
console.log('\n📦 [2/7] Building Config UI Backend EXE...');
try {
    execSync('npx pkg . --targets node18-win-x64 --output ../../I2V_Ultimate_Deployment_v9.1/bin/i2v-config-service.exe', { 
        cwd: path.join(rootDir, 'config-ui', 'server'), stdio: 'inherit' 
    });
} catch(e) { console.error('Failed config backend build', e); }

// 3. Build Config UI Frontend
console.log('\n📦 [3/7] Building Config UI Frontend SPA...');
try {
    execSync('npm run build', { 
        cwd: path.join(rootDir, 'config-ui', 'client'), stdio: 'inherit' 
    });
    fs.cpSync(path.join(rootDir, 'config-ui', 'client', 'dist'), path.join(distDir, 'client'), { recursive: true });
} catch(e) { console.error('Failed config frontend build', e); }

// 4. Copy PostgreSQL Binaries
console.log('\n📦 [4/7] Bundling Portable PostgreSQL...');
const pgSrc = path.join(rootDir, 'dist', 'I2V_Smart_City_Release_v1.0.2', 'db', 'pgsql');
if (fs.existsSync(pgSrc)) {
    fs.cpSync(pgSrc, dbBinDir, { recursive: true });
} else {
    console.warn('⚠️ Portable PG binaries not found at ' + pgSrc);
}

// 5. Copy Mosquitto Binaries
console.log('\n📦 [5/7] Bundling Portable Mosquitto (MQTT)...');
const mqttSrc = path.join(rootDir, 'ingestion-service', 'vendor', 'mosquitto');
if (fs.existsSync(mqttSrc)) {
    fs.cpSync(mqttSrc, mqttBinDir, { recursive: true });
}

// 6. Copy Redis Binaries
console.log('\n📦 [6/7] Bundling Portable Redis...');
fs.copyFileSync(path.join(rootDir, 'Redis.zip'), path.join(distDir, 'Redis.zip'));

// 7. Copy NSSM
console.log('\n📦 [7/7] Bundling NSSM Service Manager...');
const nssmSrc = path.join(rootDir, 'monitoring', 'nssm.exe');
if (fs.existsSync(nssmSrc)) {
    fs.copyFileSync(nssmSrc, path.join(binDir, 'nssm.exe'));
}

// 8. Copy Database Schema
fs.copyFileSync(path.join(rootDir, 'db', 'init_schema.sql'), path.join(distDir, 'init_schema.sql'));
fs.copyFileSync(path.join(rootDir, '.env'), path.join(distDir, '.env.example'));

// 9. Generate MASTER INSTALLER
console.log('\n🛠️ Generating Master Installation Script...');
const installBat = `@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set "ROOT_DIR=%~dp0"
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"
set "LOG_FILE=%ROOT_DIR%logs\\installer_full.log"

echo ============================================================
echo   I2V ULTIMATE ZERO-DEPENDENCY INSTALLER (v9.1 - UNIFIED ARCHITECTURE)
echo ============================================================
echo.
echo Logging everything to: %LOG_FILE%
echo ===== I2V INSTALLATION LOG - %DATE% %TIME% ===== > "%LOG_FILE%"

set "BIN_DIR=%ROOT_DIR%bin"
set "PG_DIR=%BIN_DIR%\\pgsql"
set "MQTT_DIR=%BIN_DIR%\\mosquitto"
set "REDIS_ZIP=%ROOT_DIR%Redis.zip"
set "REDIS_DIR=%BIN_DIR%\\redis"
set "NSSM=%BIN_DIR%\\nssm.exe"

:: Check Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run this script as ADMINISTRATOR.
    pause
    exit /b 1
)

echo [1/6] Extracting Redis...
echo [1/6] Extracting Redis... >> "%LOG_FILE%"
powershell -Command "Expand-Archive -Path '%REDIS_ZIP%' -DestinationPath '%REDIS_DIR%' -Force" >> "%LOG_FILE%" 2>&1

echo [2/6] Initializing PostgreSQL Database...
echo [2/6] Initializing PostgreSQL Database... >> "%LOG_FILE%"

:: CRITICAL FIX: PostgreSQL initdb drops admin privileges for security. 
:: A standard user cannot write to Program Files (x86). We must grant explicit permissions!
icacls "%PG_DIR%" /grant Everyone:(OI)(CI)F /T >> "%LOG_FILE%" 2>&1

if not exist "%PG_DIR%\\data" (
    "%PG_DIR%\\bin\\initdb.exe" -D "%PG_DIR%\\data" -E UTF8 --no-locale -U postgres >> "%LOG_FILE%" 2>&1
    echo host all all 0.0.0.0/0 trust >> "%PG_DIR%\\data\\pg_hba.conf"
    echo listen_addresses = '*' >> "%PG_DIR%\\data\\postgresql.conf"
    echo port = 5441 >> "%PG_DIR%\\data\\postgresql.conf"
    echo logging_collector = on >> "%PG_DIR%\\data\\postgresql.conf"
    echo log_directory = 'pg_log' >> "%PG_DIR%\\data\\postgresql.conf"
    echo log_filename = 'postgresql-%%Y-%%m-%%d_%%H%%M%%S.log' >> "%PG_DIR%\\data\\postgresql.conf"
) else (
    echo Database already initialized, skipping initdb. >> "%LOG_FILE%"
)

echo [3/6] Installing Infrastructure Services (Postgres, Redis, MQTT)...
echo [3/6] Installing Infrastructure Services (Postgres, Redis, MQTT)... >> "%LOG_FILE%"

:: ============================================================
:: 3. CORE STACK (Combined Redis + MQTT + Ingestion)
:: ============================================================
echo [3/5] Installing Core Stack (MQTT, Redis, Ingestion)...
echo [3/5] Installing Core Stack (MQTT, Redis, Ingestion)... >> "%LOG_FILE%"

:: Cleanup old 5-service architecture if exists
sc stop I2V-PostgreSQL >> "%LOG_FILE%" 2>&1
sc delete I2V-PostgreSQL >> "%LOG_FILE%" 2>&1
"%NSSM%" stop I2V-Redis >> "%LOG_FILE%" 2>&1
"%NSSM%" remove I2V-Redis confirm >> "%LOG_FILE%" 2>&1
"%NSSM%" stop I2V-MQTT >> "%LOG_FILE%" 2>&1
"%NSSM%" remove I2V-MQTT confirm >> "%LOG_FILE%" 2>&1
"%NSSM%" stop I2V-Ingestion >> "%LOG_FILE%" 2>&1
"%NSSM%" remove I2V-Ingestion confirm >> "%LOG_FILE%" 2>&1

:: Create the Master Core Launcher if it doesn't exist (failsafe)
echo @echo off > "%BIN_DIR%\\i2v-core-launcher.bat"
echo title I2V Core Stack Launcher >> "%BIN_DIR%\\i2v-core-launcher.bat"
echo taskkill /F /IM redis-server.exe /T >> "%BIN_DIR%\\i2v-core-launcher.bat"
echo taskkill /F /IM mosquitto.exe /T >> "%BIN_DIR%\\i2v-core-launcher.bat"
echo start /b "" "%%~dp0redis\\redis-server.exe" >> "%BIN_DIR%\\i2v-core-launcher.bat"
echo start /b "" "%%~dp0mosquitto\\mosquitto.exe" >> "%BIN_DIR%\\i2v-core-launcher.bat"
echo "%%~dp0i2v-ingestion-service.exe" >> "%BIN_DIR%\\i2v-core-launcher.bat"

:: Register Unified Service
"%NSSM%" stop I2V-mqtt-Ingestion >> "%LOG_FILE%" 2>&1
"%NSSM%" remove I2V-mqtt-Ingestion confirm >> "%LOG_FILE%" 2>&1
"%NSSM%" install I2V-mqtt-Ingestion "%BIN_DIR%\\i2v-core-launcher.bat" >> "%LOG_FILE%" 2>&1
"%NSSM%" set I2V-mqtt-Ingestion AppDirectory "%ROOT_DIR%." >> "%LOG_FILE%" 2>&1
"%NSSM%" set I2V-mqtt-Ingestion Description "I2V Unified MQTT Ingestion Stack (MQTT+Redis+Engine)" >> "%LOG_FILE%" 2>&1
"%NSSM%" start I2V-mqtt-Ingestion >> "%LOG_FILE%" 2>&1

:: ============================================================
:: 4. DATABASE SERVICE (Renamed with Port)
:: ============================================================
echo [4/5] Installing PostgreSQL-5441...
echo [4/5] Installing PostgreSQL-5441... >> "%LOG_FILE%"
sc stop I2V-PostgreSQL-5441 >> "%LOG_FILE%" 2>&1
sc delete I2V-PostgreSQL-5441 >> "%LOG_FILE%" 2>&1
taskkill /F /IM postgres.exe >> "%LOG_FILE%" 2>&1
ping 127.0.0.1 -n 3 >nul

"%PG_DIR%\\bin\\pg_ctl.exe" register -N "I2V-PostgreSQL-5441" -D "%PG_DIR%\\data" -S auto >> "%LOG_FILE%" 2>&1
sc start I2V-PostgreSQL-5441 >> "%LOG_FILE%" 2>&1

:: Wait for DB
ping 127.0.0.1 -n 10 >nul

:: Schema Init
"%PG_DIR%\\bin\\psql.exe" -U postgres -d postgres -p 5441 -f "%ROOT_DIR%init_schema.sql" >> "%LOG_FILE%" 2>&1

:: ============================================================
:: 5. CONFIG UI SERVICE (Renamed with Port)
:: ============================================================
echo [5/5] Installing Config-UI-3001...
echo [5/5] Installing Config-UI-3001... >> "%LOG_FILE%"
"%NSSM%" stop I2V-Config-UI-3001 >> "%LOG_FILE%" 2>&1
"%NSSM%" remove I2V-Config-UI-3001 confirm >> "%LOG_FILE%" 2>&1
:: Also cleanup old name
"%NSSM%" stop I2V-Config-UI >> "%LOG_FILE%" 2>&1
"%NSSM%" remove I2V-Config-UI confirm >> "%LOG_FILE%" 2>&1

"%NSSM%" install I2V-Config-UI-3001 "%BIN_DIR%\i2v-config-service.exe" >> "%LOG_FILE%" 2>&1
"%NSSM%" set I2V-Config-UI-3001 AppDirectory "%ROOT_DIR%." >> "%LOG_FILE%" 2>&1
"%NSSM%" set I2V-Config-UI-3001 start >> "%LOG_FILE%" 2>&1

echo.
echo [FINAL] Verifying Services...
sc query I2V-PostgreSQL-5441 | find "RUNNING" >nul
if %errorLevel% equ 0 (echo I2V-PostgreSQL-5441: RUNNING) else (echo I2V-PostgreSQL-5441: FAILED)
sc query I2V-mqtt-Ingestion | find "RUNNING" >nul
if %errorLevel% equ 0 (echo I2V-mqtt-Ingestion: RUNNING) else (echo I2V-mqtt-Ingestion: FAILED)
sc query I2V-Config-UI-3001 | find "RUNNING" >nul
if %errorLevel% equ 0 (echo I2V-Config-UI-3001: RUNNING) else (echo I2V-Config-UI-3001: FAILED)

echo ============================================================
echo   INSTALLATION COMPLETE (v9.0 Unified Architecture)
echo ============================================================
echo   Unified Stack: I2V-mqtt-Ingestion
echo   Database: I2V-PostgreSQL-5441
echo   Dashboard: I2V-Config-UI-3001
echo ============================================================
`;

// Remove tee polyfill since we replaced it with direct echo
// fs.writeFileSync(path.join(distDir, 'tee.bat'), teeBat);
fs.writeFileSync(path.join(distDir, 'INSTALL_EVERYTHING.bat'), installBat);

// Create ZIP
console.log('\n🤐 Zipping the Ultimate Release...');
execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${rootDir}\\I2V_Ultimate_Release_v9.1.zip' -Force"`);

// 10. Generate Inno Setup Installer
console.log('\n📦 [8/8] Generating Inno Setup Executable Installer...');
const innoSetupPath = "C:\\Program Files (x86)\\Inno Setup 6\\iscc.exe";
if (fs.existsSync(innoSetupPath)) {
    const issContent = `
[Setup]
AppName=I2V Smart City Ingestion
AppVersion=9.1
DefaultDirName={commonpf32}\\I2V-Smart-Ingestion
DefaultGroupName=I2V Smart City Ingestion
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=${rootDir.replace(/\\/g, '\\\\')}
OutputBaseFilename=I2V_Ultimate_Installer_v9.1
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "${distDir.replace(/\\/g, '\\\\')}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{app}\\INSTALL_EVERYTHING.bat"; StatusMsg: "Installing Services & Initializing Databases..."; Flags: waituntilterminated runhidden; WorkingDir: "{app}"
`;
    const issFile = path.join(rootDir, "ultimate_installer.iss");
    fs.writeFileSync(issFile, issContent);
    try {
        execSync(`"${innoSetupPath}" "${issFile}"`, { stdio: 'inherit' });
        console.log('\n✅ SUCCESS! Ultimate EXE Installer created at: ' + path.join(rootDir, 'I2V_Ultimate_Installer_v9.1.exe'));
    } catch(e) {
        console.error('Failed to run Inno Setup', e.message);
    }
} else {
    console.log('Inno setup not found, skipping exe generation');
}

console.log('\n✅ SUCCESS! Portable Zip created at: ' + path.join(rootDir, 'I2V_Ultimate_Release_v9.1.zip'));

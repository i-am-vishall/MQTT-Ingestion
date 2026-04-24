@echo off
REM ============================================================
REM  DEV SCRIPT 2: Start MQTT Ingestion Service (Local Dev Mode)
REM
REM  - Reads config from:  C:\Users\mevis\MQTT-Ingetsion\.env
REM  - Runs entry point:   ingestion-service\src\index.js
REM  - Logs visible directly in this terminal window
REM  - Does NOT touch the production service
REM ============================================================

title [DEV] Ingestion Service

echo ============================================================
echo  I2V MQTT INGESTION — DEV INGESTION SERVICE
echo ============================================================
echo  Mode    : LOCAL DEV  (NOT the NSSM production service)
echo  Config  : .env (DB port 5441, SHOCK_ABSORBER_MODE=false)
echo  Entry   : ingestion-service\src\index.js
echo ============================================================
echo.

:: Verify DB is reachable before starting
echo [1/2] Verifying PostgreSQL is reachable on 5441...
node -e "const {Pool}=require('pg');const p=new Pool({user:'postgres',host:'127.0.0.1',database:'mqtt_alerts_db',password:process.env.DB_PASSWORD||'',port:5441});p.query('SELECT 1').then(()=>{console.log('[OK] DB connection OK');p.end();process.exit(0)}).catch(e=>{console.error('[FAIL] DB not reachable:',e.message);p.end();process.exit(1)})" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] PostgreSQL is NOT running. Please run start_db.bat first.
    echo.
    pause
    exit /b 1
)

echo [2/2] Starting ingestion service...
echo       Press Ctrl+C to stop.
echo ============================================================
echo.

:: Run from the ingestion-service directory so relative paths resolve correctly
cd /d "%~dp0..\ingestion-service"
node src/index.js

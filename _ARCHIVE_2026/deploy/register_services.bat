@echo off
TITLE i2V Service Registration
cd /d "%~dp0"

echo ==========================================
echo   i2V Service Registration (Manual Mode)
echo ==========================================

:: 1. CHECK POSTGRESQL
if not exist "pgsql\bin\pg_ctl.exe" (
    echo [ERROR] PostgreSQL not found! 
    echo Please copy the 'pgsql' folder inside: 
    echo "%~dp0"
    echo.
    echo Expected: "%~dp0pgsql\bin\pg_ctl.exe"
    pause
    exit /b 1
)

set "PG_BIN=%~dp0pgsql\bin"
set "DATA_DIR=%~dp0data"
set "PG_SERVICE_NAME=i2v-mqtt-ingestion-PGSQL-5441"

:: 2. CLEANUP
echo [Step 1] Cleaning up old services...
net stop "%PG_SERVICE_NAME%" >nul 2>&1
sc delete "%PG_SERVICE_NAME%" >nul 2>&1
:: Kill Port 5441
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5441" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

:: Remove old data for fresh install
if exist "%DATA_DIR%" (
    echo Removing old data...
    rmdir /s /q "%DATA_DIR%"
    timeout /t 2 /nobreak >nul
)

:: 3. INIT DB
echo [Step 2] Initializing Database...
mkdir "%DATA_DIR%"
"%PG_BIN%\initdb.exe" -D "%DATA_DIR%" -U postgres -A trust -E UTF8
echo port = 5441 >> "%DATA_DIR%\postgresql.conf"
echo listen_addresses = '*' >> "%DATA_DIR%\postgresql.conf"

:: 4. REGISTER SERVICES
echo [Step 3] Registering Database Service...
"%PG_BIN%\pg_ctl.exe" register -N "%PG_SERVICE_NAME%" -D "%DATA_DIR%" -S auto
echo Starting DB...
net start "%PG_SERVICE_NAME%"
timeout /t 5 /nobreak >nul

echo [Step 4] Setup Database Schema...
if exist "setup_db.exe" (
    setup_db.exe
) else (
    echo [WARNING] setup_db.exe not found!
)

echo [Step 5] Registering App Service...
service-wrapper.exe install
service-wrapper.exe start

echo ==========================================
echo          INSTALLATION COMPLETE
echo ==========================================
pause

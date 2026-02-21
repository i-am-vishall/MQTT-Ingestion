@echo on
TITLE MQTT Ingestion Installer (Manual)
cd /d "%~dp0"

set "SOURCE_DIR=%~dp0"
set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "DATA_DIR=%INSTALL_DIR%\data"
set "PG_SERVICE_NAME=i2v-mqtt-ingestion-PGSQL-5441"
set "INGESTION_SERVICE_NAME=MQTT_Ingestion_Service"

echo ===================================================
echo      i2V MQTT Ingestion Installer (Manual Fix)
echo ===================================================
echo Source:  %SOURCE_DIR%
echo Target:  %INSTALL_DIR%
echo Service: %PG_SERVICE_NAME%
echo ===================================================

:: ----------------------------------------------------------------
:: 0. CLEANUP
:: ----------------------------------------------------------------
echo [Method] Force Clean Install on Port 5441...
net stop "%PG_SERVICE_NAME%" >nul 2>&1
sc delete "%PG_SERVICE_NAME%" >nul 2>&1
net stop "PostgreSQL-5441" >nul 2>&1
sc delete "PostgreSQL-5441" >nul 2>&1

echo Clearing port 5441...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5441" ^| find "LISTENING"') do (
    echo Killing process PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

if exist "%DATA_DIR%" (
    echo Deleting old database at %DATA_DIR%...
    rmdir /s /q "%DATA_DIR%"
    timeout /t 2 /nobreak >nul
)

:: ----------------------------------------------------------------
:: 1. COPY FILES
:: ----------------------------------------------------------------
echo [1/6] Installing files...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Copying files from %SOURCE_DIR% to %INSTALL_DIR%...
xcopy /E /I /Y "%SOURCE_DIR%*" "%INSTALL_DIR%\"
if errorlevel 1 goto ErrorCopy

cd /d "%INSTALL_DIR%"

:: ----------------------------------------------------------------
:: 2. IDENTIFY POSTGRESQL BINARIES
:: ----------------------------------------------------------------
echo [2/6] Identifying PostgreSQL installation...
set "PG_BIN="

:: TRIAGE 1: Check if we already have it in target (Self-Contained)
if exist "%INSTALL_DIR%\pgsql\bin\initdb.exe" (
    echo Found bundled binaries in Install Dir.
    set "PG_BIN=%INSTALL_DIR%\pgsql\bin"
    goto InitDB
)

:: TRIAGE 2: Start searching standard paths if not bundled
echo Search standard paths...
if exist "C:\Program Files\PostgreSQL" (
    for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\initdb.exe" set "PG_BIN=%%D\bin"
)
if defined PG_BIN goto FoundPG

if exist "C:\Program Files (x86)\PostgreSQL" (
    for /d %%D in ("C:\Program Files (x86)\PostgreSQL\*") do if exist "%%D\bin\initdb.exe" set "PG_BIN=%%D\bin"
)
if defined PG_BIN goto FoundPG

echo [ERROR] Could not find PostgreSQL binaries anywhere.
echo Please ensure 'pgsql' folder is present in deployment or PostgreSQL is installed.
pause
exit /b 1

:FoundPG
:: Cleanup trailing slash
if "%PG_BIN:~-1%"=="\" set "PG_BIN=%PG_BIN:~0,-1%"
echo Found binaries at: %PG_BIN%

:: ----------------------------------------------------------------
:: 3. ISOLATE BINARIES
:: ----------------------------------------------------------------
echo [3/6] Isolating Binaries...
echo Copying PostgreSQL binaries to %INSTALL_DIR%\pgsql...
xcopy /E /I /Y /Q "%PG_BIN%\..\*" "%INSTALL_DIR%\pgsql\"
if errorlevel 1 goto ErrorCopyBin

set "PG_BIN=%INSTALL_DIR%\pgsql\bin"

:InitDB
:: ----------------------------------------------------------------
:: 4. INITIALIZE DB
:: ----------------------------------------------------------------
echo [4/6] Checking Database Instance...
if exist "%DATA_DIR%\postgresql.conf" goto SkipInit

echo Creating Data Directory...
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
echo Running initdb...
"%PG_BIN%\initdb.exe" -D "%DATA_DIR%" -U postgres -A trust -E UTF8
if errorlevel 1 goto ErrorInit

echo Configuring Port 5441...
echo port = 5441 >> "%DATA_DIR%\postgresql.conf"
echo listen_addresses = '*' >> "%DATA_DIR%\postgresql.conf"

:SkipInit
:: ----------------------------------------------------------------
:: 5. REGISTER DB SERVICE
:: ----------------------------------------------------------------
echo [5/6] Configuration DB Service...
"%PG_BIN%\pg_ctl.exe" register -N "%PG_SERVICE_NAME%" -D "%DATA_DIR%" -S auto
:: Ignore error if already exists

echo Starting DB Service...
net start "%PG_SERVICE_NAME%"
timeout /t 5 /nobreak >nul

:: ----------------------------------------------------------------
:: 6. SCHEMA & APP
:: ----------------------------------------------------------------
echo [6/6] Running Schema Setup...
setup_db.exe
if errorlevel 1 goto ErrorSchema

echo [Installing App Service...]
service-wrapper.exe stop >nul 2>&1
service-wrapper.exe uninstall >nul 2>&1
service-wrapper.exe install
if errorlevel 1 goto ErrorApp
service-wrapper.exe start

echo ==========================================
echo DONE! Installed successfully.
echo Use the Configuration UI to verify status.
echo ==========================================
pause
exit /b 0

:ErrorCopy
echo [ERROR] Failed to copy files.
pause
exit /b 1

:ErrorCopyBin
echo [ERROR] Failed to copy PostgreSQL binaries.
pause
exit /b 1

:ErrorInit
echo [ERROR] initdb failed.
pause
exit /b 1

:ErrorSchema
echo [ERROR] setup_db failed.
pause
exit /b 1

:ErrorApp
echo [ERROR] App install failed.
pause
exit /b 1

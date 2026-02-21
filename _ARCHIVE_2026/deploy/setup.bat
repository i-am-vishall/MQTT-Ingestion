@echo on
TITLE MQTT Ingestion Installer
cd /d "%~dp0"

set "SOURCE_DIR=%~dp0"
set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "DATA_DIR=%INSTALL_DIR%\data"
set "PG_SERVICE_NAME=i2v-mqtt-ingestion-PGSQL-5441"
set "INGESTION_SERVICE_NAME=i2v-MQTT-Ingestion-Service"

echo ===================================================
echo      i2V MQTT Ingestion Installer
echo ===================================================
echo Source:  %SOURCE_DIR%
echo Target:  %INSTALL_DIR%
echo Service: %PG_SERVICE_NAME%
echo ===================================================

:: ----------------------------------------------------------------
:: 0. CLEANUP (Port 5441 & Old Data)
:: ----------------------------------------------------------------
echo [Method] Force Clean Install on Port 5441...

:: 1. Stop & Delete Known Services
echo Removing existing services...
net stop "%PG_SERVICE_NAME%" >nul 2>&1
sc delete "%PG_SERVICE_NAME%" >nul 2>&1
net stop "PostgreSQL-5441" >nul 2>&1
sc delete "PostgreSQL-5441" >nul 2>&1

:: 2. Kill any process listening on 5441
echo Clearing port 5441...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5441" ^| find "LISTENING"') do (
    echo Killing process PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

:: 3. Delete Data Directory (Fresh DB)
if exist "%DATA_DIR%" (
    echo Deleting old database at %DATA_DIR%...
    rmdir /s /q "%DATA_DIR%"
    REM Wait a moment for file lock release
    timeout /t 2 /nobreak >nul
)

:: ----------------------------------------------------------------
:: 1. COPY FILES TO INSTALL DIR
:: ----------------------------------------------------------------
echo [1/6] Installing files...

if not exist "%INSTALL_DIR%" (
    echo Creating Install Directory...
    mkdir "%INSTALL_DIR%"
)

echo Copying files...
xcopy /E /I /Y "%SOURCE_DIR%*" "%INSTALL_DIR%\"
if errorlevel 1 goto ErrorCopy

:: Switch to Install Directory for remaining operations
cd /d "%INSTALL_DIR%"

:: ----------------------------------------------------------------
:: 1. IDENTIFY POSTGRESQL BINARIES
:: ----------------------------------------------------------------
echo [2/6] Identifying PostgreSQL installation...
set "PG_BIN="

:: Check 1: Standard x64
if exist "C:\Program Files\PostgreSQL" goto CheckStandard64
goto CheckStandard86

:CheckStandard64
echo Checking C:\Program Files\PostgreSQL...
for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\initdb.exe" set "PG_BIN=%%D\bin"
if defined PG_BIN goto FoundPG

:CheckStandard86
if exist "C:\Program Files (x86)\PostgreSQL" goto CheckStandard86Run
goto CheckPgAdmin

:CheckStandard86Run
echo Checking C:\Program Files (x86)\PostgreSQL...
for /d %%D in ("C:\Program Files (x86)\PostgreSQL\*") do if exist "%%D\bin\initdb.exe" set "PG_BIN=%%D\bin"
if defined PG_BIN goto FoundPG

:CheckPgAdmin
if not exist "C:\Program Files\pgAdmin 4" goto CheckAnalytics
echo Checking pgAdmin 4...
for /f "delims=" %%F in ('dir /b /s "C:\Program Files\pgAdmin 4\initdb.exe" 2^>nul') do set "PG_BIN=%%~dpF"
if defined PG_BIN goto FoundPG

:CheckAnalytics
if not exist "C:\Program Files\Analytics\pgsql\bin\initdb.exe" goto CheckAxe
echo Found in Analytics...
set "PG_BIN=C:\Program Files\Analytics\pgsql\bin"
goto FoundPG

:CheckAxe
if not exist "C:\Program Files (x86)\Axe_CAC\pgsql\bin\initdb.exe" goto DeepScan
echo Found in Axe_CAC...
set "PG_BIN=C:\Program Files (x86)\Axe_CAC\pgsql\bin"
goto FoundPG

:DeepScan
echo [WARNING] Quick checks failed. Starting deep scan...
for /f "delims=" %%F in ('dir /b /s "C:\Program Files\initdb.exe" 2^>nul') do set "PG_BIN=%%~dpF"
if defined PG_BIN goto FoundPG

for /f "delims=" %%F in ('dir /b /s "C:\Program Files (x86)\initdb.exe" 2^>nul') do set "PG_BIN=%%~dpF"
if defined PG_BIN goto FoundPG

echo [ERROR] Could not find 'initdb.exe'.
pause
exit /b 1

:FoundPG
:: Cleanup trailing slash
if "%PG_BIN:~-1%"=="\" set "PG_BIN=%PG_BIN:~0,-1%"
echo Found binaries at: %PG_BIN%

:: ----------------------------------------------------------------
:: 2. ISOLATE BINARIES (Make Self-Contained)
:: ----------------------------------------------------------------
echo [3/6] Isolating Binaries...
if exist "%INSTALL_DIR%\pgsql\bin\initdb.exe" (
    echo Binaries already isolated.
    set "PG_BIN=%INSTALL_DIR%\pgsql\bin"
    goto InitDB
)

echo Copying PostgreSQL binaries to %INSTALL_DIR%\pgsql...
:: Copy from parent of bin (the root pgsql folder)
xcopy /E /I /Y /Q "%PG_BIN%\..\*" "%INSTALL_DIR%\pgsql\"
if errorlevel 1 goto ErrorCopyBin

set "PG_BIN=%INSTALL_DIR%\pgsql\bin"
echo Isolation Complete. Using: %PG_BIN%

:InitDB
:: ----------------------------------------------------------------
:: 3. INITIALIZE NEW DB INSTANCE
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
goto RegisterService

:SkipInit
echo Data Directory exists.

:RegisterService
:: ----------------------------------------------------------------
:: 4. REGISTER DB SERVICE
:: ----------------------------------------------------------------
echo [5/6] Configuring Service...
echo Stopping and Unregistering any existing service...
net stop "%PG_SERVICE_NAME%" >nul 2>&1
"%PG_BIN%\pg_ctl.exe" unregister -N "%PG_SERVICE_NAME%" >nul 2>&1
timeout /t 2 /nobreak >nul

echo Registering %PG_SERVICE_NAME%...
"%PG_BIN%\pg_ctl.exe" register -N "%PG_SERVICE_NAME%" -D "%DATA_DIR%" -S auto
if errorlevel 1 goto ErrorService

:ServiceRunning
echo Starting DB Service...
net start "%PG_SERVICE_NAME%" >nul 2>&1
timeout /t 5 /nobreak >nul

:: ----------------------------------------------------------------
:: 5. SCHEMA & APP
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
echo DONE! Installed to: %INSTALL_DIR%
echo DB Service: %PG_SERVICE_NAME%
echo App Service: %INGESTION_SERVICE_NAME%
echo ==========================================
pause
exit /b 0

:ErrorCopy
echo [ERROR] Failed to copy files. Run as Admin?
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

:ErrorService
echo [ERROR] Service registration failed. Run as Admin?
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

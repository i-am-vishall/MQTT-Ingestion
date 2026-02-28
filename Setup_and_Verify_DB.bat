@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V MQTT INGESTION - POSTGRESQL DATABASE SETUP ^& VERIFICATION TOOL
echo ==============================================================
echo.

REM Set paths and connection details
set "PSQL_PATH=C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe"
set "SCHEMA_FILE=C:\Program Files (x86)\i2v-MQTT-Ingestion\db\init_schema.sql"
set DB_NAME=mqtt_alerts_db
set DB_USER=postgres
set DB_PORT=5441

REM 1. Check if psql tools exist
if not exist "%PSQL_PATH%" (
    echo [ERROR] PostgreSQL Tools not found at:
    echo "%PSQL_PATH%"
    echo Please make sure the I2V System is fully installed on this machine.
    echo.
    pause
    exit /b 1
)

REM 2. Create the Database by connecting to the default 'postgres' db first
echo [1/4] Ensuring the database '%DB_NAME%' exists...
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d postgres -c "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'" | find /I "1" >nul
if %errorlevel% neq 0 (
    echo Database '%DB_NAME%' does not exist. Creating it now...
    "%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d postgres -c "CREATE DATABASE %DB_NAME%;"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create database! Is the 'i2v-mqtt-ingestion-PGSQL-5441' service running?
        pause
        exit /b 1
    )
    echo [OK] Database created successfully.
) else (
    echo [OK] Database already exists.
)
echo.

REM 3. Check if schema file exists. If so, apply it.
echo [2/4] Applying Schema (Tables, Views, Triggers)...
if exist "%SCHEMA_FILE%" (
    "%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SCHEMA_FILE%"
    echo [OK] Schema applied.
) else (
    echo [WARNING] Schema file not found at "%SCHEMA_FILE%".
    echo Trying to find it in the current directory...
    if exist "db\init_schema.sql" (
        "%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "db\init_schema.sql"
        echo [OK] Schema applied from local db folder.
    ) else (
        echo [ERROR] Could not find init_schema.sql anywhere to apply the tables!
        echo The database exists, but it might be empty.
    )
)
echo.

REM 4. Verify installation
echo [3/4] Listing all Created Tables...
echo --------------------------------------------------------------
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dt"
echo.

echo [4/4] Listing all Created Views...
echo --------------------------------------------------------------
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dv"
echo.

echo ==============================================================
echo SETUP AND VERIFICATION COMPLETE!
echo If you see your tables and views listed above, you are good to go!
echo ==============================================================
pause

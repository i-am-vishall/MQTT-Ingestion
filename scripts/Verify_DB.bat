@echo off
echo ==============================================================
echo I2V MQTT INGESTION - POSTGRESQL DATABASE VERIFICATION TOOL
echo ==============================================================
echo.

REM Path to the bundled PostgreSQL psql.exe
set PSQL_PATH="%~dp0..\pgsql\bin\psql.exe"

REM Database connection details based on the .env defaults and install mapping
set DB_NAME=mqtt_alerts_db
set DB_USER=postgres
set DB_PORT=5441

if not exist %PSQL_PATH% (
    echo [ERROR] PostgreSQL Tools not found at:
    echo %PSQL_PATH%
    echo Please make sure the I2V System is fully installed on this machine.
    echo.
    pause
    exit /b 1
)

echo [1/3] Testing database connection to '%DB_NAME%' on port %DB_PORT%...
%PSQL_PATH% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT 1 as connection_test;"
if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Could not connect to the database '%DB_NAME%'.
    echo Please read the exact error message that PostgreSQL printed just above this line!
    echo Is the 'i2v-mqtt-ingestion-PGSQL-5441' service running?
    echo.
    pause
    exit /b 1
)
echo [OK] Connection successful!
echo.

echo [2/3] Listing all Created Tables (Schema / Setup):
echo --------------------------------------------------------------
%PSQL_PATH% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dt"
echo.

echo [3/3] Listing all Created Views:
echo --------------------------------------------------------------
%PSQL_PATH% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dv"
echo.

echo ==============================================================
echo VERIFICATION COMPLETE.
echo If you see your tables (e.g., raw_mqtt_data, alerts, config) 
echo and views listed above, the database was set up perfectly.
echo ==============================================================
pause

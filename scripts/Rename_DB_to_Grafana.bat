@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V MQTT INGESTION - POSTGRESQL DATABASE RENAMING TOOL
echo ==============================================================
echo.

set "PSQL_PATH=%~dp0..\pgsql\bin\psql.exe"
set OLD_DB_NAME=i2v_ingestion
set NEW_DB_NAME=mqtt_alerts_db
set DB_USER=postgres
set DB_PORT=5441

if not exist "%PSQL_PATH%" (
    echo [ERROR] PostgreSQL Tools not found at:
    echo "%PSQL_PATH%"
    pause
    exit /b 1
)

echo [1/3] Disconnecting all active sessions from '%OLD_DB_NAME%'...
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%OLD_DB_NAME%';" >nul 2>&1

echo [2/3] Renaming database from '%OLD_DB_NAME%' to '%NEW_DB_NAME%'...
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d postgres -c "ALTER DATABASE %OLD_DB_NAME% RENAME TO %NEW_DB_NAME%;"
if !errorlevel! neq 0 (
    echo [ERROR] Failed to rename the database! 
    echo Perhaps the database '%OLD_DB_NAME%' does not exist, or '%NEW_DB_NAME%' already exists?
    pause
    exit /b 1
)

echo [3/3] Verifying the new database name...
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %NEW_DB_NAME% -c "SELECT 1 as connection_test;" >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Could not connect to the newly renamed database '%NEW_DB_NAME%'.
    pause
    exit /b 1
)

echo.
echo ==============================================================
echo SUCCESS! Your database has been renamed to: %NEW_DB_NAME%
echo Grafana should now connect to it instantly!
echo ==============================================================
pause

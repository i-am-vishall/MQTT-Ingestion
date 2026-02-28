@echo off
echo ==============================================================
echo I2V MQTT INGESTION - AUTOMANAGE MONTHLY PARTITIONS
echo ==============================================================
echo.

set "PSQL_PATH=C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe"
set DB_NAME=i2v_ingestion
set DB_USER=postgres
set DB_PORT=5441
set "SQL_SCRIPT=%~dp0db\auto_partition.sql"

if not exist "%PSQL_PATH%" (
    echo [ERROR] PostgreSQL Tools not found at:
    echo "%PSQL_PATH%"
    pause
    exit /b 1
)

echo Executing the Auto-Partition stored procedure...
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SQL_SCRIPT%"

echo.
echo Process complete.
pause

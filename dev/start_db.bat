@echo off
REM ============================================================
REM  DEV SCRIPT 1: Start PostgreSQL (port 5441)
REM  This starts the i2v-mqtt-ingestion-PGSQL-5441 Windows service
REM  which is the dedicated PostgreSQL instance for this project.
REM ============================================================

title [DEV] PostgreSQL Database - Port 5441

echo ============================================================
echo  I2V MQTT INGESTION — DEV DATABASE
echo  Starting PostgreSQL on port 5441...
echo ============================================================

:: Check if already running
sc query "i2v-mqtt-ingestion-PGSQL-5441" | find "RUNNING" >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] PostgreSQL is already running.
    echo      Database: mqtt_alerts_db @ 127.0.0.1:5441
    goto :done
)

:: Start the service
echo [..] Starting PostgreSQL service...
net start "i2v-mqtt-ingestion-PGSQL-5441"

if %ERRORLEVEL% == 0 (
    echo [OK] PostgreSQL started successfully.
    echo      Database: mqtt_alerts_db @ 127.0.0.1:5441
) else (
    echo [FAIL] Could not start PostgreSQL service.
    echo        Check Windows Services for "i2v-mqtt-ingestion-PGSQL-5441"
)

:done
echo.
echo  To stop: net stop "i2v-mqtt-ingestion-PGSQL-5441"
echo ============================================================
pause

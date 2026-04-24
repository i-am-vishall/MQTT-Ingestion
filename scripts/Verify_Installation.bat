@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V MQTT INGESTION - COMPLETE INSTALLATION VERIFICATION TOOL
echo ==============================================================
echo.

set "INSTALL_DIR=%~dp0.."
set "PSQL_PATH=%INSTALL_DIR%\pgsql\bin\psql.exe"
set DB_NAME=mqtt_alerts_db
set DB_USER=postgres
set DB_PORT=5441
set PAGER=more

echo [1/4] Checking Installation Directory...
if not exist "%INSTALL_DIR%" (
    echo [ERROR] Installation directory not found: "%INSTALL_DIR%"
    echo The system does not appear to be installed on this machine.
    pause
    exit /b 1
)
echo [OK] Installation directory found.
echo.

echo [2/4] Checking Required Windows Services...
set "SERVICES=i2v-MQTT-Ingestion-Service i2v-config-ui i2v-influxdb i2v-telegraf i2v-mqtt-ingestion-PGSQL-5441"
set "ALL_SERVICES_OK=1"

for %%S in (%SERVICES%) do (
    sc query "%%S" | find "RUNNING" >nul
    if !errorlevel! equ 0 (
        echo   [OK] Service '%%S' is RUNNING.
    ) else (
        echo   [ERROR] Service '%%S' is NOT running or not installed!
        set "ALL_SERVICES_OK=0"
    )
)

if !ALL_SERVICES_OK! equ 0 (
    echo.
    echo [WARNING] One or more services are not running. Please check the Windows Services application (services.msc^).
) else (
    echo [OK] All I2V Windows Services are successfully running!
)
echo.

echo [3/4] Testing PostgreSQL Database Connection...
if not exist "%PSQL_PATH%" (
    echo [ERROR] PostgreSQL Tools not found at: "%PSQL_PATH%"
    pause
    exit /b 1
)

"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT 1 as connection_test;" >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Could not connect to the database '%DB_NAME%'.
    echo Is the PostgreSQL service completely started?
    pause
    exit /b 1
)
echo [OK] Connected to database '%DB_NAME%' successfully!
echo.

echo [4/4] Verifying Database Schema (Tables and Views)...
echo --------------------------------------------------------------
echo =^> LIST OF CREATED TABLES:
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dt"
echo.
echo =^> LIST OF CREATED VIEWS:
"%PSQL_PATH%" -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\dv"
echo.

echo ==============================================================
echo VERIFICATION COMPLETE!
echo If all services show [OK] and the database tables/views are 
echo listed above, the installation was 100%% successful!
echo ==============================================================
pause

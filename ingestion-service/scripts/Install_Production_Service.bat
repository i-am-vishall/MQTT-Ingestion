@echo off
:: Enable UTF-8 to prevent symbol or character errors (Crash-proof protection)
chcp 65001 >nul

echo ========================================================
echo   MQTT Ingestion Service - Production Installer
echo ========================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Administrator privileges confirmed.
) else (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click and select "Run as administrator".
    pause
    exit /B 1
)

:: Define the target installation directory
set TARGET_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion
set CURRENT_DIR=%~dp0

:: Remove trailing backslash from CURRENT_DIR
if "%CURRENT_DIR:~-1%"=="\" set CURRENT_DIR=%CURRENT_DIR:~0,-1%

:: Check if we are already in the target directory
if /I "%CURRENT_DIR%"=="%TARGET_DIR%" (
    echo [INFO] Running from the target directory. Proceeding to service installation...
    goto INSTALL_SERVICE
)

echo [INFO] Target installation directory is: %TARGET_DIR%
echo [INFO] Currently running from: %CURRENT_DIR%

:: Create Target Directory if it doesn't exist
if not exist "%TARGET_DIR%" (
    echo [INFO] Creating directory %TARGET_DIR%...
    mkdir "%TARGET_DIR%"
)

:: Copy Files
echo [INFO] Copying files to %TARGET_DIR%...
xcopy "%CURRENT_DIR%\*" "%TARGET_DIR%\" /Y /E

:: Change working directory to target directory to verify and install
cd /d "%TARGET_DIR%"

:VERIFY_FILES
echo.
echo [INFO] Verifying files...

if not exist "mqtt-ingestion-service.exe" (
    echo [ERROR] mqtt-ingestion-service.exe is missing! Installation aborted.
    pause
    exit /B 1
)

if not exist ".env" (
    echo [ERROR] .env configuration file is missing!
    echo Please ensure the .env file is present in the installation folder.
    pause
    exit /B 1
)

if not exist "init_schema.sql" (
    echo [WARN] init_schema.sql is missing. Ensure the database is already initialized.
) else (
    echo [INFO] init_schema.sql found.
)

echo [INFO] All required files are present.

:INSTALL_SERVICE
echo.
echo [INFO] Installing Windows Service...

:: Stop existing service if it exists
sc query "MQTT Ingestion Service" >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Stopping existing service...
    sc stop "MQTT Ingestion Service" >nul 2>&1
    timeout /T 5 /NOBREAK >nul
    echo [INFO] Deleting existing service...
    sc delete "MQTT Ingestion Service" >nul 2>&1
    timeout /T 2 /NOBREAK >nul
)

:: Create new service
sc create "MQTT Ingestion Service" binPath= "\"%TARGET_DIR%\mqtt-ingestion-service.exe\"" start= auto DisplayName= "MQTT Ingestion Service"
if %errorLevel% NEQ 0 (
    echo [ERROR] Failed to create service.
    pause
    exit /B 1
)

:: Configure service for crash recovery (auto-restart)
echo [INFO] Configuring crash-recovery policies...
sc failure "MQTT Ingestion Service" reset= 0 actions= restart/60000/restart/60000/restart/60000

echo [INFO] Starting service...
sc start "MQTT Ingestion Service"

echo.
echo ========================================================
echo   Installation Completed Successfully!
echo   The service is now running and will auto-restart on crash.
echo ========================================================
pause

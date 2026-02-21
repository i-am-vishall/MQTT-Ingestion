@echo off
:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo --- Updating Service Paths to User Workspace ---

:: 1. Setup NSSM Path (Use local or fallback to Program Files)
set NSSM_EXE=nssm.exe
if not exist "%NSSM_EXE%" (
    if exist "C:\Program Files (x86)\i2v-MQTT-Ingestion\utils\nssm.exe" (
        set NSSM_EXE="C:\Program Files (x86)\i2v-MQTT-Ingestion\utils\nssm.exe"
    ) else (
        echo ERROR: Could not find nssm.exe.
        pause
        exit /b 1
    )
)

echo using NSSM: %NSSM_EXE%

:: 2. Fix Ingestion Service (Point to local Source Code)
echo Updating Ingestion Service...
%NSSM_EXE% set i2v-MQTT-Ingestion-Service Application "node"
%NSSM_EXE% set i2v-MQTT-Ingestion-Service AppDirectory "%~dp0ingestion-service"
%NSSM_EXE% set i2v-MQTT-Ingestion-Service AppParameters "src/index.js"
%NSSM_EXE% set i2v-MQTT-Ingestion-Service AppStdout "%~dp0logs\ingestion-service.log"
%NSSM_EXE% set i2v-MQTT-Ingestion-Service AppStderr "%~dp0logs\ingestion-service.err"
%NSSM_EXE% set i2v-MQTT-Ingestion-Service AppEnvironmentExtra "LOG_DIR=%~dp0logs"

:: 3. Fix Telegraf Service (Point to local Config)
echo Updating Telegraf Service...
:: Keep the existing Application (likely valid exe in Program Files)
:: Update the Config Path
%NSSM_EXE% set i2v-telegraf AppParameters "--config \"%~dp0monitoring\telegraf.conf\""
%NSSM_EXE% set i2v-telegraf AppDirectory "%~dp0monitoring"

:: 4. Restart Services
echo Restarting Services...
net stop i2v-MQTT-Ingestion-Service
net start i2v-MQTT-Ingestion-Service
net stop i2v-telegraf
net start i2v-telegraf

echo Done.
pause

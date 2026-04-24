@echo off
:: Run as Administrator — registers i2v-Config-UI-Service via NSSM
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Must be run as Administrator!
    pause
    exit /b 1
)

set NSSM="C:\Program Files (x86)\I2V\Common\nssm.exe"
set SVC=i2v-Config-UI-Service
set NODE_EXE=node
set SCRIPT="C:\Program Files (x86)\i2v-MQTT-Ingestion\config-ui\server\index.js"
set WORKDIR="C:\Program Files (x86)\i2v-MQTT-Ingestion\config-ui\server"
set LOGDIR="C:\Program Files (x86)\i2v-MQTT-Ingestion\logs"

echo [1/7] Checking if service already exists...
sc query %SVC% >nul 2>&1
if %errorLevel% EQU 0 (
    echo Service already registered - stopping and removing first...
    %NSSM% stop %SVC% >nul 2>&1
    timeout /t 2 /nobreak >nul
    %NSSM% remove %SVC% confirm >nul 2>&1
)

echo [2/7] Installing service...
%NSSM% install %SVC% %NODE_EXE% %SCRIPT%
if %errorLevel% NEQ 0 ( echo FAILED to install service! & pause & exit /b 1 )

echo [3/7] Setting working directory...
%NSSM% set %SVC% AppDirectory %WORKDIR%

echo [4/7] Configuring log files...
%NSSM% set %SVC% AppStdout %LOGDIR%\config-stdout.log
%NSSM% set %SVC% AppStderr %LOGDIR%\config-stderr.log
%NSSM% set %SVC% AppStdoutCreationDisposition 4
%NSSM% set %SVC% AppStderrCreationDisposition 4

echo [5/7] Setting restart policy (10s delay on crash)...
%NSSM% set %SVC% AppRestartDelay 10000

echo [6/7] Setting auto-start...
%NSSM% set %SVC% Start SERVICE_AUTO_START

echo [7/7] Starting service...
%NSSM% start %SVC%
timeout /t 3 /nobreak >nul

echo.
sc query %SVC% | findstr "STATE"
echo.
echo Done! Config UI should be running at http://localhost:3001
echo If it fails: check C:\Program Files (x86)\i2v-MQTT-Ingestion\logs\config-stderr.log
echo.
pause

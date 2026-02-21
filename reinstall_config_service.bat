@echo off
cd /d "%~dp0"
echo ===================================================
echo REINSTALLING CONFIG UI SERVICE (Dev Mode)
echo ===================================================
echo.

set NSSM="monitoring\nssm.exe"
set SERVICE_NAME=i2v-config-ui
set APP_DIR=%~dp0\config-ui\server
set APP_SCRIPT=index.js
set LOG_DIR=%~dp0\logs

if not exist %NSSM% (
    echo ERROR: Could not find NSSM at %NSSM%
    pause
    exit /b
)

if not exist "%APP_DIR%\%APP_SCRIPT%" (
    echo ERROR: Could not find server script at "%APP_DIR%\%APP_SCRIPT%"
    pause
    exit /b
)

echo 1. Stopping existing service...
net stop %SERVICE_NAME%
taskkill /F /FI "SERVICES eq %SERVICE_NAME%"
taskkill /F /IM node.exe /FI "WINDOWTITLE eq i2v-config-ui"

echo 2. Removing service...
%NSSM% remove %SERVICE_NAME% confirm

echo 3. Installing new service...
echo    Path: node
echo    Args: %APP_SCRIPT%
echo    Dir:  %APP_DIR%
echo.

%NSSM% install %SERVICE_NAME% "node" "%APP_SCRIPT%"
%NSSM% set %SERVICE_NAME% AppDirectory "%APP_DIR%"
%NSSM% set %SERVICE_NAME% DisplayName "i2V Config UI Service (Dev)"
%NSSM% set %SERVICE_NAME% Description "Runs the Config UI Backend from Dev folder"
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START
%NSSM% set %SERVICE_NAME% AppStdout "%LOG_DIR%\config-service.log"
%NSSM% set %SERVICE_NAME% AppStderr "%LOG_DIR%\config-service.log"
%NSSM% set %SERVICE_NAME% AppRotateFiles 1
%NSSM% set %SERVICE_NAME% AppRotateOnline 1
%NSSM% set %SERVICE_NAME% AppRotateSeconds 86400
%NSSM% set %SERVICE_NAME% AppRotateBytes 1048576

echo 4. Starting service...
net start %SERVICE_NAME%

echo.
echo ===================================================
echo DONE. Service incorrectly pointed? Fixed now.
echo ===================================================
pause

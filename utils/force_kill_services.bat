@echo off
setlocal
echo ===================================================
echo   I2V EMERGENCY SERVICE KILLER
echo ===================================================

:: Check for Administrator privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo [Check] Running as Administrator: YES

echo.
echo [1/3] Attempting standard service stops...
net stop "i2v-MQTT-Ingestion-Service"
net stop "i2v-Config-UI"
net stop "i2v-mqtt-ingestion-PGSQL-5441"
net stop "i2v-telegraf"
net stop "i2v-influxdb"

echo.
echo [2/3] Force killing specific processes...

:: Kill ALL Service Wrappers (NSSM) - Attempt 1
echo    > Killing Service Wrappers (NSSM) [Pass 1]...
taskkill /F /IM nssm.exe /T 2>nul
timeout /t 1 /nobreak >nul
:: Attempt 2
taskkill /F /IM nssm.exe /T 2>nul

:: Kill ALL Node.js processes - Attempt 1
echo    > Killing ALL Node.js processes [Pass 1]...
taskkill /F /IM node.exe /T 2>nul
timeout /t 1 /nobreak >nul
:: Attempt 2
echo    > Killing ALL Node.js processes [Pass 2]...
taskkill /F /IM node.exe /T 2>nul
timeout /t 1 /nobreak >nul
:: Attempt 3 (Just to be sure)
taskkill /F /IM node.exe /T 2>nul

:: Kill Standalone binaries
echo    > Killing InfluxDB...
taskkill /F /IM influxd.exe /T 2>nul
taskkill /F /IM influxd.exe /T 2>nul
echo    > Killing Telegraf...
taskkill /F /IM telegraf.exe /T 2>nul

echo.
echo [3/3] Checking for remaining processes...
tasklist /FI "IMAGENAME eq node.exe"
tasklist /FI "IMAGENAME eq node.exe"
tasklist /FI "IMAGENAME eq influxd.exe"
tasklist /FI "IMAGENAME eq postgres.exe"

echo.
echo ===================================================
echo   CLEANUP COMPLETE
echo ===================================================
echo ===================================================
echo   CLEANUP COMPLETE
echo ===================================================
exit /b

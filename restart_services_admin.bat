@echo off
echo ===================================================
echo   I2V Restart Script (Centralized Logging)
echo [Check] Requesting Admin Privileges...
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin_r.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin_r.vbs"
    "%temp%\getadmin_r.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin_r.vbs" ( del "%temp%\getadmin_r.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
echo ===================================================

echo [1/3] Forcefully Cleaning Up Old Processes...
call "%~dp0utils\force_kill_services.bat"

:: Small pause to let OS release handles
timeout /t 2 /nobreak >nul

echo.


echo.
echo [3/3] Restarting App Services...
net start "i2v-mqtt-ingestion-PGSQL-5441"
net start "i2v-MQTT-Ingestion-Service"
net start "i2v-Config-UI"

echo.
echo ===================================================
echo   Done. Services Restarted (File-Based Logs).
echo   Verify at: http://localhost:3001/live-logs
echo ===================================================
pause

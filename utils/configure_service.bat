@echo off
echo ===================================================
echo   I2V Sercice Configuration Tunnig
echo   (Fixing Error 1053 / Stuck Stopping)
echo ===================================================

:: Auto-Elevate to Admin
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin_c.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin_c.vbs"
    "%temp%\getadmin_c.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin_c.vbs" ( del "%temp%\getadmin_c.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
    cd ..

echo.
echo [1/2] Configuring "i2v-Config-UI" Timeouts...
:: Wait max 3 seconds for Console (Ctrl+C)
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodConsole 3000
:: Wait max 2 seconds for Window messages
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodWindow 2000
:: Wait max 2 seconds for Threads
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodThreads 2000

echo.
echo [2/2] Configuring "i2v-MQTT-Ingestion-Service" Timeouts...
monitoring\nssm.exe set "i2v-MQTT-Ingestion-Service" AppStopMethodConsole 3000
monitoring\nssm.exe set "i2v-MQTT-Ingestion-Service" AppStopMethodWindow 2000
monitoring\nssm.exe set "i2v-MQTT-Ingestion-Service" AppStopMethodThreads 2000

echo.
echo ===================================================
echo   Configuration Complete!
echo   Please Run 'restart_services_admin.bat' to apply.
echo ===================================================
pause

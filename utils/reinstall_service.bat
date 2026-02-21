@echo off
echo ===================================================
echo   I2V Sercice Re-Installer
echo   (Nuclear Option for Stuck Services)
echo ===================================================

:: Auto-Elevate to Admin
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin_re.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin_re.vbs"
    "%temp%\getadmin_re.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin_re.vbs" ( del "%temp%\getadmin_re.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
    cd ..

echo [1/4] Force Killing Everything...
call "%~dp0\force_kill_services.bat"

echo.
echo [2/4] Removing Old Services...
echo    > Removing i2v-Config-UI...
monitoring\nssm.exe remove "i2v-Config-UI" confirm

echo.
echo [3/4] Re-Installing i2v-Config-UI...
monitoring\nssm.exe install "i2v-Config-UI" "C:\Program Files\nodejs\node.exe"
monitoring\nssm.exe set "i2v-Config-UI" AppDirectory "%CD%\config-ui\server"
monitoring\nssm.exe set "i2v-Config-UI" AppParameters "index.js"
monitoring\nssm.exe set "i2v-Config-UI" DisplayName "i2V Config UI Service"
monitoring\nssm.exe set "i2v-Config-UI" Description "Interface for configuring I2V Alerts"
monitoring\nssm.exe set "i2v-Config-UI" Start SERVICE_AUTO_START

echo    > Applying Stability Settings (The Fix)...
:: Skip "Graceful" console stops if they hang
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodSkip 0
:: Kill aggressively after 3 seconds
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodConsole 3000
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodWindow 2000
monitoring\nssm.exe set "i2v-Config-UI" AppStopMethodThreads 2000
:: Ensure child processes die
monitoring\nssm.exe set "i2v-Config-UI" AppKillProcessTree 1

echo.
echo [4/4] Starting Service...
net start "i2v-Config-UI"

echo.
echo ===================================================
echo   Reinstall Complete!
echo   Service should now be bulletproof.
echo ===================================================
pause

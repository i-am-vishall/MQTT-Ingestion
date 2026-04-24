@echo off
setlocal
title Remove Duplicate Config UI Service

:: Require admin
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs" & exit /B
)
if exist "%temp%\getadmin.vbs" del "%temp%\getadmin.vbs"

set "NSSM=C:\Program Files (x86)\i2v-MQTT-Ingestion\utils\nssm.exe"
set "OLD_SVC=i2v-Config-UI-Service"
set "NEW_SVC=i2v-Config-UI"

echo.
echo  Removing duplicate service: %OLD_SVC%
echo  =========================================
echo.

:: Stop the old paused service first
echo  [1] Stopping old service...
"%NSSM%" stop "%OLD_SVC%" confirm >nul 2>&1
sc.exe stop "%OLD_SVC%" >nul 2>&1
timeout /t 3 /nobreak >nul

:: Remove the old service
echo  [2] Removing old service...
"%NSSM%" remove "%OLD_SVC%" confirm
if errorlevel 1 (
    echo  [!] NSSM remove failed, trying sc.exe...
    sc.exe delete "%OLD_SVC%"
)
timeout /t 2 /nobreak >nul

:: Verify active service is running
echo.
echo  [3] Verifying active service: %NEW_SVC%
sc.exe query "%NEW_SVC%" | findstr /i "RUNNING" >nul
if %errorLevel% EQU 0 (
    echo  [OK] %NEW_SVC% is RUNNING
) else (
    echo  [!] %NEW_SVC% is NOT running - starting it...
    "%NSSM%" start "%NEW_SVC%"
)

echo.
echo  Done! Services.msc should now show only one Config UI service.
echo  Press any key to close.
pause >nul

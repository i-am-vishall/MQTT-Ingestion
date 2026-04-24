@echo off
setlocal enabledelayedexpansion
title Fix i2v-Config-UI-Service (Run as Administrator)
color 0E

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERROR] Must be Run as Administrator!
    pause & exit /b 1
)

set "NSSM=C:\Program Files (x86)\i2v-MQTT-Ingestion\utils\nssm.exe"
set "NODE_APP=C:\Program Files (x86)\i2v-MQTT-Ingestion\config-ui\server\index.js"
set "WORK_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion\config-ui\server"
set "OLD_NSSM=C:\Program Files (x86)\I2V\Common\nssm.exe"
set "SVC=i2v-Config-UI-Service"

echo.
echo =========================================================
echo   Fix Config UI Service
echo =========================================================

:: ── STEP 1: Stop + remove old service registration ───────────────────────────
echo [1/5] Removing old service registration...
"%OLD_NSSM%" stop "%SVC%" >nul 2>&1
net stop "%SVC%" >nul 2>&1
"%OLD_NSSM%" remove "%SVC%" confirm >nul 2>&1
sc.exe delete "%SVC%" >nul 2>&1
timeout /t 2 /nobreak >nul
echo       Done.

:: ── STEP 2: Kill orphaned node processes on port 3001 ────────────────────────
echo [2/5] Killing any process holding port 3001...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr ":3001 "') do (
    if not "%%i"=="0" (
        echo       Killing PID %%i
        taskkill /PID %%i /F >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul

:: Confirm port is free
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul
if %errorLevel% EQU 0 (
    echo  [WARN] Port 3001 still in use. Check manually.
) else (
    echo  [OK] Port 3001 is now free.
)

:: ── STEP 3: Register service with correct NSSM ───────────────────────────────
echo [3/5] Registering service with correct NSSM...
if not exist "!NSSM!" (
    echo  [ERROR] NSSM not found at: !NSSM!
    echo  Trying monitoring folder...
    set "NSSM=C:\Users\mevis\MQTT-Ingetsion\monitoring\nssm.exe"
)

"%NSSM%" install "%SVC%" node "!NODE_APP!" >nul 2>&1
"%NSSM%" set "%SVC%" AppDirectory "!WORK_DIR!"
"%NSSM%" set "%SVC%" DisplayName "i2V Config UI Service"
"%NSSM%" set "%SVC%" Description "i2V MQTT Ingestion Admin Dashboard"
"%NSSM%" set "%SVC%" Start SERVICE_AUTO_START
"%NSSM%" set "%SVC%" AppStdout "C:\ProgramData\I2V\Logs\config\config-stdout.log"
"%NSSM%" set "%SVC%" AppStderr "C:\ProgramData\I2V\Logs\config\config-error.log"
"%NSSM%" set "%SVC%" AppRotateFiles 1
"%NSSM%" set "%SVC%" AppRotateSeconds 86400
"%NSSM%" set "%SVC%" AppRestartDelay 5000
echo       Service registered.

:: ── STEP 4: Start service ────────────────────────────────────────────────────
echo [4/5] Starting service...
"%NSSM%" start "%SVC%" >nul 2>&1
timeout /t 6 /nobreak >nul

:: ── STEP 5: Verify ───────────────────────────────────────────────────────────
echo [5/5] Verifying...
sc.exe query "%SVC%" | findstr "STATE" | findstr "RUNNING" >nul
if !errorLevel! EQU 0 (
    echo  [OK]  i2v-Config-UI-Service  =^>  RUNNING
    echo.
    echo  Dashboard: http://localhost:3001
    echo  Tuning   : http://localhost:3001/admin/tuning
) else (
    echo  [!!]  Service not running — checking port 3001...
    netstat -ano | findstr ":3001.*LISTEN"
    echo.
    echo  Check logs at: C:\ProgramData\I2V\Logs\config\config-error.log
)

echo.
echo =========================================================
echo  NSSM now: %NSSM%
echo =========================================================
pause

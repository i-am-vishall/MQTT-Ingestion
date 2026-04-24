@echo off
setlocal enabledelayedexpansion
title I2V Services — Update & Restart (Run as Administrator)
color 0A

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo.
    echo  [ERROR] Must be run as Administrator!
    echo  Right-click this file and choose "Run as administrator"
    echo.
    pause & exit /b 1
)

set "SRC=C:\Users\mevis\MQTT-Ingetsion"
set "DST=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "NSSM_A=%DST%\utils\nssm.exe"
set "NSSM_B=%SRC%\monitoring\nssm.exe"

:: Pick whichever NSSM exists
if exist "!NSSM_A!" ( set "NSSM=!NSSM_A!" ) else ( set "NSSM=!NSSM_B!" )

echo.
echo =========================================================
echo   I2V Services — Sync Latest Build ^& Restart
echo   Source : !SRC!
echo   Deploy : !DST!
echo   NSSM   : !NSSM!
echo =========================================================
echo.

:: ── STOP BOTH SERVICES ────────────────────────────────────────────────────────
echo [1/5] Stopping services...
"!NSSM!" stop i2v-MQTT-Ingestion-Service >nul 2>&1
"!NSSM!" stop i2v-Config-UI >nul 2>&1
timeout /t 4 /nobreak >nul
echo       Done.

:: ── SYNC INGESTION SERVICE ────────────────────────────────────────────────────
echo [2/5] Syncing Ingestion Service files...

xcopy /y /q "!SRC!\ingestion-service\src\index.js"          "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\config.js"         "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\cluster.js"        "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\consumer.js"       "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\buffer.js"         "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\backpressure.js"   "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\normalization.js"  "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\src\dlq.js"            "!DST!\ingestion-service\src\"
xcopy /y /q "!SRC!\ingestion-service\utils\createLogger.js" "!DST!\ingestion-service\utils\"
xcopy /y /q "!SRC!\ingestion-service\init_schema.sql"       "!DST!\ingestion-service\"
xcopy /y /q "!SRC!\.env"                                    "!DST!\"
echo       Ingestion service files synced.

:: ── SYNC CONFIG UI SERVICE ────────────────────────────────────────────────────
echo [3/5] Syncing Config UI Service files...

xcopy /y /q "!SRC!\config-ui\server\index.js"               "!DST!\config-ui\server\"
xcopy /y /q "!SRC!\config-ui\server\utils\createLogger.js"  "!DST!\config-ui\server\utils\"

:: Sync all server routes
xcopy /y /q /s "!SRC!\config-ui\server\routes\*"            "!DST!\config-ui\server\routes\"

:: Sync rebuilt frontend dist
if exist "!SRC!\config-ui\client\dist\index.html" (
    xcopy /y /q /s /e "!SRC!\config-ui\client\dist\*"       "!DST!\config-ui\client\dist\"
    echo       Frontend dist synced.
) else (
    echo  [WARN] Frontend dist not found - skipping. Run: npm run build in config-ui/client
)

:: Sync scripts
xcopy /y /q "!SRC!\scripts\preflight_check.js"              "!DST!\scripts\"
echo       Config UI files synced.

:: ── START BOTH SERVICES ────────────────────────────────────────────────────────
echo [4/5] Starting services...
"!NSSM!" start i2v-MQTT-Ingestion-Service >nul 2>&1
timeout /t 3 /nobreak >nul
"!NSSM!" start i2v-Config-UI >nul 2>&1
timeout /t 5 /nobreak >nul
echo       Start commands sent.

:: ── VERIFY ────────────────────────────────────────────────────────────────────
echo [5/5] Verifying service states...
echo.

sc query i2v-MQTT-Ingestion-Service | findstr "STATE" | findstr "RUNNING" >nul
if !errorLevel! EQU 0 (
    echo  [OK]  i2v-MQTT-Ingestion-Service  =^>  RUNNING
) else (
    echo  [!!]  i2v-MQTT-Ingestion-Service  =^>  NOT RUNNING  ^(check logs^)
)

sc query i2v-Config-UI | findstr "STATE" | findstr "RUNNING" >nul
if !errorLevel! EQU 0 (
    echo  [OK]  i2v-Config-UI              =^>  RUNNING
) else (
    echo  [!!]  i2v-Config-UI              =^>  NOT RUNNING  ^(check logs^)
)

echo.
echo  Log files:
echo    Ingestion : !DST!\logs\ingestion-stdout.log
echo    Config UI : C:\ProgramData\I2V\Logs\config\
echo.
echo  Endpoints:
echo    Config Dashboard : http://localhost:3001
echo    Health API       : http://localhost:3333/health
echo    Crowd Metrics    : http://localhost:3333/metrics/crowd
echo.
echo =========================================================
echo   Update complete. Press any key to exit.
echo =========================================================
pause >nul

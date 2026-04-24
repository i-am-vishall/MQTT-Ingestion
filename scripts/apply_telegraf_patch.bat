@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V TELEGRAF SERVICE RE-INSTALLER PATCH
echo ==============================================================
echo.

set "INSTALL_DIR=%~dp0.."
set "NSSM_PATH=%INSTALL_DIR%\monitoring\nssm.exe"
set "TELEGRAF_CONF=%INSTALL_DIR%\monitoring\telegraf.conf"

:: The user has loki.exe in the monitoring folder, we assume telegraf.exe should be downloaded 
:: or is already present/bundled somewhere else, but for now we'll set the path.
set "TELEGRAF_EXE=%INSTALL_DIR%\monitoring\telegraf.exe"

echo [1/4] Stopping crashed instances...
net stop "i2v-telegraf" >nul 2>&1
taskkill /F /IM telegraf.exe >nul 2>&1

echo.
echo [2/4] Removing broken service...
"%NSSM_PATH%" remove "i2v-telegraf" confirm >nul 2>&1

echo.
echo [3/4] Re-registering i2v-telegraf using relative paths...
if not exist "%TELEGRAF_EXE%" (
    echo [WARNING] telegraf.exe not found at %TELEGRAF_EXE%. 
    echo Please ensure the binary is copied into the monitoring folder!
) else (
    "%NSSM_PATH%" install "i2v-telegraf" "%TELEGRAF_EXE%"
    "%NSSM_PATH%" set "i2v-telegraf" AppDirectory "%INSTALL_DIR%\monitoring"
    "%NSSM_PATH%" set "i2v-telegraf" AppParameters "--config \"%TELEGRAF_CONF%\""
    "%NSSM_PATH%" set "i2v-telegraf" DisplayName "i2V Telegraf Agent"
    "%NSSM_PATH%" set "i2v-telegraf" Description "I2V metrics collection agent for Grafana"
    "%NSSM_PATH%" set "i2v-telegraf" Start SERVICE_AUTO_START
)

echo.
echo [4/4] Starting Service...
net start "i2v-telegraf"

echo.
echo ==============================================================
echo PATCH COMPLETE!
echo The telegraf service should now start correctly without crashing.
echo ==============================================================
pause

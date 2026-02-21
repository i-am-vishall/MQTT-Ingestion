@echo off
:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
cd /d "%~dp0"
echo --- Restarting Services to Apply Log Fixes ---

:: CRITICAL: Ensure Service Paths are Correct
echo Running Service Path Fix...
call "%~dp0fix_service_paths.bat"

echo 1. Stopping Old Config Service (Port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a

echo 2. Restarting Telegraf (for telegraf.log)...
net stop "i2v-telegraf"
net start "i2v-telegraf"

echo 3. Restarting Postgres (for logging_collector)...
echo Using service 'i2v-mqtt-ingestion-PGSQL-5441' (bundled Postgres)...
net stop "i2v-mqtt-ingestion-PGSQL-5441"
net start "i2v-mqtt-ingestion-PGSQL-5441"

echo 3.5. Restarting Ingestion Service (to apply LOG_DIR)...
net stop "i2v-MQTT-Ingestion-Service"
net start "i2v-MQTT-Ingestion-Service"

echo 4. Starting Config Backend...
cd /d "%~dp0"
echo Starting Server via Node...
node config-ui/server/index.js
pause

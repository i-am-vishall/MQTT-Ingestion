@echo off
echo Stopping i2v-config-ui service to free port...
net stop i2v-config-ui
taskkill /F /IM i2v-config-service.exe >nul 2>&1

echo Killing any zombie process on port 3001...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo ===================================================
echo STARTING CONFIG UI MANUALLY (Development Mode)
echo ===================================================
echo.
cd /d "%~dp0"
cd config-ui/server

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

echo Starting Node.js server...
echo Opening browser in 5 seconds...
timeout /t 5 >nul
start "" "http://localhost:3001"
node index.js
pause

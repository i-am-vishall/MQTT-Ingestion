@echo off
REM ============================================================
REM  DEV SCRIPT 3: Start Config UI (Backend + Frontend)
REM
REM  - Backend  : config-ui/server/index.js  (Express API + WS)
REM  - Frontend : config-ui/client           (Vite dev server)
REM  - Opens two separate terminal windows:
REM      Window 1: Backend  -> http://localhost:3001
REM      Window 2: Frontend -> http://localhost:5173
REM ============================================================

title [DEV] Config UI Launcher

echo ============================================================
echo  I2V MQTT INGESTION — DEV CONFIG UI
echo ============================================================
echo  Backend   : http://localhost:3001  (Express API)
echo  Frontend  : http://localhost:5173  (Vite dev server)
echo ============================================================
echo.

set ROOT=%~dp0..
set SERVER_DIR=%ROOT%\config-ui\server
set CLIENT_DIR=%ROOT%\config-ui\client

:: Verify node_modules in server
if not exist "%SERVER_DIR%\node_modules" (
    echo [!] node_modules missing in config-ui/server. Installing...
    cd /d "%SERVER_DIR%"
    npm install
)

:: Verify node_modules in client
if not exist "%CLIENT_DIR%\node_modules" (
    echo [!] node_modules missing in config-ui/client. Installing...
    cd /d "%CLIENT_DIR%"
    npm install
)

echo [1/2] Launching Backend (port 3001) in new window...
start "Config-UI Backend" cmd /k "cd /d "%SERVER_DIR%" && echo [Backend] Starting on http://localhost:3001 ... && node index.js"

:: Small delay so backend can initialize first
timeout /t 2 /nobreak >nul

echo [2/2] Launching Frontend (Vite dev server) in new window...
start "Config-UI Frontend" cmd /k "cd /d "%CLIENT_DIR%" && echo [Frontend] Starting Vite dev server... && npm run dev"

echo.
echo ============================================================
echo  Both services are starting in separate windows.
echo  Backend  -> http://localhost:3001
echo  Frontend -> http://localhost:5173
echo ============================================================
echo  Close those windows to stop the UI services.
echo ============================================================
pause

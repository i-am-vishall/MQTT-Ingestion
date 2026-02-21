@echo off
cd /d "%~dp0"
echo Requesting Administrator privileges to restart Telegraf...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: Requires Administrator privileges.
    echo Right-click and "Run as Administrator".
    pause
    exit /b
)

echo Restarting i2v-telegraf service...
powershell -Command "Restart-Service i2v-telegraf"
echo Service Restarted.
pause

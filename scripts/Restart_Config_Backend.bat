@echo off
echo Force stopping i2v-config-ui service...
sc query "i2v-config-ui" | find "STATE"
net stop i2v-config-ui
timeout /t 2 >nul

echo Force killing i2v-config-service.exe process...
taskkill /F /IM i2v-config-service.exe
timeout /t 2 >nul

echo Killing any zombie process on port 3001...
powershell -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { if ($_.OwningProcess -gt 4) { Write-Host 'Killing PID' $_.OwningProcess; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"

timeout /t 2 >nul

echo Copying updated backend executable...
copy /Y "%~dp0..\config-ui\server\i2v-config-service.exe" "%~dp0..\i2v-config-service.exe"

if %errorlevel% neq 0 (
    echo FAILED to copy executable. Ensure you are running as Administrator.
    pause
    exit /b 1
) else (
    echo Copy Successful.
)

echo Starting i2v-config-ui service...
net start i2v-config-ui
echo.
echo Service Restart Complete.
echo Please refresh your browser (Ctrl+F5).
pause

@echo off
echo Looking for process on Port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a
echo.
echo If "Access Denied" appeared above, right-click this script and Run as Administrator.
echo.
pause

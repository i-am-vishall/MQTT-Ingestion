@echo off
echo Stopping zombie ingestion service processes...
:: Kill the root NSSM process and its children
taskkill /F /PID 5984 /T
if %errorlevel% neq 0 (
    echo Failed to kill process 5984. You might need to run this as Administrator.
    echo Trying to kill child processes individually...
    taskkill /F /PID 7844 /T
    taskkill /F /PID 10400 /T
) else (
    echo Successfully stopped the service processes.
)
echo.
echo Process cleanup complete. The errors should stop now.
pause

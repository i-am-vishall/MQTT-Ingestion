@echo off
echo ==========================================
echo FIX CONFIG UI SERVICE (Run as Admin)
echo ==========================================

echo 1. Attempting to stop service...
net stop "i2v-config-ui"

echo 2. Force calling service PID...
for /f "tokens=3" %%a in ('sc queryex "i2v-config-ui" ^| find "PID"') do (
   if "%%a" NEQ "0" (
       echo Killing Service PID: %%a
       taskkill /F /PID %%a
   )
)

echo 3. Killing Process on Port 3001 (Zombie)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
    echo Killing Port 3001 PID: %%a
    taskkill /F /PID %%a
)

echo 4. Restarting Service...
net start "i2v-config-ui"

echo ==========================================
echo DONE. Please check if UI works.
echo ==========================================
pause

@echo off
:: BatchGotAdmin
:-------------------------------------
REM  --> Check for permissions
    IF "%PROCESSOR_ARCHITECTURE%" EQU "amd64" (
>nul 2>&1 "%SYSTEMROOT%\SysWOW64\cacls.exe" "%SYSTEMROOT%\SysWOW64\config\system"
) ELSE (
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
)

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params= %*
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params:"=""%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

TITLE i2V MQTT Ingestion Installer

cd /d "%~dp0"

set "SOURCE_DIR=%~dp0"
set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "DATA_DIR=%INSTALL_DIR%\data"
set "PG_SERVICE_NAME=i2v-mqtt-ingestion-PGSQL-5441"
set "APP_SERVICE_NAME=MQTT_Ingestion_Service"
set "LOGFILE=%~dp0install_log.txt"

:: Clear previous log
if exist "%LOGFILE%" del "%LOGFILE%"

call :Log "==================================================="
call :Log "   i2V MQTT Ingestion: One-Click Installer"
call :Log "==================================================="
call :Log "Source: %SOURCE_DIR%"
call :Log "Target: %INSTALL_DIR%"
call :Log "LogFile: %LOGFILE%"
call :Log "==================================================="

:: 1. PRE-CHECK
if not exist "%SOURCE_DIR%pgsql\bin\initdb.exe" (
    call :Log "[ERROR] 'pgsql' folder is missing from source!"
    call :Log "Please place the 'pgsql' folder in the same directory as this script."
    pause
    exit /b 1
)

:: 2. CLEANUP OLD INSTALL
call :Log "[Step 1/5] Cleaning up old services..."
:: Stop services (ignore errors if not exist)
net stop "%PG_SERVICE_NAME%" >> "%LOGFILE%" 2>&1
sc delete "%PG_SERVICE_NAME%" >> "%LOGFILE%" 2>&1
net stop "%APP_SERVICE_NAME%" >> "%LOGFILE%" 2>&1
service-wrapper.exe uninstall >> "%LOGFILE%" 2>&1

:: Aggressive Kill: Kill processes running from the Install Dir
call :Log "Terminating processes..."

:: Disable service to prevent auto-restart
sc config "%PG_SERVICE_NAME%" start= disabled >> "%LOGFILE%" 2>&1
net stop "%PG_SERVICE_NAME%" /y >> "%LOGFILE%" 2>&1

:: Loop Kill
for /L %%i in (1,1,5) do (
    taskkill /F /IM "ingestion-service.exe" >nul 2>&1
    taskkill /F /IM "mqtt-ingestion-service.exe" >nul 2>&1
    taskkill /F /IM "postgres.exe" >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: Force Ownership if exists
if exist "%INSTALL_DIR%" (
    call :Log "Taking ownership of old files..."
    takeown /F "%INSTALL_DIR%" /R /D Y >> "%LOGFILE%" 2>&1
    icacls "%INSTALL_DIR%" /grant Everyone:F /T /C /Q >> "%LOGFILE%" 2>&1
)

:: Kill Port 5441 specifically
call :Log "Checking Port 5441..."
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5441" ^| find "LISTENING"') do (
    call :Log "Killing process PID: %%a"
    taskkill /f /pid %%a >> "%LOGFILE%" 2>&1
)
timeout /t 2 /nobreak >nul

:: Remove old target directory with Retry
if exist "%INSTALL_DIR%" (
    call :Log "Removing old installation directory..."
    rmdir /s /q "%INSTALL_DIR%" >> "%LOGFILE%" 2>&1
    
    :: Double check
    if exist "%INSTALL_DIR%" (
        call :Log "[RETRY] Dictionary still exists (Locked?). Waiting 5s..."
        timeout /t 5 /nobreak >nul
        rmdir /s /q "%INSTALL_DIR%" >> "%LOGFILE%" 2>&1
    )
    
    if exist "%INSTALL_DIR%" (
        call :Log "[WARNING] Could not remove entire directory. Files might be locked by Explorer."
        call :Log "Attempting to proceed with Overwrite..."
    )
)

:: 3. COPY FILES
call :Log "[Step 2/5] Installing Files..."
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >> "%LOGFILE%" 2>&1
xcopy /E /I /Y /Q "%SOURCE_DIR%*" "%INSTALL_DIR%\" >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :Log "[ERROR] Failed to copy files. Files are locked!"
    call :Log "Please CLOSE any open folders or apps using: %INSTALL_DIR%"
    pause
    exit /b 1
)

:: 4. INITIALIZE DB (In Target)
call :Log "[Step 3/5] Initializing Database..."
cd /d "%INSTALL_DIR%"

:: Grant Full Perms to Parent (Installation Folder)
call :Log "Granting permissions to Install Directory..."
icacls "%INSTALL_DIR%" /grant Everyone:F /T /C /Q >> "%LOGFILE%" 2>&1

:: Ensure Data Dir does NOT exist (Let initdb create it for correct perms)
if exist "%DATA_DIR%" (
    call :Log "Wiping data folder for fresh DB..."
    takeown /F "%DATA_DIR%" /R /D Y >> "%LOGFILE%" 2>&1
    icacls "%DATA_DIR%" /grant Everyone:F /T /C /Q >> "%LOGFILE%" 2>&1
    rmdir /s /q "%DATA_DIR%" >> "%LOGFILE%" 2>&1
    
    if exist "%DATA_DIR%" (
        call :Log "[CRITICAL ERROR] Could not delete 'data' folder."
        call :Log "Database files are locked. Stop services or close apps."
        pause
        exit /b 1
    )
)
:: DO NOT manually create data dir here. initdb will do it.

"%INSTALL_DIR%\pgsql\bin\initdb.exe" -D "%DATA_DIR%" -U postgres -A trust -E UTF8 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :Log "[ERROR] initdb failed. Check log for details."
    pause
    exit /b 1
)
echo port = 5441 >> "%DATA_DIR%\postgresql.conf"
echo listen_addresses = '*' >> "%DATA_DIR%\postgresql.conf"

:: 5. REGISTER SERVICES
call :Log "[Step 4/5] Registering Database Service..."
"%INSTALL_DIR%\pgsql\bin\pg_ctl.exe" register -N "%PG_SERVICE_NAME%" -D "%DATA_DIR%" -S auto >> "%LOGFILE%" 2>&1
call :Log "Starting Database..."
net start "%PG_SERVICE_NAME%" >> "%LOGFILE%" 2>&1
timeout /t 5 /nobreak >nul

call :Log "[Step 5/5] Setup Schema and App..."
if exist "setup_db.exe" (
    setup_db.exe >> "%LOGFILE%" 2>&1
)

call :Log "Registering App Service..."
service-wrapper.exe install >> "%LOGFILE%" 2>&1
service-wrapper.exe start >> "%LOGFILE%" 2>&1

call :Log "==================================================="
call :Log "           INSTALLATION SUCCESSFUL"
call :Log "==================================================="
call :Log "Installed to: %INSTALL_DIR%"
pause
exit /b 0

:: Helper function for logging
:Log
echo %~1
echo %~1 >> "%LOGFILE%"
exit /b 0

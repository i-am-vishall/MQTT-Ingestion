@echo off
:: ============================================================
:: I2V Smart City - Fix All Permission Issues
:: Run this as Administrator
:: ============================================================

setlocal EnableDelayedExpansion

echo ============================================================
echo  I2V Smart City - Permission Fix Script
echo  MUST BE RUN AS ADMINISTRATOR
echo ============================================================
echo.

:: Check for Admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please right-click and select "Run as Administrator"
    pause
    exit /b 1
)

set "INSTALL_DIR=C:\Program Files (x86)\i2v-MQTT-Ingestion"
set "DEV_DIR=C:\Users\mevis\MQTT-Ingetsion"

echo [1/5] Fixing Production Installation Permissions...
if exist "%INSTALL_DIR%" (
    echo    - Setting full control for SYSTEM account...
    icacls "%INSTALL_DIR%" /grant "SYSTEM":(OI)(CI)F /T /C >nul 2>&1
    
    echo    - Setting full control for Administrators...
    icacls "%INSTALL_DIR%" /grant "Administrators":(OI)(CI)F /T /C >nul 2>&1
    
    echo    - Setting full control for NETWORK SERVICE...
    icacls "%INSTALL_DIR%" /grant "NETWORK SERVICE":(OI)(CI)F /T /C >nul 2>&1
    
    echo    - Setting full control for LOCAL SERVICE...
    icacls "%INSTALL_DIR%" /grant "LOCAL SERVICE":(OI)(CI)F /T /C >nul 2>&1
    
    echo    - Setting full control for Users group...
    icacls "%INSTALL_DIR%" /grant "Users":(OI)(CI)F /T /C >nul 2>&1
    
    echo    - Setting full control for Everyone on logs folder...
    icacls "%INSTALL_DIR%\logs" /grant "Everyone":(OI)(CI)F /T /C >nul 2>&1
    
    echo    Production directory: DONE
) else (
    echo    Production directory not found, skipping...
)

echo.
echo [2/5] Fixing Development Directory Permissions...
if exist "%DEV_DIR%" (
    icacls "%DEV_DIR%" /grant "Users":(OI)(CI)F /T /C >nul 2>&1
    icacls "%DEV_DIR%" /grant "%USERNAME%":(OI)(CI)F /T /C >nul 2>&1
    echo    Development directory: DONE
) else (
    echo    Development directory not found, skipping...
)

echo.
echo [3/5] Fixing PostgreSQL Data Directory Permissions...
set "PG_DATA=%INSTALL_DIR%\pgsql\data"
if exist "%PG_DATA%" (
    icacls "%PG_DATA%" /grant "NETWORK SERVICE":(OI)(CI)F /T /C >nul 2>&1
    icacls "%PG_DATA%" /grant "SYSTEM":(OI)(CI)F /T /C >nul 2>&1
    echo    PostgreSQL data directory: DONE
) else (
    echo    PostgreSQL data directory not found, skipping...
)

echo.
echo [4/5] Fixing InfluxDB Data Directory Permissions...
set "INFLUX_DATA=%INSTALL_DIR%\monitoring\influxdb\data"
if exist "%INFLUX_DATA%" (
    icacls "%INFLUX_DATA%" /grant "NETWORK SERVICE":(OI)(CI)F /T /C >nul 2>&1
    icacls "%INFLUX_DATA%" /grant "SYSTEM":(OI)(CI)F /T /C >nul 2>&1
    echo    InfluxDB data directory: DONE
) else (
    echo    InfluxDB data directory not found, skipping...
)

echo.
echo [5/5] Removing Read-Only attributes...
attrib -R "%INSTALL_DIR%\*.*" /S /D 2>nul
attrib -R "%DEV_DIR%\*.*" /S /D 2>nul
echo    Read-only attributes removed: DONE

echo.
echo ============================================================
echo  PERMISSION FIX COMPLETE!
echo ============================================================
echo.
echo All directories now have proper permissions for:
echo   - Windows Services (NETWORK SERVICE, LOCAL SERVICE)
echo   - Administrators
echo   - Current User
echo   - System Account
echo.
pause

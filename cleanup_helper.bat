@echo off
echo ========================================================
echo      MQTT Ingestion Project Cleanup Helper
echo ========================================================
echo.
echo This script will:
echo 1. Create a '_ARCHIVE_2026' directory
echo 2. Move legacy folders (deploy, database, scripts) into it
echo 3. Delete large .log files and temp binaries
echo.
pause

:: 1. Create Archive
if not exist "_ARCHIVE_2026" mkdir "_ARCHIVE_2026"

:: 2. Move Legacy Folders
echo Moving 'deploy' to archive...
move deploy "_ARCHIVE_2026\"
echo Moving 'database' to archive...
move database "_ARCHIVE_2026\"
echo Moving 'scripts' (old) to archive...
move scripts "_ARCHIVE_2026\"
echo Moving 'patch' to archive...
move patch "_ARCHIVE_2026\"

:: 3. Delete Logs (Safe delete)
echo Deleting .log files...
del *.log /s /q

:: 5. Cleanup Grafana (Logs & Data)
echo Cleaning Grafana logs...
if exist "Unified_Setup\grafana\data\log" del "Unified_Setup\grafana\data\log\*.log*" /q
if exist "Unified_Setup\grafana\data\log" del "Unified_Setup\grafana\data\log\*.0*" /q

:: Ask to reset Grafana DB?
set /p RESET_GRAFANA="Do you want to RESET Grafana Data (delete grafana.db)? (Y/N): "
if /I "%RESET_GRAFANA%"=="Y" (
    if exist "Unified_Setup\grafana\data\grafana.db" del "Unified_Setup\grafana\data\grafana.db"
    echo Grafana Data Reset.
)

:: Ask to delete Grafana Binaries?
set /p DELETE_GRAFANA="Do you want to DELETE Grafana Binaries from Unified_Setup? (NOT RECOMMENDED for Installer) (Y/N): "
if /I "%DELETE_GRAFANA%"=="Y" (
    if exist "Unified_Setup\grafana" rmdir "Unified_Setup\grafana" /s /q
    echo Grafana Binaries Deleted.
)

echo.
echo ========================================================
echo Cleanup Complete! 
echo Check '_ARCHIVE_2026' if you need anything back.
echo ========================================================
pause

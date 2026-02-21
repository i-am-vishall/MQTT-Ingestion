@echo off
cd /d "%~dp0"
echo Requesting Administrator Privileges...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "& {Start-Process PowerShell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0install_config_service.ps1""' -Verb RunAs}"

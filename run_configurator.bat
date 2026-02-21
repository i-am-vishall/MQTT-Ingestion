@echo off
title I2V Service Configurator
echo Starting Configuration Interface...
echo Please ensure you run this as ADMINISTRATOR if you intend to control the service.
echo.

cd "C:\Users\mevis\MQTT-Ingetsion\config-ui\server"

:: Start Node server in background or current window? 
:: Current window is better so user can close it easily.
echo Server running at http://localhost:3001
echo Opening Browser...
start http://localhost:3001

node index.js
pause

@echo off
title MQTT Ingestion Service (Node.js)
cd /d "%~dp0\src"
echo Starting Ingestion Service from Source...
node index.js
pause

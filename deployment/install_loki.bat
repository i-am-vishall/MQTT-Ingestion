@echo off
set "SERVICE_NAME=i2v-Loki"
set "BASE_DIR=C:\Users\mevis\MQTT-Ingetsion"
set "BIN_PATH=%BASE_DIR%\monitoring\loki.exe"
set "CONFIG_PATH=%BASE_DIR%\monitoring\loki-config.yaml"
set "NSSM_PATH=%BASE_DIR%\monitoring\nssm.exe"

echo Installing %SERVICE_NAME%...

"%NSSM_PATH%" stop %SERVICE_NAME%
"%NSSM_PATH%" remove %SERVICE_NAME% confirm

"%NSSM_PATH%" install %SERVICE_NAME% "%BIN_PATH%"
"%NSSM_PATH%" set %SERVICE_NAME% AppParameters "-config.file=%CONFIG_PATH%"
"%NSSM_PATH%" set %SERVICE_NAME% DisplayName "I2V Loki Logging Service"
"%NSSM_PATH%" set %SERVICE_NAME% Description "Loki Log Aggregator for I2V Platform"
"%NSSM_PATH%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_PATH%" set %SERVICE_NAME% AppStdout "%BASE_DIR%\logs\loki-service.log"
"%NSSM_PATH%" set %SERVICE_NAME% AppStderr "%BASE_DIR%\logs\loki-service.err"

net start %SERVICE_NAME%
echo Done.
pause

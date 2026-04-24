@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo I2V MQTT INGESTION - ADVANCED CROWD INTELLIGENCE ENGINE
echo ==============================================================
echo.

set "ENGINE_DIR=C:\Users\mevis\MQTT-Ingetsion\crowd-prediction-engine"
cd /d "%ENGINE_DIR%"

REM Check if Python virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Virtual environment not found. Ensuring setup...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo [1/2] Starting FastAPI Prediction Engine...
start "Crowd Prediction API" cmd /c "call venv\Scripts\activate.bat & python api.py"

REM Give API a moment to start
timeout /t 5 >nul

echo [2/2] Starting Data Simulator (Synthetic Booking Injector)...
start "Booking Simulator" cmd /c "call venv\Scripts\activate.bat & python simulator.py"

echo ==============================================================
echo SERVICES STARTED SUCCESSFULLY
echo You can view the API Swagger docs at: http://localhost:8000/docs
echo Close the newly opened terminal windows to stop the services.
echo ==============================================================
pause

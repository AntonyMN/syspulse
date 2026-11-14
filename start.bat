@echo off
:: ==============================================================================
:: SysPulse Launcher: Windows System Health, RAM Analytics & Process Controller
:: ==============================================================================

title SysPulse Controller
cd /d "%~dp0"

echo ==========================================================
echo   Starting SysPulse: System Health & Process Controller
echo ==========================================================

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Python is not installed or not in your PATH.
    echo Please install Python 3.8+ from https://python.org or the Microsoft Store.
    pause
    exit /b 1
)

:: Check psutil
python -c "import psutil" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Notice: psutil is missing. Installing psutil via pip...
    pip install psutil
)

if "%PORT%"=="" set PORT=5050

echo -> Launching SysPulse on port %PORT%...
echo -> Opening web dashboard in default browser: http://127.0.0.1:%PORT%
echo -> Tip: To run SysPulse permanently in the background on startup, run:
echo      service\install-service.bat
echo ==========================================================

start "" "http://127.0.0.1:%PORT%"
python server.py
pause


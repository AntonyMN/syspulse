@echo off
:: ==============================================================================
:: SysPulse Windows Background Service Installer
:: Registers a silent Windows Task Scheduler service that starts on boot/logon.
:: Uses pythonw.exe to run completely headless without a visible console window.
:: ==============================================================================

title SysPulse Windows Service Installer
cd /d "%~dp0.."

echo ==========================================================
echo   SysPulse: Installing Background Service (Windows)       
echo ==========================================================

:: Locate pythonw.exe (headless Python)
for /f "delims=" %%I in ('where pythonw.exe 2^>nul') do set "PYTHONW_PATH=%%I"
if "%PYTHONW_PATH%"=="" (
    for /f "delims=" %%I in ('where python.exe 2^>nul') do set "PYTHONW_PATH=%%~dpIpythonw.exe"
)

if not exist "%PYTHONW_PATH%" (
    echo Error: pythonw.exe could not be located.
    echo Please verify Python is installed with the "Add Python to PATH" option.
    pause
    exit /b 1
)

set "SERVER_SCRIPT=%CD%\server.py"
set "TASK_NAME=SysPulseDaemon"

echo -> Pythonw found: %PYTHONW_PATH%
echo -> Script path:   %SERVER_SCRIPT%
echo -> Creating Scheduled Task "%TASK_NAME%"...

:: Create scheduled task on user logon with highest privileges
schtasks /Create /TN "%TASK_NAME%" /TR "\"%PYTHONW_PATH%\" \"%SERVER_SCRIPT%\"" /SC ONLOGON /RL HIGHEST /F

if %ERRORLEVEL% equ 0 (
    echo -> Starting %TASK_NAME% now...
    schtasks /Run /TN "%TASK_NAME%"
    echo ==========================================================
    echo [OK] SysPulse service registered and running in background!
    echo   Dashboard URL:  http://127.0.0.1:5050
    echo   Stop Service:   service\uninstall-service.bat
    echo ==========================================================
) else (
    echo [ERROR] Failed to create scheduled task. Please run as Administrator.
)

pause

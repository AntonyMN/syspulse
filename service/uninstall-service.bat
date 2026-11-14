@echo off
:: ==============================================================================
:: SysPulse Windows Background Service Uninstaller
:: Stops and deletes the SysPulse scheduled task.
:: ==============================================================================

title SysPulse Windows Service Uninstaller
set "TASK_NAME=SysPulseDaemon"

echo ==========================================================
echo   SysPulse: Removing Background Service (Windows)         
echo ==========================================================

echo -> Stopping task %TASK_NAME%...
schtasks /End /TN "%TASK_NAME%" >nul 2>nul

echo -> Deleting task %TASK_NAME%...
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul

if %ERRORLEVEL% equ 0 (
    echo [OK] SysPulse background task removed successfully.
) else (
    echo [Notice] Task %TASK_NAME% was not found or already removed.
)

echo ==========================================================
pause


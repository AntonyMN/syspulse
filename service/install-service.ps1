# ==============================================================================
# SysPulse Windows Service Installer (PowerShell)
# Registers a silent Windows background service running on logon via Task Scheduler.
# ==============================================================================

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$serverPy = Join-Path $projectDir "server.py"
$taskName = "SysPulseDaemon"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SysPulse: Installing Background Service (Windows)       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Locate pythonw.exe
$pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonw) {
    $python = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if ($python) {
        $candidate = Join-Path (Split-Path -Parent $python) "pythonw.exe"
        if (Test-Path $candidate) { $pythonw = $candidate }
    }
}

if (-not $pythonw) {
    Write-Error "pythonw.exe not found. Please ensure Python 3 is installed and added to PATH."
    exit 1
}

Write-Host "-> Found Pythonw: $pythonw" -ForegroundColor Gray
Write-Host "-> Server Script: $serverPy" -ForegroundColor Gray

# Register Task
$action = New-ScheduledTaskAction -Execute $pythonw -Argument "`"$serverPy`"" -WorkingDirectory $projectDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName | Out-Null

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "✓ SysPulse service registered and running in background!" -ForegroundColor Green
Write-Host "  Dashboard URL:  http://127.0.0.1:5050" -ForegroundColor White
Write-Host "  Task Name:      $taskName" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green

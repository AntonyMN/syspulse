# SysPulse | Cross-Platform System Health Doctor & Process Controller

[![Documentation & Showcase](https://img.shields.io/badge/Documentation-GitHub%20Pages-brightgreen?style=flat-square&logo=github)](https://antonymn.github.io/syspulse/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Web%20Preview-blue?style=flat-square)](https://antonymn.github.io/syspulse/dashboard.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Ubuntu%20Linux%20%7C%20Windows-orange?style=flat-square)](https://antonymn.github.io/syspulse/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)

**SysPulse** is a lightweight system health monitor, real-time RAM analytics dashboard, and process controller with cross-platform support for **Ubuntu/Debian Linux** and **Microsoft Windows**.

📖 **Read Full Documentation & Guides**: [https://antonymn.github.io/syspulse/](https://antonymn.github.io/syspulse/)  
🌐 **Interactive Web Demo**: [https://antonymn.github.io/syspulse/dashboard.html](https://antonymn.github.io/syspulse/dashboard.html)

---

## Key Features

### 1. Hardware Doctor & Diagnostics
- **Comprehensive Health Score**: Calculates an overall laptop health grade (A, B, C, D) and score (0-100) based on thermal sensors, battery degradation, storage exhaustion, and system errors.
- **Thermal Sensors**: Monitors CPU package temperatures, individual core thermals, and ACPI zones with warnings for thermal throttling risk.
- **Battery Health & Wear Analysis**: Inspects `/sys/class/power_supply/BAT*` (Linux) or WMI CIM metrics (Windows) to calculate battery health %, cycle counts, and wear level.
- **Storage Condition & Warning**: Inspects root filesystem `/` or system drive `C:\` and flags low-disk space conditions.
- **System Diagnostics Scanner**: Analyzes `journalctl -p 3 -xb` (Linux) or Windows System Event Log (Level 1,2 errors) and flags stopped services.

### 2. RAM Analytics & Streaming Graph
- **Real-Time Memory Timeline Graph**: Streaming Chart.js graph plotting **Used RAM (GB)** vs **Available RAM (GB)** over time with smooth bezier curves and area fills.
- **Doughnut Distribution Chart**: Interactive breakdown of Used, Cached, Buffers, and Free memory.
- **Kernel Memory Breakdown Bar**: Visual representation of physical RAM mapping and Linux buffer cache / Windows standby memory.
- **Swap & Memory Pressure**: Live swap memory gauge and `/proc/pressure/memory` stall metrics.

### 3. Process Controller & Crossing
- **Active vs Background Sorting**:
  - **Active**: Identifies processes actively executing on CPU, running interactive user sessions (Chrome, IDE, bash/cmd terminals), or attached to a controlling TTY.
  - **Background**: Identifies idle daemons, sleeping system services, and kernel threads (`kworker`, etc.).
- **Process Crossing**:
  - Allows users to **cross any process** (individual cross button or **Cross All Active**).
  - Crossed processes are dynamically highlighted with a red strike-through, dimmed opacity, and an explicit **CROSSED** badge.
  - Includes **"Kill Crossed (N)"** to terminate all crossed processes in batch.
- **Process Termination**:
  - **Single Kill**: Terminate individual processes gracefully with SIGTERM or force with SIGKILL (Windows: `TerminateProcess`).
  - **Kill All Active Processes**: Toolbar action with an integrated **Safety Shield** dialog that automatically protects essential system components (`systemd`, `Xorg`, `lightdm`, `dwm.exe`, `explorer.exe`, `csrss.exe`, and the monitoring server itself) to prevent system lockups.

### 4. Application Manager
- Aggregates memory and CPU usage across multi-process application trees (Chrome, VS Code, Discord).
- Package resolution for APT, Snap, Flatpak, and Windows Winget packages.
- Safe dry-run uninstallation simulation before making package changes.

---

## Quick Start

### Ubuntu / Debian Linux
```bash
git clone https://github.com/AntonyMN/syspulse.git
cd syspulse
./start.sh
```

### Microsoft Windows
```cmd
git clone https://github.com/AntonyMN/syspulse.git
cd syspulse
start.bat
```

Open your browser at:
```
http://127.0.0.1:5050
```

---

## Background Daemon / Always Active on Startup

SysPulse includes automated service scripts to run continuously in the background as a system daemon without keeping a terminal window open.

### Linux (Systemd User Service)
```bash
# 1. Install and start daemon (runs on boot, even before GUI login)
./service/install-service.sh

# 2. Check daemon status
systemctl --user status syspulse.service

# 3. View live logs
journalctl --user -u syspulse.service -f

# 4. Stop and remove daemon
./service/uninstall-service.sh
```

### Windows (Task Scheduler Service)
```cmd
:: Install background task (runs on user logon via pythonw.exe)
service\install-service.bat

:: Remove background task
service\uninstall-service.bat
```

---

## Port Management & Conflict Safeguards

Running SysPulse as a persistent daemon occupies a local network port (default `5050`). SysPulse implements safeguards against port conflicts:

1. **Automatic Port Rollover**: If port 5050 is in use, SysPulse automatically scans and binds to the next available port (`5051`, `5052`, etc.).
2. **Custom Port Override**: Set the `PORT` environment variable before launching:
   - Linux: `PORT=5055 ./start.sh`
   - Windows: `set PORT=5055 && start.bat`
3. **Inspect Clogged Port**:
   - Linux: `lsof -i :5050`
   - Windows: `netstat -ano | findstr :5050`

---

## REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/system/condition` | `GET` | Health score, thermals, battery wear, storage, and system errors |
| `/api/memory/stats` | `GET` | RAM, Swap, memory pressure, and 60-second time-series history |
| `/api/processes` | `GET` | Process list with active/background classification and filter queries |
| `/api/processes/kill` | `POST` | Terminate a single process by PID (`{"pid": 1234, "signal": "SIGTERM"}`) |
| `/api/processes/kill-batch` | `POST` | Terminate multiple crossed processes (`{"pids": [123, 456]}`) |
| `/api/processes/kill-all-active` | `POST` | Mass terminate active user processes with safety protection |
| `/api/applications` | `GET` | Aggregated metrics for running desktop applications |

---

## Project Structure

```
syspulse/
├── server.py              # Multi-threaded cross-platform HTTP server with psutil telemetry
├── start.sh               # Executable launcher for Linux
├── start.bat              # Executable launcher for Windows
├── README.md              # Documentation
├── LICENSE                # MIT License
├── service/               # Background daemon scripts
│   ├── syspulse.service   # Systemd unit template
│   ├── install-service.sh # One-click Linux systemd installer
│   ├── uninstall-service.sh
│   ├── install-service.bat# One-click Windows Task Scheduler installer
│   ├── install-service.ps1# PowerShell service installer
│   └── uninstall-service.bat
└── static/                # Web Application & Documentation Portal
    ├── index.html         # Documentation Portal for GitHub Pages (/docs locally)
    ├── dashboard.html     # Live System Monitor Dashboard (/ locally, live demo on Pages)
    ├── css/
    │   ├── landing.css    # Documentation portal styling
    │   └── style.css      # Dark glassmorphism dashboard design system
    └── js/
        ├── chart.min.js   # Vendor bundle of Chart.js
        └── app.js         # Reactive client logic, charts, and process controls
```

---

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Antony Muriuki.

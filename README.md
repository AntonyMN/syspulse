# SysPulse | Ubuntu Laptop Health Doctor & Process Controller

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=flat-square&logo=github)](https://antonymn.github.io/syspulse/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Ubuntu%20Linux-orange?style=flat-square&logo=ubuntu)](https://ubuntu.com/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)

**SysPulse** is a lightweight system health monitor, real-time RAM analytics dashboard, and Linux process controller designed specifically for Ubuntu Linux installations.

🌐 **Try the Live Web Demo**: [https://antonymn.github.io/syspulse/](https://antonymn.github.io/syspulse/)
*(The GitHub Pages deployment runs in interactive preview mode with simulated telemetry. Run locally on Ubuntu with `./start.sh` to monitor real machine hardware and control processes).*

---

## Key Features

### 1. Laptop Condition & Issue Diagnostics
- **Comprehensive Health Score**: Calculates an overall laptop health grade (A, B, C, D) and score (0-100) based on thermal sensors, battery degradation, storage exhaustion, and system errors.
- **Thermal Sensors**: Monitors CPU package temperatures, individual core thermals, and ACPI zones with warnings for thermal throttling risk.
- **Battery Health & Wear Analysis**: Inspects `/sys/class/power_supply/BAT*` to calculate battery health %, cycle counts, and wear level compared to factory design capacity.
- **Storage Condition & Warning**: Inspects root filesystem `/` and flags low-disk space conditions with emergency recommendations.
- **System Diagnostics & Boot Error Scanner**: Analyzes `journalctl -p 3 -xb` (critical and error-level logs) and checks failed systemd services via `systemctl --failed` with actionable resolution suggestions.

### 2. RAM Analytics & Live Graph
- **Real-Time Memory Timeline Graph**: Streaming Chart.js graph plotting **Used RAM (GB)** vs **Available RAM (GB)** over time with smooth bezier curves and area fills.
- **Doughnut Distribution Chart**: Interactive breakdown of Used, Cached, Buffers, and Free memory.
- **Kernel Memory Breakdown Bar**: Visual representation of physical RAM mapping and Linux buffer cache utilization.
- **Swap & Memory Pressure**: Live swap memory gauge and `/proc/pressure/memory` stall metrics.

### 3. Linux Process Manager & Controller
- **Active vs Background Sorting**:
  - **Active**: Identifies processes actively executing on CPU, running interactive user sessions (Chrome, IDE, bash terminals), or attached to a controlling TTY (`/dev/pts/*`).
  - **Background**: Identifies idle daemons, sleeping system services, and kernel threads (`kworker`, etc.).
- **Process Crossing**:
  - Allows users to **cross any process** (individual cross button or **Cross All Active**).
  - Crossed processes are dynamically highlighted with a red strike-through, dimmed opacity, and an explicit **CROSSED** badge.
  - Includes **"Kill Crossed (N)"** to terminate all crossed processes in batch.
- **Process Termination**:
  - **Single Kill**: Terminate individual processes gracefully with SIGTERM or force with SIGKILL.
  - **Kill All Active Processes**: Toolbar action with an integrated **Safety Shield** dialog that automatically protects essential system components (`systemd`, `Xorg`, `lightdm`, the monitoring server itself, and active display managers) to prevent system lockups.

---

## Quick Start

Launch the application with a single command:

```bash
cd /home/anto/builds/ram
./start.sh
```

Or run directly with Python 3:

```bash
python3 server.py
```

Open your browser at:
```
http://127.0.0.1:5050
```

---

## REST API Reference

The server exposes clean REST endpoints:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/system/condition` | `GET` | Laptop health score, thermals, battery wear, storage, and system errors |
| `/api/memory/stats` | `GET` | Current RAM, Swap, memory pressure, and 60-second time-series history |
| `/api/processes` | `GET` | Process list with active/background classification and filter queries (`?category=active`, `?user=me`, `?q=search`) |
| `/api/processes/kill` | `POST` | Terminate a single process by PID (`{"pid": 1234, "signal": "SIGTERM"}`) |
| `/api/processes/kill-batch` | `POST` | Terminate multiple crossed processes (`{"pids": [123, 456], "signal": "SIGTERM"}`) |
| `/api/processes/kill-all-active` | `POST` | Mass terminate active user processes with safety protection |

---

## Project Structure

```
/home/anto/builds/ram/
├── server.py              # Multi-threaded Python HTTP server with psutil telemetry
├── start.sh               # Executable startup launcher script
├── README.md              # Project documentation
└── static/                # Frontend Web Application
    ├── index.html         # Modern HTML5 dashboard structure
    ├── css/
    │   └── style.css      # Dark glassmorphism design system
    └── js/
        ├── chart.min.js   # Local vendor bundle of Chart.js
        └── app.js         # Reactive client logic, charts, and process controls
```

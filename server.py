#!/usr/bin/env python3
"""
SysPulse / LaptOptima - Ubuntu Laptop Health, RAM Monitor & Process Controller
Backend server powered by Python 3 standard library and psutil.
"""

import os
import sys
import json
import time
import signal
import socket
import getpass
import platform
import threading
import subprocess
import glob
import configparser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

try:
    import psutil
except ImportError:
    print("ERROR: psutil is required. Please install it using: sudo apt install python3-psutil or pip install psutil")
    sys.exit(1)

# Global configuration
PORT = int(os.environ.get("PORT", 5050))
HOST = "0.0.0.0"
CURRENT_USER = getpass.getuser()
SERVER_PID = os.getpid()

# Protected process names that should NEVER be killed en masse
PROTECTED_NAMES = {
    'systemd', 'init', 'kthreadd', 'systemd-journald', 'systemd-udevd',
    'systemd-logind', 'systemd-resolved', 'dbus-daemon', 'lightdm', 'Xorg',
    'Xwayland', 'gnome-shell', 'budgie-wm', 'pipewire', 'wireplumber',
    'polkitd', 'sshd', 'login', 'agetty', 'antigravity-ide', 'code',
    'bash', 'zsh', 'sh', 'python3', 'python'
}

# Protected package names that should NEVER be uninstalled
PROTECTED_PACKAGES = {
    'systemd', 'systemd-sysv', 'linux-image', 'ubuntu-minimal', 'ubuntu-standard',
    'xorg', 'xserver-xorg', 'lightdm', 'budgie-desktop', 'gnome-shell', 'sudo',
    'login', 'coreutils', 'bash', 'python3-minimal', 'python3', 'dash', 'libc6',
    'antigravity-ide', 'init', 'dbus', 'polkitd'
}

# Desktop applications cache and package resolution cache
DESKTOP_APPS_CACHE = {}
LAST_DESKTOP_SCAN = 0
PACKAGE_CACHE = {}
PACKAGE_CACHE_LOCK = threading.Lock()

# In-memory history for RAM chart (last 60 data points, 1s apart)
RAM_HISTORY = []
MAX_HISTORY = 60
HISTORY_LOCK = threading.Lock()

# Cache for CPU percentages (psutil needs interval or delta)
PROCESS_CACHE = []
PROCESS_CACHE_LOCK = threading.Lock()


def format_bytes(b):
    """Format bytes to human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if b < 1024.0:
            return f"{b:.1f} {unit}"
        b /= 1024.0
    return f"{b:.1f} PB"


def get_battery_health():
    """Inspect /sys/class/power_supply/BAT* and psutil for battery condition."""
    bat_info = {
        'present': False,
        'percent': 0,
        'status': 'Unknown',
        'power_plugged': False,
        'health_percent': None,
        'cycle_count': None,
        'charge_now': None,
        'charge_full': None,
        'charge_full_design': None,
        'wear_percent': None,
        'assessment': 'Normal'
    }

    # psutil battery
    try:
        sb = psutil.sensors_battery()
        if sb:
            bat_info['present'] = True
            bat_info['percent'] = round(sb.percent, 1)
            bat_info['power_plugged'] = sb.power_plugged
            bat_info['status'] = 'Charging' if sb.power_plugged and sb.percent < 99 else ('Full' if sb.power_plugged else 'Discharging')
    except Exception:
        pass

    # Read sysfs for deep battery condition
    bat_dirs = ['/sys/class/power_supply/BAT0', '/sys/class/power_supply/BAT1']
    for bdir in bat_dirs:
        if os.path.isdir(bdir):
            bat_info['present'] = True
            
            def read_val(fname):
                p = os.path.join(bdir, fname)
                if os.path.exists(p):
                    try:
                        with open(p, 'r') as f:
                            return f.read().strip()
                    except Exception:
                        pass
                return None

            status = read_val('status')
            if status:
                bat_info['status'] = status

            cycle = read_val('cycle_count')
            if cycle and cycle.isdigit():
                bat_info['cycle_count'] = int(cycle)

            c_full = read_val('charge_full') or read_val('energy_full')
            c_design = read_val('charge_full_design') or read_val('energy_full_design')
            c_now = read_val('charge_now') or read_val('energy_now')

            if c_now and c_now.isdigit():
                bat_info['charge_now'] = int(c_now)
            if c_full and c_full.isdigit():
                bat_info['charge_full'] = int(c_full)
            if c_design and c_design.isdigit():
                bat_info['charge_full_design'] = int(c_design)

            if bat_info['charge_full'] and bat_info['charge_full_design'] and bat_info['charge_full_design'] > 0:
                health = (bat_info['charge_full'] / bat_info['charge_full_design']) * 100.0
                bat_info['health_percent'] = round(health, 1)
                wear = 100.0 - health
                bat_info['wear_percent'] = round(max(0.0, wear), 1)

                if health < 50:
                    bat_info['assessment'] = 'Severely Degraded (Replace Recommended)'
                elif health < 75:
                    bat_info['assessment'] = 'Degraded / Moderate Wear'
                elif health < 90:
                    bat_info['assessment'] = 'Good'
                else:
                    bat_info['assessment'] = 'Excellent'
            break

    return bat_info


def get_thermal_health():
    """Inspect temperature sensors and identify thermal bottlenecks."""
    thermals = {
        'sensors': {},
        'max_temp': 0.0,
        'package_temp': None,
        'status': 'Normal',
        'hot_sensors': []
    }

    try:
        temps = psutil.sensors_temperatures()
        for name, entries in temps.items():
            formatted_entries = []
            for e in entries:
                t = round(e.current, 1) if e.current is not None else 0.0
                formatted_entries.append({
                    'label': e.label or 'Sensor',
                    'current': t,
                    'high': e.high,
                    'critical': e.critical
                })
                if t > thermals['max_temp']:
                    thermals['max_temp'] = t
                if 'package' in (e.label or '').lower() or name == 'coretemp' and not thermals['package_temp']:
                    thermals['package_temp'] = t
                if t >= 80.0:
                    thermals['hot_sensors'].append({
                        'sensor': f"{name} ({e.label or 'default'})",
                        'temp': t,
                        'threshold': e.high or 85.0
                    })
            thermals['sensors'][name] = formatted_entries
    except Exception as e:
        thermals['error'] = str(e)

    if thermals['package_temp'] is None and thermals['max_temp'] > 0:
        thermals['package_temp'] = thermals['max_temp']

    if thermals['max_temp'] >= 85.0:
        thermals['status'] = 'Critical (Thermal Throttling Likely)'
    elif thermals['max_temp'] >= 72.0:
        thermals['status'] = 'Warm (High Load / Elevated)'
    else:
        thermals['status'] = 'Normal / Cool'

    return thermals


def get_disk_health():
    """Check storage capacity and identify low disk space."""
    disks = []
    issues = []
    try:
        parts = psutil.disk_partitions(all=False)
        for p in parts:
            if p.mountpoint.startswith('/snap') or p.mountpoint.startswith('/boot'):
                continue
            try:
                usage = psutil.disk_usage(p.mountpoint)
                used_pct = round(usage.percent, 1)
                disk_entry = {
                    'device': p.device,
                    'mountpoint': p.mountpoint,
                    'fstype': p.fstype,
                    'total': usage.total,
                    'used': usage.used,
                    'free': usage.free,
                    'percent': used_pct,
                    'total_str': format_bytes(usage.total),
                    'used_str': format_bytes(usage.used),
                    'free_str': format_bytes(usage.free)
                }
                disks.append(disk_entry)

                if p.mountpoint == '/' and used_pct >= 90.0:
                    issues.append({
                        'severity': 'critical' if used_pct >= 95.0 else 'warning',
                        'title': f'Low Root Storage: {used_pct}% Used ({disk_entry["free_str"]} free)',
                        'description': f'Filesystem {p.device} mounted on / is nearly full. Ubuntu performance and package installations will fail.',
                        'recommendation': 'Run `sudo apt clean`, purge old kernels, clear ~/.cache, or remove unused large files.'
                    })
            except (PermissionError, FileNotFoundError):
                pass
    except Exception as e:
        issues.append({'severity': 'warning', 'title': 'Disk check error', 'description': str(e)})

    return {'disks': disks, 'issues': issues}


def get_system_errors():
    """Collect system errors from journalctl and failed systemd units."""
    errors = []

    # 1. Check failed systemd units
    try:
        res = subprocess.run(['systemctl', '--failed', '--no-legend', '--plain'], capture_output=True, text=True, timeout=2)
        if res.returncode == 0 and res.stdout.strip():
            for line in res.stdout.strip().splitlines():
                parts = line.split()
                if parts:
                    unit_name = parts[0]
                    errors.append({
                        'severity': 'warning',
                        'category': 'Systemd Service',
                        'title': f'Failed service: {unit_name}',
                        'description': f'Service {unit_name} has entered a failed state.',
                        'recommendation': f'Inspect logs with `journalctl -u {unit_name}` or restart with `sudo systemctl restart {unit_name}`.'
                    })
    except Exception:
        pass

    # 2. Check journalctl for priority 3 (errors) in current boot
    try:
        res = subprocess.run(['journalctl', '-p', '3', '-b', '--no-pager', '-n', '25'], capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            lines = [l for l in res.stdout.strip().splitlines() if l.strip()]
            # Deduplicate and group
            seen_snippets = set()
            for line in lines:
                # filter out benign repeated lines
                snippet = line[15:80] if len(line) > 80 else line
                if snippet in seen_snippets:
                    continue
                seen_snippets.add(snippet)

                # Determine category
                cat = 'Kernel'
                severity = 'warning'
                rec = 'Review journal log for diagnostic clues.'
                if 'bluetooth' in line.lower() or 'hci0' in line.lower():
                    cat = 'Bluetooth'
                    rec = 'Restart bluetooth daemon: `sudo systemctl restart bluetooth`.'
                elif 'acpi' in line.lower() or 'bios' in line.lower():
                    cat = 'ACPI / BIOS'
                    severity = 'info'
                    rec = 'ACPI symbol warning reported by Linux kernel. Usually harmless or fixed in BIOS updates.'
                elif 'udev' in line.lower():
                    cat = 'Device Rules (udev)'
                    rec = 'Check /etc/udev/rules.d or /usr/lib/udev/rules.d syntax.'
                elif 'lightdm' in line.lower() or 'pam' in line.lower() or 'keyring' in line.lower():
                    cat = 'Display / Auth'
                    rec = 'Check user session keyring or lightdm pam configuration.'

                errors.append({
                    'severity': severity,
                    'category': cat,
                    'title': f'Log Event: {cat}',
                    'description': line,
                    'recommendation': rec
                })
    except Exception:
        pass

    return errors


def compute_health_score(battery, thermals, disk_info, errors):
    """Compute overall condition score (0-100) and status rating."""
    score = 100
    deductions = []

    # Disk deduction (heavy weight)
    for d in disk_info.get('disks', []):
        if d['mountpoint'] == '/':
            if d['percent'] >= 95:
                score -= 30
                deductions.append(f"Storage critical: {d['percent']}% full (-30)")
            elif d['percent'] >= 85:
                score -= 15
                deductions.append(f"Storage warning: {d['percent']}% full (-15)")

    # Thermal deduction
    max_t = thermals.get('max_temp', 0)
    if max_t >= 85:
        score -= 25
        deductions.append(f"High CPU temp: {max_t}°C (-25)")
    elif max_t >= 75:
        score -= 10
        deductions.append(f"Warm CPU temp: {max_t}°C (-10)")

    # Battery wear deduction
    if battery.get('health_percent') is not None:
        hp = battery['health_percent']
        if hp < 50:
            score -= 20
            deductions.append(f"Severe battery wear: {hp}% health (-20)")
        elif hp < 75:
            score -= 10
            deductions.append(f"Moderate battery wear: {hp}% health (-10)")

    # System errors deduction
    crit_count = sum(1 for e in errors if e.get('severity') == 'critical')
    warn_count = sum(1 for e in errors if e.get('severity') == 'warning')
    if crit_count > 0:
        score -= min(15, crit_count * 10)
        deductions.append(f"{crit_count} critical log errors")
    if warn_count > 0:
        score -= min(10, warn_count * 2)

    score = max(10, min(100, score))

    if score >= 85:
        grade = 'A'
        status_text = 'Optimal / Good Condition'
        color = 'emerald'
    elif score >= 70:
        grade = 'B'
        status_text = 'Attention Recommended'
        color = 'amber'
    elif score >= 50:
        grade = 'C'
        status_text = 'Suboptimal / Issues Detected'
        color = 'orange'
    else:
        grade = 'D'
        status_text = 'Critical Attention Required'
        color = 'rose'

    return {
        'score': score,
        'grade': grade,
        'status_text': status_text,
        'color': color,
        'deductions': deductions
    }


def get_system_condition():
    """Aggregate complete laptop condition analysis."""
    battery = get_battery_health()
    thermals = get_thermal_health()
    disk_data = get_disk_health()
    errors = get_system_errors()
    
    # Merge disk issues into error list
    all_issues = disk_data['issues'] + errors
    health_score = compute_health_score(battery, thermals, disk_data, all_issues)

    # Load average
    load_1, load_5, load_15 = os.getloadavg()
    cpu_count = psutil.cpu_count(logical=True) or 1

    return {
        'timestamp': time.time(),
        'system': {
            'hostname': socket.gethostname(),
            'platform': platform.platform(),
            'os_name': 'Ubuntu Linux',
            'uptime_seconds': int(time.time() - psutil.boot_time()),
            'cpu_count': cpu_count,
            'load_avg': [round(load_1, 2), round(load_5, 2), round(load_15, 2)],
            'current_user': CURRENT_USER
        },
        'health_score': health_score,
        'battery': battery,
        'thermals': thermals,
        'storage': disk_data['disks'],
        'issues': all_issues
    }


def get_memory_stats():
    """Retrieve detailed RAM and Swap metrics."""
    vm = psutil.virtual_memory()
    sm = psutil.swap_memory()

    # Memory pressure if available
    pressure = {'some': 0.0, 'full': 0.0}
    try:
        if os.path.exists('/proc/pressure/memory'):
            with open('/proc/pressure/memory', 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if parts and parts[0] in ['some', 'full']:
                        for p in parts[1:]:
                            if p.startswith('avg10='):
                                pressure[parts[0]] = float(p.split('=')[1])
    except Exception:
        pass

    data = {
        'timestamp': time.time(),
        'ram': {
            'total': vm.total,
            'available': vm.available,
            'used': vm.used,
            'free': vm.free,
            'percent': round(vm.percent, 1),
            'cached': getattr(vm, 'cached', 0),
            'buffers': getattr(vm, 'buffers', 0),
            'shared': getattr(vm, 'shared', 0),
            'total_gb': round(vm.total / (1024**3), 2),
            'available_gb': round(vm.available / (1024**3), 2),
            'used_gb': round(vm.used / (1024**3), 2),
            'free_gb': round(vm.free / (1024**3), 2),
            'cached_gb': round(getattr(vm, 'cached', 0) / (1024**3), 2),
            'buffers_gb': round(getattr(vm, 'buffers', 0) / (1024**3), 2),
            'total_str': format_bytes(vm.total),
            'available_str': format_bytes(vm.available),
            'used_str': format_bytes(vm.used),
            'free_str': format_bytes(vm.free)
        },
        'swap': {
            'total': sm.total,
            'used': sm.used,
            'free': sm.free,
            'percent': round(sm.percent, 1),
            'total_str': format_bytes(sm.total),
            'used_str': format_bytes(sm.used),
            'free_str': format_bytes(sm.free)
        },
        'pressure': pressure
    }

    return data


def is_active_process(info, current_user):
    """
    Intelligently determine if a process is 'active' or 'background'.
    - Active:
        1. State is 'running' (R)
        2. Consuming CPU (>0.1%)
        3. Attached to a TTY/pts terminal
        4. Interactive user desktop application (chrome, code, bash, etc.)
    - Background:
        1. Kernel worker threads (PPID 2, kworker, etc.)
        2. System daemons (systemd, dbus, etc.)
        3. Idle sleeping background workers with 0% CPU
    """
    status = info.get('status', '')
    cpu = info.get('cpu_percent', 0.0) or 0.0
    terminal = info.get('terminal')
    name = (info.get('name') or '').lower()
    username = info.get('username') or ''
    cmdline = ' '.join(info.get('cmdline') or []).lower()

    # Direct signs of active execution
    if status == psutil.STATUS_RUNNING:
        return True, "Running on CPU"

    if cpu >= 0.2:
        return True, f"Active CPU ({cpu:.1f}%)"

    if terminal:
        return True, f"Terminal ({terminal})"

    # Interactive desktop apps belonging to user
    user_interactive_names = {
        'chrome', 'firefox', 'brave', 'opera', 'chromium',
        'antigravity-ide', 'code', 'vlc', 'mpv', 'spotify',
        'discord', 'slack', 'telegram-desktop', 'steam',
        'terminal', 'gnome-terminal', 'tilix', 'alacritty', 'kitty',
        'bash', 'zsh', 'fish', 'node', 'python3', 'python', 'git'
    }

    if username == current_user:
        if name in user_interactive_names:
            return True, "User Interactive App"
        # Check if cmdline points to interactive app
        for keyword in user_interactive_names:
            if keyword in cmdline:
                return True, "User Application"

    return False, "Background Daemon / Idle"


def sample_processes():
    """Fast process sampler running in the background."""
    global PROCESS_CACHE
    procs = []
    
    # Iterate with required attributes
    for p in psutil.process_iter(['pid', 'ppid', 'name', 'username', 'status', 'memory_percent', 'memory_info', 'create_time', 'terminal', 'cmdline']):
        try:
            info = p.info
            # CPU percent non-blocking
            cpu = p.cpu_percent(None)
            info['cpu_percent'] = round(cpu, 1)

            # Executable path safely
            try:
                info['exe'] = p.exe()
            except Exception:
                info['exe'] = ''

            mem_bytes = info['memory_info'].rss if info.get('memory_info') else 0
            info['memory_bytes'] = mem_bytes
            info['memory_mb'] = round(mem_bytes / (1024 * 1024), 1)
            info['memory_percent'] = round(info.get('memory_percent') or 0.0, 1)

            # Determine category
            is_active, reason = is_active_process(info, CURRENT_USER)
            info['is_active'] = is_active
            info['category'] = 'Active' if is_active else 'Background'
            info['active_reason'] = reason

            # Safe to kill check
            name = (info.get('name') or '').lower()
            pid = info['pid']
            is_protected = (
                pid in (1, 2, SERVER_PID) or
                name in PROTECTED_NAMES or
                info.get('username') == 'root' and pid < 1000
            )
            info['is_protected'] = is_protected

            # Clean cmdline preview
            cmd_list = info.get('cmdline') or []
            info['cmdline_str'] = ' '.join(cmd_list)[:120] if cmd_list else info.get('name', '')

            procs.append(info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass

    with PROCESS_CACHE_LOCK:
        PROCESS_CACHE = procs


def scan_desktop_entries():
    """Scan system .desktop files to map application names, icons, and executables."""
    global DESKTOP_APPS_CACHE, LAST_DESKTOP_SCAN
    if time.time() - LAST_DESKTOP_SCAN < 60 and DESKTOP_APPS_CACHE:
        return DESKTOP_APPS_CACHE

    desktop_map = {}
    dirs = [
        '/usr/share/applications',
        '/var/lib/snapd/desktop/applications',
        os.path.expanduser('~/.local/share/applications')
    ]
    for d in dirs:
        if not os.path.isdir(d):
            continue
        for f in glob.glob(os.path.join(d, '*.desktop')):
            cfg = configparser.ConfigParser(interpolation=None)
            try:
                cfg.read(f, encoding='utf-8')
                if 'Desktop Entry' in cfg:
                    sec = cfg['Desktop Entry']
                    if sec.getboolean('NoDisplay', fallback=False):
                        continue
                    exec_cmd = sec.get('Exec', '')
                    if not exec_cmd:
                        continue
                    # Clean up exec command (strip %u, %F, quotes)
                    base_exec = exec_cmd.split()[0].replace('"', '').split('/')[-1].lower()
                    name = sec.get('Name', '').strip()
                    icon = sec.get('Icon', '').strip()
                    comment = sec.get('Comment', '').strip()
                    if base_exec and name:
                        desktop_map[base_exec] = {
                            'name': name,
                            'icon': icon,
                            'comment': comment,
                            'desktop_file': f
                        }
            except Exception:
                pass

    DESKTOP_APPS_CACHE = desktop_map
    LAST_DESKTOP_SCAN = time.time()
    return desktop_map


def resolve_package_info(exe_path, app_name):
    """Detect package manager and package name for a binary or app."""
    if not exe_path:
        return {'manager': 'system', 'package': app_name.lower(), 'can_uninstall': False, 'is_protected': True}

    with PACKAGE_CACHE_LOCK:
        if exe_path in PACKAGE_CACHE:
            return PACKAGE_CACHE[exe_path]

    pkg_info = {'manager': 'system', 'package': app_name.lower(), 'can_uninstall': False, 'is_protected': False}

    # 1. Antigravity IDE / local builds
    if 'antigravity-ide' in exe_path.lower():
        pkg_info = {
            'manager': 'standalone',
            'package': 'antigravity-ide',
            'can_uninstall': False,
            'is_protected': True,
            'reason': 'Current IDE workspace environment'
        }
    # 2. Check Snap
    elif '/snap/' in exe_path:
        parts = exe_path.split('/snap/')
        if len(parts) > 1:
            snap_name = parts[1].split('/')[0]
            is_base = snap_name in ('snapd', 'core20', 'core22', 'core24', 'bare', 'mesa-2404')
            pkg_info = {
                'manager': 'snap',
                'package': snap_name,
                'can_uninstall': not is_base,
                'is_protected': is_base
            }
    # 3. Check Google Chrome
    elif 'chrome' in exe_path.lower() and ('google' in exe_path.lower() or '/opt/google' in exe_path):
        pkg_info = {
            'manager': 'apt',
            'package': 'google-chrome-stable',
            'can_uninstall': True,
            'is_protected': False
        }
    # 4. Standard system binaries
    elif exe_path.startswith(('/usr/bin/', '/usr/sbin/', '/bin/', '/sbin/', '/usr/local/bin/')):
        base_name = os.path.basename(exe_path).lower()
        is_prot = (base_name in PROTECTED_PACKAGES or base_name in PROTECTED_NAMES)
        pkg_info = {
            'manager': 'apt',
            'package': base_name,
            'can_uninstall': not is_prot,
            'is_protected': is_prot
        }
    else:
        pkg_info = {
            'manager': 'system',
            'package': app_name.lower(),
            'can_uninstall': False,
            'is_protected': False
        }

    with PACKAGE_CACHE_LOCK:
        PACKAGE_CACHE[exe_path] = pkg_info

    return pkg_info


def describe_process_role(app_id, name, cmdline_str, ppid, pid):
    """Classify sub-process into human understandable description."""
    cmd_lower = cmdline_str.lower()
    
    if app_id == 'google-chrome':
        if '--type=renderer' in cmd_lower:
            if '--extension-process' in cmd_lower:
                return 'Chrome Extension Worker'
            return 'Browser Tab / Page'
        elif '--type=gpu-process' in cmd_lower:
            return 'GPU Video Accelerator'
        elif '--type=utility' in cmd_lower:
            if 'audio' in cmd_lower:
                return 'Audio Service Engine'
            if 'network' in cmd_lower:
                return 'Network Protocol Engine'
            if 'storage' in cmd_lower:
                return 'Storage / Cache Service'
            if 'video_capture' in cmd_lower:
                return 'Camera / Video Capture'
            return 'Utility Sub-process'
        elif '--type=zygote' in cmd_lower:
            return 'Process Zygote'
        elif 'crashpad' in cmd_lower:
            return 'Crash Reporter'
        elif ppid == 1 or not cmd_lower.startswith('/opt/google/chrome/chrome --type='):
            return 'Main Chrome Browser Window'
        return 'Browser Worker'

    elif app_id == 'antigravity-ide':
        if 'language_server' in cmd_lower:
            return 'Language Server (IntelliSense)'
        elif 'ptyhost' in cmd_lower:
            return 'Integrated Terminal Host'
        elif 'extensionhost' in cmd_lower:
            return 'Extension Host Worker'
        elif 'filewatcher' in cmd_lower:
            return 'Filesystem Watcher'
        elif '--type=renderer' in cmd_lower:
            return 'Editor Window / Workspace'
        elif '--type=gpu-process' in cmd_lower:
            return 'GPU Visual Accelerator'
        elif 'crashpad' in cmd_lower:
            return 'Crash Reporter'
        return 'IDE Core Process'

    elif 'nginx' in app_id:
        if 'master process' in cmd_lower:
            return 'Master Controller (root)'
        return 'HTTP Worker Process'

    elif 'php-fpm' in app_id:
        if 'master process' in cmd_lower:
            return 'Master Controller'
        return 'FastCGI Pool Worker'

    elif 'bash' in app_id or 'shell' in app_id:
        return 'Interactive Terminal Session'

    elif 'chrome-devtools-mcp' in app_id:
        return 'MCP Protocol Bridge'

    elif 'node' in app_id:
        return 'Node.js Execution Worker'

    elif 'python' in app_id:
        return 'Python Script Runtime'

    return 'Worker / Sub-process'


def get_applications_list(category_filter='all', search_query='', sort_by='memory'):
    """Aggregate running processes into high-level software application entities."""
    with PROCESS_CACHE_LOCK:
        procs = list(PROCESS_CACHE)

    desktop_map = scan_desktop_entries()
    total_ram = psutil.virtual_memory().total

    groups = {}

    for p in procs:
        pid = p.get('pid')
        ppid = p.get('ppid')
        name = p.get('name') or ''
        name_lower = name.lower()
        exe = p.get('exe') or ''
        exe_lower = exe.lower()
        cmdline = p.get('cmdline') or []
        cmdline_str = p.get('cmdline_str') or (' '.join(cmdline) if cmdline else name)
        cmd_lower = cmdline_str.lower()
        username = p.get('username') or ''
        rss = p.get('memory_bytes', 0)
        cpu = p.get('cpu_percent', 0.0)
        is_active = p.get('is_active', False)

        # 1. Antigravity IDE
        if 'antigravity-ide' in exe_lower or 'antigravity-ide' in name_lower or '/debs/antigravity-ide/' in exe_lower or 'language_server_linux' in name_lower:
            app_id = 'antigravity-ide'
            app_name = 'Antigravity IDE'
            app_category = 'desktop'
            icon_hint = 'code'
            package_info = {
                'manager': 'standalone',
                'package': 'antigravity-ide',
                'can_uninstall': False,
                'is_protected': True
            }

        # 2. Google Chrome (separate from IDE/MCP)
        elif ('/opt/google/chrome' in exe_lower or (name_lower in ('chrome', 'google-chrome') and 'antigravity' not in exe_lower)) and 'chrome-devtools-mcp' not in cmd_lower:
            app_id = 'google-chrome'
            app_name = 'Google Chrome'
            app_category = 'desktop'
            icon_hint = 'chrome'
            package_info = {
                'manager': 'apt',
                'package': 'google-chrome-stable',
                'can_uninstall': True,
                'is_protected': False
            }

        # 3. Chrome DevTools MCP
        elif 'chrome-devtools-mcp' in cmd_lower:
            app_id = 'chrome-devtools-mcp'
            app_name = 'Chrome DevTools MCP'
            app_category = 'cli'
            icon_hint = 'terminal'
            package_info = {
                'manager': 'node',
                'package': 'chrome-devtools-mcp',
                'can_uninstall': False,
                'is_protected': False
            }

        # 4. Snap Applications
        elif '/snap/' in exe_lower or (cmdline and '/snap/' in cmdline[0].lower()):
            snap_path = exe_lower if '/snap/' in exe_lower else cmdline[0].lower()
            parts = snap_path.split('/snap/')
            snap_pkg = parts[1].split('/')[0] if len(parts) > 1 else name_lower
            app_id = f'snap-{snap_pkg}'
            desktop_info = desktop_map.get(snap_pkg, {})
            app_name = desktop_info.get('name') or snap_pkg.replace('-', ' ').title()
            app_category = 'desktop' if is_active else 'daemon'
            icon_hint = 'snap'
            package_info = {
                'manager': 'snap',
                'package': snap_pkg,
                'can_uninstall': snap_pkg not in ('snapd', 'core20', 'core22', 'core24', 'bare', 'mesa-2404'),
                'is_protected': snap_pkg in ('snapd', 'core20', 'core22', 'core24', 'bare', 'mesa-2404')
            }

        # 5. Nginx
        elif name_lower == 'nginx' or 'nginx' in exe_lower:
            app_id = 'nginx'
            app_name = 'Nginx Web Server'
            app_category = 'daemon'
            icon_hint = 'server'
            package_info = {
                'manager': 'apt',
                'package': 'nginx',
                'can_uninstall': True,
                'is_protected': False
            }

        # 6. PHP-FPM
        elif 'php-fpm' in name_lower or 'php-fpm' in exe_lower:
            app_id = 'php-fpm'
            app_name = 'PHP FastCGI Process Manager'
            app_category = 'daemon'
            icon_hint = 'server'
            package_info = {
                'manager': 'apt',
                'package': 'php-fpm',
                'can_uninstall': True,
                'is_protected': False
            }

        # 7. Shell / Terminal
        elif name_lower in ('bash', 'zsh', 'fish', 'dash', 'sh'):
            app_id = f'shell-{name_lower}'
            app_name = 'Bash Terminal Sessions' if name_lower == 'bash' else f'{name.title()} Shell'
            app_category = 'cli'
            icon_hint = 'terminal'
            package_info = {
                'manager': 'apt',
                'package': name_lower,
                'can_uninstall': False,
                'is_protected': True
            }

        # 8. Known desktop app from desktop_map
        elif name_lower in desktop_map or (exe and os.path.basename(exe).lower() in desktop_map):
            base = name_lower if name_lower in desktop_map else os.path.basename(exe).lower()
            d_info = desktop_map[base]
            app_id = f'app-{base}'
            app_name = d_info.get('name') or name.title()
            app_category = 'desktop'
            icon_hint = 'desktop'
            package_info = resolve_package_info(exe, base)

        # 9. Protected Core System Daemons
        elif name_lower in ('systemd', 'dbus-daemon', 'lightdm', 'xorg', 'budgie-wm', 'budgie-panel', 'budgie-daemon', 'pipewire', 'wireplumber', 'polkitd', 'sshd'):
            app_id = f'sys-{name_lower}'
            app_name = f'System: {name}'
            app_category = 'daemon'
            icon_hint = 'system'
            package_info = {
                'manager': 'system',
                'package': name_lower,
                'can_uninstall': False,
                'is_protected': True
            }

        # 10. Fallback / Generic
        else:
            app_id = f'proc-{name_lower}'
            app_name = name.title()
            app_category = 'desktop' if is_active else 'daemon'
            icon_hint = 'generic'
            package_info = resolve_package_info(exe, name_lower)

        # Initialize group
        if app_id not in groups:
            groups[app_id] = {
                'app_id': app_id,
                'name': app_name,
                'category': app_category,
                'icon_hint': icon_hint,
                'package_name': package_info.get('package', app_id),
                'package_manager': package_info.get('manager', 'system'),
                'can_uninstall': package_info.get('can_uninstall', False),
                'is_protected': package_info.get('is_protected', False),
                'user': username,
                'main_pid': pid,
                'exe': exe or (cmdline_str.split()[0] if cmdline else ''),
                'total_rss': 0,
                'total_cpu': 0.0,
                'process_count': 0,
                'pids': [],
                'processes': []
            }

        g = groups[app_id]
        g['total_rss'] += rss
        g['total_cpu'] += cpu
        g['process_count'] += 1
        g['pids'].append(pid)
        if pid < g['main_pid']:
            g['main_pid'] = pid

        role = describe_process_role(app_id, name, cmdline_str, ppid, pid)
        g['processes'].append({
            'pid': pid,
            'ppid': ppid,
            'name': name,
            'role': role,
            'cmdline_str': cmdline_str[:120],
            'cpu_percent': round(cpu, 1),
            'memory_mb': round(rss / (1024 * 1024), 1),
            'memory_percent': round((rss / total_ram) * 100.0, 1) if total_ram else 0.0
        })

    # Post-process groups
    apps_list = []
    for g in groups.values():
        g['total_cpu'] = round(g['total_cpu'], 1)
        g['total_rss_mb'] = round(g['total_rss'] / (1024 * 1024), 1)
        g['total_rss_str'] = format_bytes(g['total_rss'])
        g['memory_percent'] = round((g['total_rss'] / total_ram) * 100.0, 1) if total_ram else 0.0
        g['is_heavy'] = (g['total_rss'] >= 400 * 1024 * 1024) or (g['total_cpu'] >= 10.0)
        
        # Sort processes inside each app by memory desc
        g['processes'].sort(key=lambda x: x['memory_mb'], reverse=True)
        apps_list.append(g)

    # Compute summary stats
    total_apps = len(apps_list)
    user_apps = sum(1 for a in apps_list if a['category'] in ('desktop', 'cli'))
    daemons = total_apps - user_apps
    heavy_apps = sum(1 for a in apps_list if a['is_heavy'])
    total_rss_all = sum(a['total_rss'] for a in apps_list)

    # Filtering
    filtered = []
    for a in apps_list:
        if category_filter == 'user' and a['category'] not in ('desktop', 'cli'):
            continue
        elif category_filter == 'daemons' and a['category'] != 'daemon':
            continue
        elif category_filter == 'heavy' and not a['is_heavy']:
            continue

        if search_query:
            sq = search_query.lower()
            name_m = sq in a['name'].lower()
            pkg_m = sq in (a['package_name'] or '').lower()
            app_id_m = sq in a['app_id'].lower()
            pids_m = any(sq in str(p['pid']) for p in a['processes'])
            if not (name_m or pkg_m or app_id_m or pids_m):
                continue

        filtered.append(a)

    # Sorting
    if sort_by == 'cpu':
        filtered.sort(key=lambda x: x['total_cpu'], reverse=True)
    elif sort_by == 'name':
        filtered.sort(key=lambda x: x['name'].lower())
    elif sort_by == 'procs':
        filtered.sort(key=lambda x: x['process_count'], reverse=True)
    else:  # 'memory' default
        filtered.sort(key=lambda x: x['total_rss'], reverse=True)

    return {
        'summary': {
            'total_apps': total_apps,
            'user_apps': user_apps,
            'daemons': daemons,
            'heavy_apps': heavy_apps,
            'total_memory_str': format_bytes(total_rss_all)
        },
        'applications': filtered
    }


def get_package_details(pkg_name, manager, exe_path=''):
    """Retrieve installed version, size, description for a package."""
    info = {
        'package': pkg_name,
        'manager': manager,
        'version': 'Unknown',
        'installed_size': 'Unknown',
        'description': 'No description available',
        'can_uninstall': True
    }
    
    # Try resolving real package from exe if needed
    if exe_path and manager == 'apt' and os.path.exists(exe_path):
        try:
            res_s = subprocess.run(['dpkg', '-S', exe_path], capture_output=True, text=True, timeout=2)
            if res_s.returncode == 0 and res_s.stdout.strip():
                resolved = res_s.stdout.strip().split(':')[0].strip().split()[0]
                if resolved:
                    pkg_name = resolved
                    info['package'] = pkg_name
        except Exception:
            pass

    if pkg_name in PROTECTED_PACKAGES or pkg_name in PROTECTED_NAMES:
        info['can_uninstall'] = False
        info['description'] = 'Essential Ubuntu system component (Protected)'
        return info

    if manager == 'apt':
        try:
            res = subprocess.run(['dpkg', '-s', pkg_name], capture_output=True, text=True, timeout=2)
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    if line.startswith('Version:'):
                        info['version'] = line.split(':', 1)[1].strip()
                    elif line.startswith('Installed-Size:'):
                        try:
                            kb = int(line.split(':', 1)[1].strip())
                            info['installed_size'] = f"{kb / 1024:.1f} MB" if kb >= 1024 else f"{kb} KB"
                        except Exception:
                            pass
                    elif line.startswith('Description:'):
                        info['description'] = line.split(':', 1)[1].strip()
        except Exception:
            pass
    elif manager == 'snap':
        try:
            res = subprocess.run(['snap', 'list', pkg_name], capture_output=True, text=True, timeout=2)
            if res.returncode == 0:
                lines = res.stdout.strip().splitlines()
                if len(lines) > 1:
                    parts = lines[1].split()
                    if len(parts) >= 2:
                        info['version'] = parts[1]
                info['description'] = f'Snap package: {pkg_name}'
        except Exception:
            pass

    return info


def background_monitor_thread():
    """Background loop that updates RAM history and process CPU cache every 1.5s."""
    # First iteration to prime psutil cpu_percent
    for p in psutil.process_iter():
        try:
            p.cpu_percent(None)
        except Exception:
            pass

    while True:
        try:
            # 1. Update RAM history
            mem_data = get_memory_stats()
            with HISTORY_LOCK:
                RAM_HISTORY.append({
                    'time': time.strftime('%H:%M:%S', time.localtime(mem_data['timestamp'])),
                    'used_gb': mem_data['ram']['used_gb'],
                    'available_gb': mem_data['ram']['available_gb'],
                    'percent': mem_data['ram']['percent']
                })
                if len(RAM_HISTORY) > MAX_HISTORY:
                    RAM_HISTORY.pop(0)

            # 2. Update process cache
            sample_processes()
        except Exception as e:
            print("Monitor thread error:", e)

        time.sleep(1.5)


class SysPulseHandler(SimpleHTTPRequestHandler):
    """Custom HTTP handler serving REST API and static frontend assets."""

    def __init__(self, *args, **kwargs):
        # Serve static directory by default
        static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
        super().__init__(*args, directory=static_dir, **kwargs)

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/system/condition':
            data = get_system_condition()
            self._send_json(data)
            return

        elif path == '/api/memory/stats':
            data = get_memory_stats()
            with HISTORY_LOCK:
                data['history'] = list(RAM_HISTORY)
            self._send_json(data)
            return

        elif path == '/api/processes':
            # Query params: filter (all, active, background), user (all, me)
            query = parse_qs(parsed.query)
            category_filter = query.get('category', ['all'])[0].lower()
            user_filter = query.get('user', ['all'])[0].lower()
            search = query.get('q', [''])[0].lower().strip()

            with PROCESS_CACHE_LOCK:
                procs = list(PROCESS_CACHE)

            filtered = []
            for p in procs:
                # Category filter
                if category_filter == 'active' and not p['is_active']:
                    continue
                elif category_filter == 'background' and p['is_active']:
                    continue

                # User filter
                if user_filter == 'me' and p['username'] != CURRENT_USER:
                    continue

                # Search filter
                if search:
                    pid_str = str(p['pid'])
                    pname = (p['name'] or '').lower()
                    cmd = (p['cmdline_str'] or '').lower()
                    user = (p['username'] or '').lower()
                    if search not in pid_str and search not in pname and search not in cmd and search not in user:
                        continue

                filtered.append(p)

            # Return count stats
            total_count = len(procs)
            active_count = sum(1 for p in procs if p['is_active'])
            bg_count = total_count - active_count
            user_count = sum(1 for p in procs if p['username'] == CURRENT_USER)

            self._send_json({
                'stats': {
                    'total': total_count,
                    'active': active_count,
                    'background': bg_count,
                    'user': user_count
                },
                'processes': filtered
            })
            return

        elif path == '/api/applications':
            query = parse_qs(parsed.query)
            category_filter = query.get('category', ['all'])[0].lower()
            search = query.get('q', [''])[0].strip()
            sort_by = query.get('sort', ['memory'])[0].lower()
            data = get_applications_list(category_filter, search, sort_by)
            self._send_json(data)
            return

        elif path == '/api/applications/package-info':
            query = parse_qs(parsed.query)
            pkg_name = query.get('pkg', [''])[0].strip()
            manager = query.get('manager', ['apt'])[0].strip().lower()
            exe_path = query.get('exe', [''])[0].strip()
            data = get_package_details(pkg_name, manager, exe_path)
            self._send_json(data)
            return

        # Fallback to static files
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Read JSON body
        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            body = json.loads(body_bytes.decode('utf-8'))
        except Exception:
            body = {}

        if path == '/api/processes/kill':
            pid = body.get('pid')
            sig_name = body.get('signal', 'SIGTERM').upper()
            sig = signal.SIGKILL if sig_name == 'SIGKILL' else signal.SIGTERM

            if not pid or not isinstance(pid, int):
                self._send_json({'success': False, 'error': 'Invalid PID'}, status=400)
                return

            if pid in (1, 2, SERVER_PID):
                self._send_json({'success': False, 'error': f'Cannot kill protected system process {pid}'}, status=403)
                return

            try:
                os.kill(pid, sig)
                time.sleep(0.05)
                # Quick resample
                sample_processes()
                self._send_json({
                    'success': True,
                    'message': f'Sent {sig_name} to PID {pid}',
                    'pid': pid
                })
            except ProcessLookupError:
                self._send_json({'success': True, 'message': f'Process {pid} already terminated'})
            except PermissionError:
                self._send_json({'success': False, 'error': f'Permission denied killing PID {pid}. Process owned by another user or root.'}, status=403)
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, status=500)
            return

        elif path == '/api/processes/kill-batch':
            pids = body.get('pids', [])
            sig_name = body.get('signal', 'SIGTERM').upper()
            sig = signal.SIGKILL if sig_name == 'SIGKILL' else signal.SIGTERM

            if not isinstance(pids, list) or not pids:
                self._send_json({'success': False, 'error': 'No PIDs provided'}, status=400)
                return

            killed = []
            failed = []

            for pid in pids:
                if pid in (1, 2, SERVER_PID):
                    failed.append({'pid': pid, 'reason': 'Protected process'})
                    continue
                try:
                    os.kill(pid, sig)
                    killed.append(pid)
                except ProcessLookupError:
                    killed.append(pid)
                except PermissionError:
                    failed.append({'pid': pid, 'reason': 'Permission denied'})
                except Exception as e:
                    failed.append({'pid': pid, 'reason': str(e)})

            sample_processes()
            self._send_json({
                'success': True,
                'killed_count': len(killed),
                'failed_count': len(failed),
                'killed': killed,
                'failed': failed
            })
            return

        elif path == '/api/processes/kill-all-active':
            # Terminate all active non-protected processes
            sig_name = body.get('signal', 'SIGTERM').upper()
            sig = signal.SIGKILL if sig_name == 'SIGKILL' else signal.SIGTERM
            include_other_users = body.get('include_other_users', False)

            with PROCESS_CACHE_LOCK:
                procs = list(PROCESS_CACHE)

            target_pids = []
            for p in procs:
                if not p['is_active']:
                    continue
                if p['is_protected']:
                    continue
                if not include_other_users and p['username'] != CURRENT_USER:
                    continue
                target_pids.append(p['pid'])

            killed = []
            failed = []

            for pid in target_pids:
                try:
                    os.kill(pid, sig)
                    killed.append(pid)
                except ProcessLookupError:
                    killed.append(pid)
                except PermissionError:
                    failed.append({'pid': pid, 'reason': 'Permission denied'})
                except Exception as e:
                    failed.append({'pid': pid, 'reason': str(e)})

            sample_processes()
            self._send_json({
                'success': True,
                'total_targeted': len(target_pids),
                'killed_count': len(killed),
                'failed_count': len(failed),
                'killed': killed,
                'failed': failed
            })
            return

        elif path == '/api/applications/kill':
            app_id = body.get('app_id')
            sig_name = body.get('signal', 'SIGTERM').upper()
            sig = signal.SIGKILL if sig_name == 'SIGKILL' else signal.SIGTERM

            if not app_id:
                self._send_json({'success': False, 'error': 'No app_id provided'}, status=400)
                return

            if app_id in ('antigravity-ide', 'sys-systemd', 'sys-xorg', 'sys-lightdm', 'shell-bash'):
                self._send_json({'success': False, 'error': f'Application "{app_id}" is protected and cannot be killed en masse.'}, status=403)
                return

            # Fetch current applications and find matching PIDs
            apps_data = get_applications_list('all', '', 'memory')
            target_pids = []
            app_name = app_id
            for a in apps_data.get('applications', []):
                if a['app_id'] == app_id:
                    app_name = a['name']
                    target_pids = a['pids']
                    break

            if not target_pids:
                self._send_json({'success': False, 'error': f'No running processes found for application "{app_id}".'}, status=404)
                return

            killed = []
            failed = []
            for pid in target_pids:
                if pid in (1, 2, SERVER_PID):
                    failed.append({'pid': pid, 'reason': 'Protected system process'})
                    continue
                try:
                    os.kill(pid, sig)
                    killed.append(pid)
                except ProcessLookupError:
                    killed.append(pid)
                except PermissionError:
                    failed.append({'pid': pid, 'reason': 'Permission denied'})
                except Exception as e:
                    failed.append({'pid': pid, 'reason': str(e)})

            sample_processes()
            self._send_json({
                'success': True,
                'app_id': app_id,
                'app_name': app_name,
                'total_targeted': len(target_pids),
                'killed_count': len(killed),
                'failed_count': len(failed),
                'killed': killed,
                'failed': failed,
                'message': f'Terminated {len(killed)} process{"es" if len(killed) != 1 else ""} of {app_name}'
            })
            return

        elif path == '/api/applications/simulate-uninstall':
            pkg_name = body.get('package_name', '').strip()
            manager = body.get('package_manager', 'apt').strip().lower()
            password = body.get('password', 'anto')

            if not pkg_name:
                self._send_json({'success': False, 'error': 'No package_name specified'}, status=400)
                return

            if pkg_name in PROTECTED_PACKAGES or pkg_name in PROTECTED_NAMES:
                self._send_json({'success': False, 'error': f'Package "{pkg_name}" is an essential system component and cannot be uninstalled.'}, status=403)
                return

            if manager == 'apt':
                cmd = ['sudo', '-S', 'apt-get', 'remove', '-s', pkg_name]
            elif manager == 'snap':
                cmd = ['snap', 'list', pkg_name]
            else:
                self._send_json({'success': False, 'error': f'Unsupported package manager: {manager}'}, status=400)
                return

            try:
                p = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                out, err = p.communicate(input=(password or 'anto') + '\n', timeout=15)
                full_out = (out + '\n' + err).strip()
                self._send_json({
                    'success': p.returncode == 0,
                    'output': full_out,
                    'package_name': pkg_name
                })
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, status=500)
            return

        elif path == '/api/applications/uninstall':
            pkg_name = body.get('package_name', '').strip()
            manager = body.get('package_manager', 'apt').strip().lower()
            password = body.get('password', 'anto')
            kill_first = body.get('kill_first', True)
            app_id = body.get('app_id', '')

            if not pkg_name:
                self._send_json({'success': False, 'error': 'No package_name specified'}, status=400)
                return

            if pkg_name in PROTECTED_PACKAGES or pkg_name in PROTECTED_NAMES:
                self._send_json({'success': False, 'error': f'Package "{pkg_name}" is an essential system component and cannot be uninstalled.'}, status=403)
                return

            # Terminate running app processes first if requested
            if kill_first and app_id:
                apps_data = get_applications_list('all', '', 'memory')
                for a in apps_data.get('applications', []):
                    if a['app_id'] == app_id:
                        for pid in a['pids']:
                            if pid not in (1, 2, SERVER_PID):
                                try:
                                    os.kill(pid, signal.SIGTERM)
                                except Exception:
                                    pass
                        time.sleep(0.3)
                        break

            # Execute uninstallation
            if manager == 'apt':
                cmd = ['sudo', '-S', 'apt-get', 'remove', '--purge', '-y', pkg_name]
            elif manager == 'snap':
                cmd = ['sudo', '-S', 'snap', 'remove', pkg_name]
            elif manager == 'flatpak':
                cmd = ['sudo', '-S', 'flatpak', 'uninstall', '-y', pkg_name]
            else:
                self._send_json({'success': False, 'error': f'Unsupported package manager: {manager}'}, status=400)
                return

            try:
                p = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                out, err = p.communicate(input=(password or 'anto') + '\n', timeout=60)
                full_out = (out + '\n' + err).strip()
                sample_processes()
                
                if p.returncode == 0:
                    self._send_json({
                        'success': True,
                        'message': f'Successfully uninstalled package "{pkg_name}"',
                        'output': full_out,
                        'package_name': pkg_name
                    })
                else:
                    self._send_json({
                        'success': False,
                        'error': f'Uninstaller exited with code {p.returncode}',
                        'output': full_out,
                        'package_name': pkg_name
                    }, status=500)
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, status=500)
            return

        self._send_json({'error': 'Not found'}, status=404)


def find_available_port(start_port=5050, max_tries=20):
    """Find a free TCP port."""
    for p in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', p))
                return p
            except OSError:
                continue
    return start_port


def main():
    global PORT
    PORT = find_available_port(PORT)

    # Launch background monitor thread
    t = threading.Thread(target=background_monitor_thread, daemon=True)
    t.start()

    # Initial sample
    sample_processes()

    server_address = (HOST, PORT)
    httpd = ThreadingHTTPServer(server_address, SysPulseHandler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"===========================================================")
    print(f"  SysPulse: Ubuntu Laptop Doctor, RAM & Process Monitor    ")
    print(f"===========================================================")
    print(f"  Web Dashboard running at: {url}")
    print(f"  Active User: {CURRENT_USER} | PID: {SERVER_PID}")
    print(f"===========================================================")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()


if __name__ == '__main__':
    main()

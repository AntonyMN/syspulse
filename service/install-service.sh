#!/usr/bin/env bash
# ==============================================================================
# SysPulse Linux Service Installer
# Registers SysPulse as a persistent systemd user daemon that runs on boot.
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"
PYTHON_BIN="$(which python3)"
SERVICE_NAME="syspulse.service"
USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
TARGET_SERVICE="$USER_SYSTEMD_DIR/$SERVICE_NAME"
PORT="${PORT:-5050}"

echo "=========================================================="
echo "  SysPulse: Installing Background Systemd Daemon (Linux)  "
echo "=========================================================="

if [ -z "$PYTHON_BIN" ]; then
    echo "Error: python3 not found in PATH."
    exit 1
fi

# Ensure user systemd directory exists
mkdir -p "$USER_SYSTEMD_DIR"

echo "-> Generating unit file at $TARGET_SERVICE..."
cat <<EOF > "$TARGET_SERVICE"
[Unit]
Description=SysPulse System Health Doctor & Process Controller
After=network.target

[Service]
Type=simple
ExecStart=$PYTHON_BIN $PROJECT_DIR/server.py
WorkingDirectory=$PROJECT_DIR
Restart=on-failure
RestartSec=3s
Environment="PORT=$PORT"
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=default.target
EOF

echo "-> Reloading systemd user daemon..."
systemctl --user daemon-reload

echo "-> Enabling and starting $SERVICE_NAME..."
systemctl --user enable "$SERVICE_NAME"
systemctl --user restart "$SERVICE_NAME"

# Enable user lingering so background service runs without active GUI login
if command -v loginctl &> /dev/null; then
    echo "-> Enabling lingering for user $(whoami) (starts on boot)..."
    loginctl enable-linger "$(whoami)" 2>/dev/null || true
fi

echo "=========================================================="
echo "✓ SysPulse Service Installed and Running!"
echo "  Status check:  systemctl --user status $SERVICE_NAME"
echo "  Stop service:  systemctl --user stop $SERVICE_NAME"
echo "  Restart:       systemctl --user restart $SERVICE_NAME"
echo "  View logs:     journalctl --user -u $SERVICE_NAME -f"
echo "  Web Dashboard: http://127.0.0.1:$PORT"
echo "=========================================================="

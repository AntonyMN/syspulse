#!/usr/bin/env bash
# ==============================================================================
# SysPulse Linux Service Uninstaller
# Stops, disables, and removes the systemd user daemon.
# ==============================================================================

SERVICE_NAME="syspulse.service"
TARGET_SERVICE="$HOME/.config/systemd/user/$SERVICE_NAME"

echo "=========================================================="
echo "  SysPulse: Removing Background Systemd Daemon (Linux)    "
echo "=========================================================="

if systemctl --user is-active --quiet "$SERVICE_NAME"; then
    echo "-> Stopping $SERVICE_NAME..."
    systemctl --user stop "$SERVICE_NAME"
fi

if systemctl --user is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "-> Disabling $SERVICE_NAME..."
    systemctl --user disable "$SERVICE_NAME"
fi

if [ -f "$TARGET_SERVICE" ]; then
    echo "-> Removing service file $TARGET_SERVICE..."
    rm -f "$TARGET_SERVICE"
fi

systemctl --user daemon-reload
echo "✓ SysPulse background service has been completely removed."
echo "=========================================================="


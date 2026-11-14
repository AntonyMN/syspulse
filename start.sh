#!/usr/bin/env bash
# ==============================================================================
# SysPulse Launcher: System Condition, RAM Analytics & Process Controller
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Starting SysPulse: System Health & Process Controller   "
echo "=========================================================="

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed. Please install python3."
    exit 1
fi

# Check psutil
if ! python3 -c "import psutil" 2>/dev/null; then
    echo "Notice: python3-psutil is missing. Attempting to install..."
    sudo apt-get update && sudo apt-get install -y python3-psutil || pip install psutil
fi

PORT="${PORT:-5050}"
export PORT

echo "-> Launching SysPulse on port $PORT..."
echo "-> Tip: To run SysPulse permanently in the background as a systemd service, run:"
echo "     ./service/install-service.sh"
echo "=========================================================="

python3 server.py

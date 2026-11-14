#!/usr/bin/env bash
# ==============================================================================
# SysPulse Launcher: Ubuntu Laptop Condition, RAM Analytics & Process Manager
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Starting SysPulse: Ubuntu Laptop Doctor & Process Manager"
echo "=========================================================="

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed."
    exit 1
fi

# Check psutil
if ! python3 -c "import psutil" 2>/dev/null; then
    echo "Warning: python3-psutil is missing. Attempting to install..."
    sudo apt-get update && sudo apt-get install -y python3-psutil || pip install psutil
fi

PORT="${PORT:-5050}"
export PORT

echo "-> Launching backend server on port $PORT..."
python3 server.py

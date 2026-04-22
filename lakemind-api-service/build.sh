#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/../version.json"
WHEEL_DIR="$SCRIPT_DIR/wheel"

echo "====================================="
echo "LakeMind API Service Build"
echo "====================================="

mkdir -p "$WHEEL_DIR"
cp "$VERSION_FILE" "$SCRIPT_DIR/version.json" 2>/dev/null || echo "version.json not found"

echo "Build complete"

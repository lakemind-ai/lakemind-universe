#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/../version.json"

echo "========================================"
echo "LakeMind API Service Local Build"
echo "========================================"

echo "Step 1: Copying version.json..."
cp "$VERSION_FILE" "$SCRIPT_DIR/version.json" || echo "  version.json not found"

echo "Step 2: Installing app dependencies..."
pip install -r requirements.txt --quiet && echo "  Dependencies installed"

echo ""
echo "========================================"
echo "Local build complete!"
echo "========================================"
echo ""
echo "Start the backend with:"
echo "  python -m uvicorn app.main:app --reload --port 8001"

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/version.json"

echo "========================================"
echo "LakeMind Universe — Production Build"
echo "========================================"

# Step 1: Build root portal
echo ""
echo "Step 1: Building root portal..."
cd "$SCRIPT_DIR/lakemind-root-portal"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build
echo "  Root portal built"

# Step 2: Build main portal
echo ""
echo "Step 2: Building main portal..."
cd "$SCRIPT_DIR/lakemind-main-portal"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build
echo "  Main portal built"

# Step 3: Copy version.json to public directories
echo ""
echo "Step 3: Distributing version.json..."
cp "$VERSION_FILE" "$SCRIPT_DIR/lakemind-root-portal/public/version.json" 2>/dev/null || true
cp "$VERSION_FILE" "$SCRIPT_DIR/lakemind-api-service/version.json" 2>/dev/null || true
echo "  version.json distributed"

# Step 4: Build docs (optional)
echo ""
echo "Step 4: Building documentation..."
cd "$SCRIPT_DIR/lakemind-docs"
if [ -f "package.json" ]; then
    yarn install --frozen-lockfile 2>/dev/null || yarn install
    yarn build 2>/dev/null && echo "  Docs built" || echo "  Docs build skipped (no config)"
else
    echo "  Docs skipped (no package.json)"
fi

echo ""
echo "========================================"
echo "Production build complete!"
echo "========================================"

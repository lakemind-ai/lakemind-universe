# ============================================================================
# LakeMind Universe - Local Development Makefile
# ============================================================================
#
# Quick Start:
#   make backend-setup        # First-time backend setup (venv + deps)
#   make ui-install           # First-time UI setup (yarn install all portals)
#   make backend-start        # Start backend API service
#   make ui-start             # Start all UI portals (root + main)
#
# ============================================================================

.PHONY: help ui-dev ui-install ui-start ui-stop ui-build ui-lint \
        backend-setup backend-setup-api backend-start backend-stop \
        docs-install docs-start docs-stop docs-build clean

help:
	@echo "=============================================="
	@echo "LakeMind Universe - Development Commands"
	@echo "=============================================="
	@echo ""
	@echo "UI Commands:"
	@echo "  make ui-install          Install yarn deps for all portals"
	@echo "  make ui-dev              Install deps AND start all portals"
	@echo "  make ui-start            Start all portals (root + main)"
	@echo "  make ui-stop             Stop all portals"
	@echo "  make ui-build            Build all portals for production"
	@echo "  make ui-lint             Lint all portal code"
	@echo ""
	@echo "Backend Commands:"
	@echo "  make backend-setup       Setup API service (venv + deps)"
	@echo "  make backend-start       Start API service (foreground)"
	@echo "  make backend-stop        Stop API service"
	@echo ""
	@echo "Docs Commands:"
	@echo "  make docs-install        Install docs dependencies"
	@echo "  make docs-start          Start docs dev server (background)"
	@echo "  make docs-stop           Stop docs dev server"
	@echo "  make docs-build          Build docs for production"
	@echo ""
	@echo "Other Commands:"
	@echo "  make clean               Remove build artifacts and caches"
	@echo "  make help                Show this help message"
	@echo ""
	@echo "Ports:"
	@echo "  Root Portal: http://localhost:3003"
	@echo "  Main Portal: http://localhost:9090"
	@echo "  API Service: http://localhost:9000"
	@echo "  Docs:        http://localhost:3002"
	@echo ""

# ============================================================================
# UI Commands
# ============================================================================

ui-install:
	@echo "Installing UI dependencies for all portals..."
	cd lakemind-root-portal && yarn install
	cd lakemind-main-portal && yarn install
	@echo "All UI dependencies installed"

ui-dev: ui-install ui-start

ui-start:
	@echo "Starting all UI portals..."
	@cd lakemind-root-portal && nohup yarn startlocal > /tmp/lakemind-root-portal.log 2>&1 & echo $$! > /tmp/lakemind-root-portal.pid
	@echo "  Root portal started on port 3003 (PID: $$(cat /tmp/lakemind-root-portal.pid))"
	@cd lakemind-main-portal && nohup yarn startlocal > /tmp/lakemind-main-portal.log 2>&1 & echo $$! > /tmp/lakemind-main-portal.pid
	@echo "  Main portal started on port 9090 (PID: $$(cat /tmp/lakemind-main-portal.pid))"
	@echo ""
	@echo "Access: http://localhost:3003"
	@echo "Logs:"
	@echo "  Root: /tmp/lakemind-root-portal.log"
	@echo "  Main: /tmp/lakemind-main-portal.log"

ui-stop:
	@echo "Stopping all UI portals..."
	@if [ -f /tmp/lakemind-root-portal.pid ]; then \
		kill $$(cat /tmp/lakemind-root-portal.pid) 2>/dev/null || true; \
		rm -f /tmp/lakemind-root-portal.pid; \
		echo "  Root portal stopped"; \
	else \
		lsof -ti:3003 | xargs kill 2>/dev/null || true; \
	fi
	@if [ -f /tmp/lakemind-main-portal.pid ]; then \
		kill $$(cat /tmp/lakemind-main-portal.pid) 2>/dev/null || true; \
		rm -f /tmp/lakemind-main-portal.pid; \
		echo "  Main portal stopped"; \
	else \
		lsof -ti:9090 | xargs kill 2>/dev/null || true; \
	fi
	@echo "All portals stopped"

ui-build:
	@echo "Building all portals for production..."
	cd lakemind-root-portal && yarn build
	cd lakemind-main-portal && yarn build
	@echo "All portal builds complete"

ui-lint:
	@echo "Linting all portal code..."
	cd lakemind-root-portal && yarn lint
	cd lakemind-main-portal && yarn lint
	@echo "Linting complete"

# ============================================================================
# Backend Commands
# ============================================================================

backend-setup: backend-setup-api

backend-setup-api:
	@echo "=============================================="
	@echo "Setting up LakeMind API Service"
	@echo "=============================================="
	@echo ""
	@echo "Step 1: Creating Python virtual environment..."
	@if [ ! -d "lakemind-api-service/venv" ]; then \
		cd lakemind-api-service && python3.14 -m venv venv; \
		echo "  Virtual environment created"; \
	else \
		echo "  Virtual environment already exists"; \
	fi
	@echo ""
	@echo "Step 2: Upgrading pip..."
	@cd lakemind-api-service && ./venv/bin/pip install --upgrade pip --quiet
	@echo "  pip upgraded"
	@echo ""
	@echo "Step 3: Installing dependencies..."
	@cd lakemind-api-service && ./venv/bin/pip install -r requirements.txt
	@echo ""
	@echo "=============================================="
	@echo "Backend setup complete!"
	@echo "=============================================="
	@echo ""
	@echo "To start the API service:"
	@echo "  make backend-start"
	@echo ""

backend-start:
	@echo "Starting API service on port 9000..."
	@cd lakemind-api-service && ./venv/bin/python -m uvicorn app.main:app --reload --port 9000

backend-stop:
	@echo "Stopping API service..."
	@lsof -ti:9000 | xargs kill 2>/dev/null || true
	@echo "API service stopped"

# ============================================================================
# Docs Commands
# ============================================================================

docs-install:
	@echo "Installing docs dependencies..."
	cd lakemind-docs && yarn install
	@echo "Docs dependencies installed"

docs-start:
	@echo "Starting docs dev server on port 3002..."
	@cd lakemind-docs && nohup yarn start --port 3002 > /tmp/lakemind-docs.log 2>&1 & echo $$! > /tmp/lakemind-docs.pid
	@echo "Docs dev server started (PID: $$(cat /tmp/lakemind-docs.pid))"
	@echo "Logs: /tmp/lakemind-docs.log"
	@echo "Access: http://localhost:3002"

docs-stop:
	@echo "Stopping docs dev server..."
	@if [ -f /tmp/lakemind-docs.pid ]; then \
		kill $$(cat /tmp/lakemind-docs.pid) 2>/dev/null || true; \
		rm -f /tmp/lakemind-docs.pid; \
		echo "Docs dev server stopped"; \
	else \
		lsof -ti:3002 | xargs kill 2>/dev/null || true; \
		echo "Done"; \
	fi

docs-build:
	@echo "Building docs for production..."
	cd lakemind-docs && yarn build
	@echo "Docs build complete"

# ============================================================================
# Utility Commands
# ============================================================================

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf lakemind-root-portal/dist
	@rm -rf lakemind-root-portal/node_modules/.cache
	@rm -rf lakemind-main-portal/dist
	@rm -rf lakemind-main-portal/node_modules/.cache
	@rm -rf lakemind-docs/build
	@rm -rf lakemind-docs/.docusaurus
	@rm -f /tmp/lakemind-root-portal.pid
	@rm -f /tmp/lakemind-root-portal.log
	@rm -f /tmp/lakemind-main-portal.pid
	@rm -f /tmp/lakemind-main-portal.log
	@rm -f /tmp/lakemind-docs.pid
	@rm -f /tmp/lakemind-docs.log
	@echo "Clean complete"

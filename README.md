# LakeMind Universe

**LakeMind** — AI-powered semantic layer configurator for Databricks.

> *Your catalog, understood.*

## What LakeMind does

LakeMind scans your Unity Catalog, groups tables into business entities, proposes metrics and dimensions using AI, and publishes versioned glossaries that power Databricks Genie workspaces.

| Capability | Description |
|------------|-------------|
| **Scan & Review** | Scans Unity Catalog schemas, groups tables into entities (golden + AI-derived), proposes column-level business definitions with confidence scores |
| **Entity Detail** | Edit metrics, dimensions, and Genie instructions via scoped AI chat. Refine formulas, preview impact, approve changes |
| **Publish & Versions** | Version-controlled glossary publishing with diffs, audit trails, and automatic Genie workspace instruction regeneration |

## Architecture

Single-SPA microfrontend + microservices architecture.

```
lakemind-universe/
├── lakemind-root-portal/    # Single-SPA root config (orchestrator, port 3000)
├── lakemind-main-portal/    # Main MFE — React + Tailwind (port 8080)
├── lakemind-api-service/    # FastAPI backend (port 8001)
├── lakemind-docs/           # Docusaurus documentation site
├── docker-compose.yml       # Container orchestration
├── Makefile                 # Local development commands
├── build.sh                 # Production build script
└── version.json             # Version info
```

## Quick Start

```bash
# First-time setup
make backend-setup    # Python venv + dependencies
make ui-install       # yarn install all portals

# Daily development
make backend-start    # API service on :8001
make ui-start         # Root on :3000, Main on :8080

# Access the app
open http://localhost:3000
```

## Stack

- **Frontend**: Single-SPA + React 18 + Tailwind CSS + SystemJS
- **Backend**: FastAPI + SQLAlchemy + Alembic + Lakebase (Postgres)
- **Docs**: Docusaurus
- **Deployment**: Databricks Apps + Docker Compose
- **AI**: `ai_query` + Llama via Databricks Model Serving
- **Catalog**: Unity Catalog system tables

## lakemind.ai

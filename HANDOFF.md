# LakeMind Universe — Claude Handoff

**Last updated:** 2026-04-22
**Product:** LakeMind (lakemind.ai)
**Repo:** https://github.com/lakemind-ai/lakemind-universe

---

## What LakeMind is

An AI-powered semantic layer configurator for Databricks. LakeMind scans Unity Catalog, groups tables into business entities, proposes metrics and dimensions with AI confidence scoring, and publishes versioned glossaries that power Databricks Genie workspaces.

| Capability | What it does |
|------------|-------------|
| **Scan & Review** | Scans Unity Catalog schemas, groups tables into entities (golden from LakeFusion metadata + AI-derived), proposes column-level business definitions with confidence scores |
| **Entity Detail** | Edit metrics, dimensions, and Genie instructions via scoped AI chat. Refine formulas, preview query impact, approve changes |
| **Publish & Versions** | Version-controlled glossary publishing with diffs, audit trails, and automatic Genie workspace instruction regeneration |

**Tagline:** *Your catalog, understood.*

---

## Stack

- **Backend:** FastAPI + SQLAlchemy + Alembic + Lakebase (Postgres-compatible, Databricks-managed)
- **Frontend:** Single-SPA + React 18 + Tailwind CSS (dark theme) + SystemJS
- **Docs:** Docusaurus
- **Deployment:** Databricks Apps (`app.yml`) + Docker Compose
- **AI:** `ai_query` + Llama (Databricks model serving)
- **Catalog:** Unity Catalog system tables (`system.information_schema`)
- **Graph:** NetworkX for entity relationship traversal

---

## Repo structure

```
lakemind-universe/
├── lakemind-root-portal/              # Single-SPA root config (orchestrator)
│   ├── src/
│   │   ├── index.ejs                  # SystemJS import map, CDN shared deps
│   │   ├── lakemind-root-config.ts    # MFE registration + layout engine
│   │   └── microfrontend-layout.html  # Route → MFE mapping
│   ├── public/config.js               # Runtime env config
│   ├── entrypoint.sh                  # Docker runtime config generator
│   ├── webpack.config.js
│   └── package.json
│
├── lakemind-main-portal/              # Main MFE (React + Tailwind dark theme)
│   ├── src/
│   │   ├── lakemind-main.tsx          # single-spa lifecycle (bootstrap/mount/unmount)
│   │   ├── root.component.tsx         # Root with ToastContainer
│   │   ├── app.tsx                    # react-router-dom v5 routing
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── applayout.tsx      # Dark theme layout + AuthGuard
│   │   │   │   └── header.tsx         # Nav tabs, catalog selector, user chip
│   │   │   ├── auth/
│   │   │   │   ├── authguard.tsx
│   │   │   │   ├── loginpage.tsx      # Databricks OIDC login
│   │   │   │   └── authcallback.tsx
│   │   │   ├── scan/
│   │   │   │   └── scanpage.tsx       # Entity tree, scan summary, metric proposals
│   │   │   ├── entity/
│   │   │   │   └── entitydetailpage.tsx # Metric editing + AI chat panel
│   │   │   └── publish/
│   │   │       └── publishpage.tsx    # Version list, diff view, audit trail
│   │   ├── services/
│   │   │   ├── scanservice.ts
│   │   │   ├── entityservice.ts
│   │   │   ├── glossaryservice.ts
│   │   │   └── catalogservice.ts
│   │   └── lib/
│   │       ├── api.ts                 # fetch wrapper with X-LakeMind-Token
│   │       ├── session.ts             # localStorage token management
│   │       └── navigation.ts          # Module definitions
│   ├── webpack.config.js
│   └── package.json
│
├── lakemind-api-service/              # FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── health_route.py
│   │   │   ├── auth_route.py          # Databricks OIDC
│   │   │   ├── scan_route.py          # Catalog scanning, entity detection
│   │   │   ├── entity_route.py        # Entity/metric/dimension CRUD, AI propose/refine
│   │   │   ├── glossary_route.py      # Version management, publish, diff, audit
│   │   │   └── catalog_route.py       # Unity Catalog browser
│   │   ├── models/
│   │   │   ├── scan.py                # CatalogScan, DetectedEntity, DetectedTable, DetectedColumn
│   │   │   ├── entity.py              # GlossaryMetric, GlossaryDimension, GenieInstruction
│   │   │   ├── glossary.py            # GlossaryVersion, VersionChange, AuditEntry
│   │   │   └── dbconfig.py            # System configuration
│   │   ├── utils/
│   │   │   ├── database.py            # Lakebase connection (OAuth token refresh)
│   │   │   ├── auth.py                # Databricks OIDC token validation
│   │   │   ├── http_bearer.py         # X-LakeMind-Token header
│   │   │   └── config_defaults.py     # Seeds DB on startup
│   │   ├── main.py                    # FastAPI app, lifespan, router registration
│   │   └── cron_jobs.py               # APScheduler background jobs
│   ├── alembic/                       # Migrations (idempotent)
│   ├── app.yml                        # Databricks App config with Lakebase resource
│   ├── requirements.txt
│   └── .env.example
│
├── lakemind-docs/                     # Docusaurus docs
├── Makefile                           # make backend-setup / ui-install / backend-start / ui-start
├── build.sh                           # Production build (both portals + docs)
├── docker-compose.yml                 # root-portal + main-portal + api-service
├── version.json
└── lakemind.code-workspace
```

---

## What's complete

### Backend
- All three route modules: scan, entity, glossary
- SQLAlchemy models with FK relationships for scan → entity → metric/dimension hierarchy
- Version management with diff and audit trail
- AI integration via `ai_query` for entity proposals and metric refinement
- Lakebase connection with OAuth token refresh
- Alembic with idempotency patching
- Databricks OIDC auth
- APScheduler for background sync jobs
- `app.yml` ready for Databricks Apps deployment

### Frontend
- Single-SPA MFE architecture (root + main portals)
- Dark theme UI matching wireframe aesthetic (#0B0E14 bg, #5B7FE8 accent)
- Scan & Review page with entity tree, scan summary, metric proposal blocks
- Entity Detail page with formula editing and AI chat panel
- Publish & Versions page with diff view and audit trail
- Auth flow (OIDC login, callback, guard)
- All services wired to API endpoints

### Infra
- `Makefile` with ui-install, ui-start, backend-setup, backend-start
- `build.sh` for production builds
- `docker-compose.yml` for containerized deployment
- Dockerfiles for all three services
- VS Code workspace file

---

## What still needs to be built

### High priority (MVP)

**Scan engine**
- Implement actual Databricks SQL queries in `scan_route.py` (DESCRIBE TABLE, INFORMATION_SCHEMA)
- Entity grouping algorithm (match tables by naming convention + FK relationships)
- Column profiling (null rates, distinct counts, sample values)

**AI features**
- `ai_query` integration for entity description generation
- Metric formula proposal based on column profiling stats
- Scoped chat refinement (conversational metric editing)

**Genie integration**
- Generate Genie workspace instructions from published glossary
- Push instructions to Databricks via SDK
- Instruction token counting

**Detail pages**
- Column-level review UI (approve/reject per column)
- Metric formula editor with syntax highlighting
- Dimension value explorer

### Medium priority

- Alembic initial migration (`alembic revision --autogenerate -m "initial"`)
- Search/filter across entities and metrics
- Export glossary as YAML/JSON
- Diff visualization (side-by-side comparison)

### Low priority / post-MVP

- Graph visualization of entity relationships
- Bulk approve/reject
- Scheduled rescans
- Multi-workspace Genie publishing
- Collaboration (comments, assignments)

---

## Key patterns (standards)

### Architecture
- **Single-SPA MFE**: Root portal orchestrates, main portal handles all UI. Additional MFEs can be added later.
- **SystemJS**: Shared dependencies (React, react-router-dom, etc.) loaded via CDN import maps. No duplicate bundling.
- **Microservices**: Each backend service is independently deployable. Currently one service; can split later.

### Token header
LakeMind uses `X-LakeMind-Token` — wired in `http_bearer.py` and `lib/api.ts`.

### Database connection
`database.py` uses OAuth token refresh pattern — `DATABRICKS_DATABASE_INSTANCE` env var, `workspace_client.database_credentials.generate()`, event listener on engine connect.

### Auth guard
`AuthGuard` checks `localStorage` for `lakemind_token`.

### App.yml
Lakebase resource is named `lakemind-db`, database is `lakemind`.

### Dark theme
All UI uses dark color scheme: bg `#0B0E14`, surface `#11151C`, border `#232B38`, text `#E6EAF0`, accent `#5B7FE8` (indigo).

### API response format
All endpoints return `{ status, message, data }` JSON.

---

## Local dev setup

```bash
# 1. Clone
git clone https://github.com/lakemind-ai/lakemind-universe
cd lakemind-universe

# 2. Backend
make backend-setup
cp lakemind-api-service/.env.example lakemind-api-service/.env
# edit .env — set DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_HTTP_PATH

# 3. Frontend
make ui-install

# 4. Start everything
make backend-start    # Terminal 1 — API on :9000
make ui-start         # Terminal 2 — Root on :3003, Main on :9090

# 5. Access
open http://localhost:3003
```

---

## Databricks Apps deployment

```bash
# Build all portals + docs
./build.sh

# Deploy API service via Databricks Apps
cd lakemind-api-service
# Upload to workspace and deploy via Databricks Apps UI
```

---

## Context

LakeMind is a standalone product. Its semantic layer reads Unity Catalog metadata, uses AI to propose business definitions, and publishes glossaries that configure Databricks Genie workspaces. The architecture uses the same single-spa + FastAPI patterns proven in production at scale.

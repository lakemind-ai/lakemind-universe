import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.health_route import health_router
from app.api.auth_route import auth_router
from app.api.scan_route import scan_router
from app.api.entity_route import entity_router
from app.api.glossary_route import glossary_router
from app.api.catalog_route import catalog_router
from app.api.compute_route import compute_router
from app.api.realm_route import realm_router
from app.api.lexicon_route import lexicon_router
from app.api.chronicle_route import chronicle_router
from app.api.datalens_route import datalens_router

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

sys.path.extend(os.path.dirname(__file__))

app_prefix = "/api"

from app.utils.database import lifespan as base_lifespan
from contextlib import asynccontextmanager
from app.utils.run_migrations import run_migrations
from app.utils.app_db import db_context
from app.utils.config_defaults import CONFIG_DEFAULTS
from app.models.dbconfig import DBConfigProperties
from app.models.scan import CatalogScan, DetectedEntity, DetectedTable, DetectedColumn
from app.models.entity import GlossaryMetric, GlossaryDimension, GenieInstruction
from app.models.glossary import GlossaryVersion, VersionChange, AuditEntry, GlossaryEntry
from app.models.scan import ScanProposal
from app.models.oidc_request import OIDCRequest
from app.models.activity_log import ActivityLog
from app.models.chat import ChatSession, ChatMessage
from app.models.realm import Realm, RealmEntity


logger.info("Starting LakeMind API Service")


@asynccontextmanager
async def lifespan(app):
    async with base_lifespan(app):
        try:
            with db_context() as db:
                # Step 1: Create all tables
                try:
                    logger.info("Creating database tables...")
                    from app.utils.database import Base, engine
                    Base.metadata.create_all(bind=engine)
                    logger.info("Database tables created")
                except Exception as e:
                    logger.error(f"Table creation error: {e}")

                # Step 2: Run Alembic migrations
                try:
                    logger.info("Running Alembic migrations...")
                    run_migrations()
                    logger.info("Migrations complete")
                except Exception as e:
                    logger.error(f"Migration failed: {e}")
                    raise

                # Step 3: Seed default config
                logger.info("Seeding default config...")
                for config_item in CONFIG_DEFAULTS:
                    config_key = config_item.get("config_key")
                    existing = db.query(DBConfigProperties).filter(
                        DBConfigProperties.config_key == config_key
                    ).first()
                    if existing:
                        for field_name, field_value in config_item.items():
                            if field_name == "config_key":
                                continue
                            current = getattr(existing, field_name, None)
                            if current is None or current == "":
                                setattr(existing, field_name, field_value)
                    else:
                        db.add(DBConfigProperties(**config_item))
                db.commit()
                logger.info("Config seeded")

        except Exception as e:
            logger.error(f"Startup error: {e}")
            raise

        yield

        logger.info("Shutting down LakeMind API Service")


app = FastAPI(
    title="LakeMind API Service",
    description="AI-powered semantic layer configurator for Databricks",
    docs_url=f"{app_prefix}/docs",
    redoc_url=f"{app_prefix}/redoc",
    openapi_url=f"{app_prefix}/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def databricks_auth_middleware(request: Request, call_next):
    logger.debug(f"-> {request.method} {request.url.path}")
    response = await call_next(request)
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(health_router, prefix=app_prefix)
app.include_router(auth_router, prefix=app_prefix)
app.include_router(scan_router, prefix=app_prefix)
app.include_router(entity_router, prefix=app_prefix)
app.include_router(glossary_router, prefix=app_prefix)
app.include_router(catalog_router, prefix=app_prefix)
app.include_router(compute_router, prefix=app_prefix)
app.include_router(realm_router, prefix=app_prefix)
app.include_router(lexicon_router, prefix=app_prefix)
app.include_router(chronicle_router, prefix=app_prefix)
app.include_router(datalens_router, prefix=app_prefix)

logger.info("All API routes registered")

# APScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from app.cron_jobs import get_scheduler_jobs

scheduler = BackgroundScheduler()
scheduler = get_scheduler_jobs(scheduler=scheduler)
scheduler.start()

print("\n--- Registered APScheduler Jobs ---")
for job in scheduler.get_jobs():
    print(f"ID: {job.id}, Next Run: {job.next_run_time}, Trigger: {job.trigger}")
print("-----------------------------------\n")

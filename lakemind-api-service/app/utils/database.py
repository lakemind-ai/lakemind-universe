import asyncio
import os
import time
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI

from databricks.sdk import WorkspaceClient
from sqlalchemy import URL, create_engine, text, Engine, MetaData
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy import inspect

import logging

logger = logging.getLogger(__name__)

# Naming convention for constraints
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}
metadata = MetaData(naming_convention=naming_convention)
Base = declarative_base(metadata=metadata)

# Environment configuration
SERVICE_NAME = os.getenv("SERVICE_NAME", "LakeMindApp")

IS_DATABRICKS_APPS = os.getenv("DATABRICKS_APP_NAME") is not None
USE_LOCAL_POSTGRES = os.getenv("USE_LOCAL_POSTGRES", "false").lower() == "true"

# Connection config
PGHOST = os.getenv("PGHOST", "localhost")
PGPORT = int(os.getenv("PGPORT", "5432"))
PGDATABASE = os.getenv("PGDATABASE", "lakemind")
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD")
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST")
DATABRICKS_TOKEN = os.getenv("LAKEMIND_DATABRICKS_DAPI")
DATABRICKS_DATABASE_INSTANCE = os.getenv("DATABRICKS_DATABASE_INSTANCE", "lakemind-db")

# Connection pool settings
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "60"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1200"))

# Globals
engine: Engine | None = None
SessionLocal: sessionmaker | None = None
workspace_client: WorkspaceClient | None = None
database_instance = None
url: URL | None = None

postgres_password: str | None = None
last_password_refresh: float = 0
token_refresh_task: asyncio.Task | None = None
pool_warmed_up: bool = False


def get_lakebase_token() -> str:
    """Fetch a fresh Lakebase OAuth token using Databricks SDK."""
    global workspace_client, database_instance

    if workspace_client is None:
        workspace_client = WorkspaceClient(host=DATABRICKS_HOST, token=DATABRICKS_TOKEN)

    if database_instance is None:
        instances = list(workspace_client.database_instances.list())
        database_instance = next(
            (i for i in instances if i.name == DATABRICKS_DATABASE_INSTANCE), None
        )
        if database_instance is None:
            raise ValueError(
                f"Database instance '{DATABRICKS_DATABASE_INSTANCE}' not found"
            )

    credentials = workspace_client.database_credentials.generate(
        database_instance=database_instance
    )
    return credentials.token


def refresh_password_if_needed():
    global postgres_password, last_password_refresh
    now = time.time()
    # Refresh every 45 minutes
    if postgres_password is None or (now - last_password_refresh) > 2700:
        logger.info("Refreshing Lakebase OAuth token...")
        postgres_password = get_lakebase_token()
        last_password_refresh = now
        logger.info("Lakebase OAuth token refreshed")


def build_connection_url() -> URL:
    global url
    if IS_DATABRICKS_APPS:
        host = os.getenv("PGHOST", PGHOST)
        port = int(os.getenv("PGPORT", str(PGPORT)))
        user = os.getenv("PGUSER", PGUSER)
        database = os.getenv("PGDATABASE", PGDATABASE)
        url = URL.create(
            drivername="postgresql+psycopg",
            username=user,
            password="placeholder",
            host=host,
            port=port,
            database=database,
        )
    elif USE_LOCAL_POSTGRES:
        url = URL.create(
            drivername="postgresql+psycopg",
            username=PGUSER,
            password=PGPASSWORD,
            host=PGHOST,
            port=PGPORT,
            database=PGDATABASE,
        )
    else:
        refresh_password_if_needed()
        url = URL.create(
            drivername="postgresql+psycopg",
            username=PGUSER,
            password=postgres_password,
            host=PGHOST,
            port=PGPORT,
            database=PGDATABASE,
        )
    return url


def init_engine():
    global engine, SessionLocal

    db_url = build_connection_url()
    engine = create_engine(
        db_url,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_timeout=DB_POOL_TIMEOUT,
        pool_recycle=DB_POOL_RECYCLE,
        pool_pre_ping=True,
    )

    if IS_DATABRICKS_APPS:
        from sqlalchemy import event

        @event.listens_for(engine, "do_connect")
        def provide_token(dialect, conn_rec, cargs, cparams):
            global postgres_password, last_password_refresh
            now = time.time()
            if postgres_password is None or (now - last_password_refresh) > 2700:
                try:
                    postgres_password = get_lakebase_token()
                    last_password_refresh = now
                except Exception as e:
                    logger.error(f"Token refresh failed: {e}")
            if postgres_password:
                cparams["password"] = postgres_password

    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    logger.info(f"Database engine initialized ({'Databricks Apps' if IS_DATABRICKS_APPS else 'local'})")


def create_tables():
    Base.metadata.create_all(bind=engine)


def dispose_engine():
    global engine
    if engine:
        engine.dispose()
        engine = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def warm_up_connection_pool():
    global pool_warmed_up
    if pool_warmed_up:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        pool_warmed_up = True
        logger.info("Connection pool warmed up")
    except Exception as e:
        logger.warning(f"Connection pool warm-up failed: {e}")


async def start_token_refresh():
    global token_refresh_task
    if not IS_DATABRICKS_APPS:
        return

    async def refresh_loop():
        while True:
            await asyncio.sleep(2400)
            try:
                refresh_password_if_needed()
            except Exception as e:
                logger.error(f"Token refresh loop error: {e}")

    token_refresh_task = asyncio.create_task(refresh_loop())


async def stop_token_refresh():
    global token_refresh_task
    if token_refresh_task:
        token_refresh_task.cancel()
        token_refresh_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("LakeMind API startup")
    logger.info("=" * 60)

    init_engine()
    logger.info("Database engine initialized")

    create_tables()
    logger.info("Database tables created")

    await warm_up_connection_pool()
    logger.info("Connection pool warmed up")

    await start_token_refresh()
    logger.info("Token refresh configured")

    logger.info("=" * 60)
    logger.info("LakeMind API is ready!")
    logger.info("=" * 60)

    yield

    logger.info("Shutting down LakeMind API...")
    await stop_token_refresh()
    dispose_engine()
    logger.info("Shutdown complete")


def db_commit_auto_rollback(db: Session, close_session=False, raise_exception=False):
    should_rollback = False
    exception = ""
    try:
        db.commit()
    except Exception as err:
        exception = traceback.format_exc()
        should_rollback = True
        if raise_exception:
            raise err
    finally:
        if should_rollback:
            logger.exception(f"Commit failed — rolling back: {exception}")
            db.rollback()
        if close_session:
            db.close()


from fastapi.security import HTTPAuthorizationCredentials
from fastapi import Depends, Request
from app.utils.auth import token_required, token_auth_scheme


def token_required_wrapper(
    token: HTTPAuthorizationCredentials = Depends(token_auth_scheme),
    request: Request = None,
    db: Session = Depends(get_db),
):
    return token_required(token, request, db)

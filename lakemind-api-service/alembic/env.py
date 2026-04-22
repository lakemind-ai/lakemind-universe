import os
import sys
from logging.config import fileConfig
from sqlalchemy import inspect
from alembic import context
from dotenv import load_dotenv

load_dotenv(".env")

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.utils.database import Base as AppBase
import app.models  # noqa — registers all models

from app.models.scan import CatalogScan, DetectedEntity, DetectedTable, DetectedColumn
from app.models.entity import GlossaryMetric, GlossaryDimension, GenieInstruction
from app.models.glossary import GlossaryVersion, VersionChange, AuditEntry
from app.models.dbconfig import DBConfigProperties

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = AppBase.metadata

from app.utils import database
database.init_engine()

from alembic import op
from functools import wraps
import logging

logger = logging.getLogger(__name__)


def patch_safe_ops():
    insp = inspect(database.engine)

    def safe_wrap(fn_name, checker):
        orig_fn = getattr(op, fn_name)

        @wraps(orig_fn)
        def wrapper(*args, **kwargs):
            if checker(*args, **kwargs):
                logger.info(f"op.{fn_name} skipped — already satisfied")
                return None
            return orig_fn(*args, **kwargs)

        setattr(op, fn_name, wrapper)

    def table_exists(name, *_, **__):
        return name in insp.get_table_names()

    def column_exists(table_name, col, *_, **__):
        return any(c["name"] == col for c in insp.get_columns(table_name))

    def index_exists(name, table_name=None, *_, **__):
        return table_name and any(i["name"] == name for i in insp.get_indexes(table_name))

    def constraint_exists(name, table_name=None, *_, **__):
        if not table_name:
            return False
        fks = [fk["name"] for fk in insp.get_foreign_keys(table_name)]
        uqs = [uc["name"] for uc in insp.get_unique_constraints(table_name)]
        return name in (fks + uqs)

    safe_wrap("create_table", table_exists)
    safe_wrap("drop_table", lambda name, *_, **__: name not in insp.get_table_names())
    safe_wrap("create_index", index_exists)
    safe_wrap("add_column", lambda table_name, col, **__: column_exists(table_name, col.name))
    safe_wrap("drop_column", lambda table_name, col, **__: not column_exists(table_name, col))
    safe_wrap("create_unique_constraint", constraint_exists)
    safe_wrap("create_foreign_key", constraint_exists)

    logger.info("Alembic ops patched for idempotency")


patch_safe_ops()


def run_migrations_offline():
    db_url = str(database.url)
    context.configure(
        url=db_url.replace("%", "%%"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = database.engine
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

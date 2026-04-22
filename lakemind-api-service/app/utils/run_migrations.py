import sys
from alembic import command
from alembic.config import Config
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)

alembic_cfg = Config("alembic.ini")


def _log_error(e: Exception) -> None:
    if isinstance(e, SQLAlchemyError):
        orig = getattr(e, "orig", None)
        if orig:
            logger.error(f"Database error: {orig}")
        else:
            logger.error(f"SQLAlchemy error: {e}")
        stmt = getattr(e, "statement", None)
        if stmt:
            logger.error(f"Failed SQL: {stmt}")
    else:
        logger.error(f"Migration error: {type(e).__name__}: {e}")


def run_migrations() -> None:
    try:
        logger.info("Running Alembic migrations -> head")
        command.upgrade(alembic_cfg, "head")
        logger.info("Migrations completed successfully")
    except Exception as e:
        logger.error("Migration failed")
        _log_error(e)
        print(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_migrations()

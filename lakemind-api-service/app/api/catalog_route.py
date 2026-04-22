import os
from fastapi import APIRouter, HTTPException

import logging
logger = logging.getLogger(__name__)

catalog_router = APIRouter(tags=["Catalog API"], prefix="/catalog")

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"


@catalog_router.get("/catalogs")
def list_catalogs():
    try:
        from databricks.sdk import WorkspaceClient
        client = WorkspaceClient()
        catalogs = [c.name for c in client.catalogs.list() if c.name]
        return {"status": "ok", "data": catalogs}
    except Exception as e:
        logger.error(f"Failed to list catalogs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@catalog_router.get("/catalogs/{catalog}/schemas")
def list_schemas(catalog: str):
    try:
        from databricks.sdk import WorkspaceClient
        client = WorkspaceClient()
        schemas = [s.name for s in client.schemas.list(catalog_name=catalog) if s.name]
        return {"status": "ok", "data": schemas}
    except Exception as e:
        logger.error(f"Failed to list schemas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@catalog_router.get("/catalogs/{catalog}/schemas/{schema}/tables")
def list_tables(catalog: str, schema: str):
    try:
        from databricks.sdk import WorkspaceClient
        client = WorkspaceClient()
        tables = [
            {
                "name": t.name,
                "full_name": t.full_name,
                "table_type": str(t.table_type) if t.table_type else "UNKNOWN",
            }
            for t in client.tables.list(catalog_name=catalog, schema_name=schema)
            if t.name
        ]
        return {"status": "ok", "data": tables}
    except Exception as e:
        logger.error(f"Failed to list tables: {e}")
        raise HTTPException(status_code=500, detail=str(e))

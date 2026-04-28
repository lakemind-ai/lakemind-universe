"""
Catalog Service — reads Unity Catalog metadata via Databricks SQL connector.
Accepts warehouse_id to use the correct SQL warehouse for queries.
"""
import os
import logging

logger = logging.getLogger(__name__)

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("LAKEMIND_DATABRICKS_DAPI", "")


def _get_host() -> str:
    host = DATABRICKS_HOST
    if host.startswith(("http://", "https://")):
        host = host.split("://", 1)[1]
    return host


def _get_http_path(warehouse_id: str) -> str:
    """Resolve warehouse_id to HTTP path. Falls back to env var."""
    if warehouse_id:
        return f"/sql/1.0/warehouses/{warehouse_id}"
    return os.getenv("DATABRICKS_HTTP_PATH", "")


def _connect(warehouse_id: str):
    from databricks import sql as dbsql

    return dbsql.connect(
        server_hostname=_get_host(),
        http_path=_get_http_path(warehouse_id),
        access_token=DATABRICKS_TOKEN,
    )


def list_schemas(catalog: str, warehouse_id: str) -> list[str]:
    """List all user schemas in a catalog, excluding system schemas."""
    with _connect(warehouse_id) as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"SHOW SCHEMAS IN `{catalog}`")
            schemas = [row[0] for row in cursor.fetchall()]
            return [s for s in schemas if s not in ("information_schema", "default")]


def list_tables(catalog: str, schema: str, warehouse_id: str) -> list[dict]:
    """List all tables in a schema with basic metadata."""
    tables = []
    with _connect(warehouse_id) as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"SHOW TABLES IN `{catalog}`.`{schema}`")
            rows = cursor.fetchall()
            for row in rows:
                tbl_name = row[1] if len(row) > 1 else row[0]
                tables.append({
                    "catalog": catalog,
                    "schema": schema,
                    "table_name": tbl_name,
                    "full_name": f"{catalog}.{schema}.{tbl_name}",
                })
    return tables


def describe_table(catalog: str, schema: str, table: str, warehouse_id: str) -> dict:
    """Describe a table: returns columns with name, type, and comment."""
    columns = []
    with _connect(warehouse_id) as conn:
        with conn.cursor() as cursor:
            full_name = f"`{catalog}`.`{schema}`.`{table}`"
            cursor.execute(f"DESCRIBE {full_name}")
            for col in cursor.fetchall():
                col_name = col[0]
                if col_name.startswith("#"):
                    continue
                col_type = col[1] if len(col) > 1 else "string"
                col_comment = col[2] if len(col) > 2 else ""
                columns.append({
                    "name": col_name,
                    "type": col_type,
                    "comment": col_comment or "",
                })
    return {
        "catalog": catalog,
        "schema": schema,
        "table_name": table,
        "full_name": f"{catalog}.{schema}.{table}",
        "columns": columns,
    }


def get_table_row_count(catalog: str, schema: str, table: str, warehouse_id: str) -> int:
    """Get approximate row count for a table."""
    try:
        with _connect(warehouse_id) as conn:
            with conn.cursor() as cursor:
                full_name = f"`{catalog}`.`{schema}`.`{table}`"
                cursor.execute(f"SELECT COUNT(*) FROM {full_name} LIMIT 1")
                result = cursor.fetchone()
                return result[0] if result else 0
    except Exception as e:
        logger.warning(f"Row count failed for {catalog}.{schema}.{table}: {e}")
        return 0

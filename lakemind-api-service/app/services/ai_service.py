"""
AI Service — calls Databricks model serving endpoints via ai_query for semantic analysis.
"""
import json
import re
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
    if warehouse_id:
        return f"/sql/1.0/warehouses/{warehouse_id}"
    return os.getenv("DATABRICKS_HTTP_PATH", "")


def _call_model(prompt: str, model_endpoint: str, warehouse_id: str) -> str:
    """Execute ai_query via Databricks SQL connector. Returns raw LLM response text."""
    from databricks import sql as dbsql

    safe_prompt = prompt.replace("'", "\\'").replace("\n", "\\n")

    with dbsql.connect(
        server_hostname=_get_host(),
        http_path=_get_http_path(warehouse_id),
        access_token=DATABRICKS_TOKEN,
    ) as conn:
        with conn.cursor() as cursor:
            query = f"SELECT ai_query('{model_endpoint}', '{safe_prompt}') as result"
            cursor.execute(query)
            result = cursor.fetchone()
            return result[0] if result else "{}"


def _parse_json_response(raw: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try extracting JSON from markdown code block
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding first { ... } block
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    logger.warning(f"Failed to parse AI response as JSON: {raw[:200]}")
    return {}


def propose_entity_groupings(
    tables_metadata: list[dict],
    model_endpoint: str,
    warehouse_id: str,
) -> list[dict]:
    """
    Ask LLM to group tables into logical business entities.

    Args:
        tables_metadata: List of {table_name, full_name, columns: [{name, type, comment}]}
        model_endpoint: Databricks model serving endpoint name
        warehouse_id: SQL warehouse ID for ai_query execution

    Returns:
        List of {entity_name, description, tables: [full_table_names], confidence_score}
    """
    # Build compact table summary for the prompt
    table_summaries = []
    for t in tables_metadata:
        cols = ", ".join([f"{c['name']} ({c['type']})" for c in t.get("columns", [])[:20]])
        table_summaries.append(f"- {t['full_name']}: [{cols}]")
    tables_text = "\n".join(table_summaries)

    prompt = f"""You are a data architect analyzing a Unity Catalog schema.
Group these tables into logical business entities based on naming patterns, column overlap, and business domain.

Tables:
{tables_text}

Rules:
- Group related tables (e.g. customer_dim, customer_orders -> "Customer" entity)
- Strip common prefixes (dim_, fact_, stg_, raw_, bronze_, silver_, gold_)
- Each table belongs to exactly one entity
- Provide a business description for each entity
- Score confidence from 0.0 to 1.0

Respond ONLY with valid JSON, no markdown:
{{
  "entities": [
    {{
      "entity_name": "string",
      "description": "one-line business description",
      "tables": ["full.table.name"],
      "confidence_score": 0.0
    }}
  ]
}}"""

    raw = _call_model(prompt, model_endpoint, warehouse_id)
    parsed = _parse_json_response(raw)
    return parsed.get("entities", [])


def propose_glossary_entries(
    entity_name: str,
    entity_description: str,
    tables_metadata: list[dict],
    model_endpoint: str,
    warehouse_id: str,
) -> list[dict]:
    """
    Ask LLM to propose glossary entries for an entity.
    Proposes: definitions (table/column), metrics (entity), dimensions (column).

    Returns:
        List of {kind, scope, target_name, name, description, formula?, source_column?, confidence_score}
    """
    table_summaries = []
    for t in tables_metadata:
        cols = []
        for c in t.get("columns", []):
            col_str = f"{c['name']} ({c['type']})"
            if c.get("comment"):
                col_str += f" -- {c['comment']}"
            cols.append(col_str)
        table_summaries.append(f"Table: {t['full_name']}\n  Columns: {', '.join(cols)}")
    tables_text = "\n".join(table_summaries)

    prompt = f"""You are a semantic layer expert defining business glossary terms.

Entity: {entity_name}
Description: {entity_description}

{tables_text}

Generate glossary entries following these rules:
- DEFINITIONS: Business descriptions for each table and key columns (scope: "table" or "column")
- METRICS: Aggregation formulas at the entity level (scope: "entity", kind: "metric"). Use actual column names.
- DIMENSIONS: Categorical columns useful for slicing/filtering (scope: "column", kind: "dimension")

Respond ONLY with valid JSON, no markdown:
{{
  "entries": [
    {{
      "kind": "definition|metric|dimension",
      "scope": "entity|table|column",
      "target_name": "table_name or column_name",
      "name": "business name",
      "description": "business description",
      "formula": "SQL expression (metrics only, null otherwise)",
      "source_column": "column_name (dimensions only, null otherwise)",
      "source_table": "full.table.name (dimensions only, null otherwise)",
      "confidence_score": 0.0
    }}
  ]
}}"""

    raw = _call_model(prompt, model_endpoint, warehouse_id)
    parsed = _parse_json_response(raw)
    return parsed.get("entries", [])

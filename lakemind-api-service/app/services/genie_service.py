"""
Genie Service — create and manage Databricks Genie spaces.
Uses the Databricks Python SDK with the user's access token.
"""
import json
import os
import logging
import uuid

from databricks.sdk import WorkspaceClient

logger = logging.getLogger(__name__)

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")


def _get_host() -> str:
    host = DATABRICKS_HOST
    if not host.startswith(("http://", "https://")):
        host = f"https://{host}"
    return host.rstrip("/")


def _get_client(token: str) -> WorkspaceClient:
    return WorkspaceClient(host=_get_host(), token=token)


def _build_serialized_space(
    table_identifiers: list[str],
    instructions: str = "",
) -> str:
    """
    Build the serialized_space JSON in the Genie export format (version 2).
    Tables must be sorted by identifier.
    Instructions go under instructions.text_instructions.
    IDs must be lowercase 32-hex UUIDs without hyphens.
    """
    sorted_tables = sorted(table_identifiers)

    space_def: dict = {
        "version": 2,
        "data_sources": {
            "tables": [{"identifier": t} for t in sorted_tables],
        },
    }

    if instructions:
        space_def["instructions"] = {
            "text_instructions": [
                {
                    "id": uuid.uuid4().hex,
                    "content": [instructions],
                }
            ],
        }

    return json.dumps(space_def)


def create_genie_space(
    display_name: str,
    description: str,
    table_identifiers: list[str],
    warehouse_id: str,
    token: str,
    instructions: str = "",
) -> dict:
    """
    Create a new Genie space using the Databricks SDK.
    Glossary instructions are embedded in the serialized_space
    under instructions.text_instructions.
    """
    serialized = _build_serialized_space(table_identifiers, instructions)

    logger.info(
        f"Creating Genie space '{display_name}' with {len(table_identifiers)} tables, "
        f"warehouse={warehouse_id}"
    )

    try:
        client = _get_client(token)
        result = client.genie.create_space(
            warehouse_id=warehouse_id,
            serialized_space=serialized,
            title=display_name,
            description=description,
        )

        space_id = result.space_id
        logger.info(f"Genie space created: {space_id}")
        return {
            "space_id": space_id,
            "display_name": result.title or display_name,
            "url": f"{_get_host()}/genie/rooms/{space_id}",
        }
    except Exception as e:
        logger.error(f"Failed to create Genie space: {e}")
        return {"error": str(e)}


def update_genie_space(
    space_id: str,
    display_name: str,
    description: str,
    table_identifiers: list[str],
    token: str,
    instructions: str = "",
) -> dict:
    """Update an existing Genie space's instructions and tables."""
    serialized = _build_serialized_space(table_identifiers, instructions)

    logger.info(f"Updating Genie space '{space_id}' with {len(table_identifiers)} tables")

    try:
        client = _get_client(token)
        result = client.genie.update_space(
            space_id=space_id,
            serialized_space=serialized,
            title=display_name,
            description=description,
        )
        logger.info(f"Genie space updated: {space_id}")
        return {
            "space_id": space_id,
            "display_name": display_name,
            "url": f"{_get_host()}/genie/rooms/{space_id}",
        }
    except Exception as e:
        logger.error(f"Failed to update Genie space: {e}")
        return {"error": str(e)}

import os
from fastapi import APIRouter, HTTPException

import logging

logger = logging.getLogger(__name__)

compute_router = APIRouter(tags=["Compute API"], prefix="/compute")

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("LAKEMIND_DATABRICKS_DAPI", "")


def _get_workspace_client():
    from databricks.sdk import WorkspaceClient

    return WorkspaceClient(host=DATABRICKS_HOST, token=DATABRICKS_TOKEN)


@compute_router.get("/list-warehouses")
def list_warehouses():
    """List all SQL warehouses in the Databricks workspace."""
    try:
        client = _get_workspace_client()
        warehouses = []
        for w in client.warehouses.list():
            warehouses.append(
                {
                    "id": w.id,
                    "name": w.name,
                    "state": str(w.state.value) if w.state else "UNKNOWN",
                    "cluster_size": w.cluster_size or "",
                    "enable_serverless_compute": getattr(
                        w, "enable_serverless_compute", False
                    ),
                }
            )
        return {"status": "ok", "data": warehouses}
    except Exception as e:
        logger.error(f"Failed to list warehouses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@compute_router.get("/list-serving-endpoints")
def list_serving_endpoints():
    """List LLM model serving endpoints in the Databricks workspace.
    Filters to foundation model and LLM endpoints only."""
    try:
        client = _get_workspace_client()
        endpoints = []
        for ep in client.serving_endpoints.list():
            # Filter: only include LLM/foundation model endpoints
            # Skip feature serving, vector search, and custom ML endpoints
            endpoint_type = getattr(ep, "endpoint_type", None)
            task = getattr(ep, "task", None)
            name_lower = (ep.name or "").lower()

            is_llm = False
            # Check by endpoint type
            if endpoint_type and "FOUNDATION_MODEL" in str(endpoint_type):
                is_llm = True
            # Check by task type
            elif task and any(t in str(task).lower() for t in ["llm", "chat", "completion", "text_generation"]):
                is_llm = True
            # Check by name patterns (common LLM naming)
            elif any(kw in name_lower for kw in [
                "gpt", "llama", "mistral", "claude", "gemini", "dbrx",
                "mixtral", "codellama", "llm", "chat", "instruct",
                "databricks-meta", "databricks-dbrx", "databricks-mixtral",
                "oss-", "foundation",
            ]):
                is_llm = True
            # Check served entities for foundation model config
            elif hasattr(ep, "config") and ep.config:
                served = getattr(ep.config, "served_entities", None) or getattr(ep.config, "served_models", None) or []
                for se in served:
                    fm = getattr(se, "foundation_model", None)
                    if fm:
                        is_llm = True
                        break

            if not is_llm:
                continue

            state = ""
            if ep.state and ep.state.ready:
                state = str(ep.state.ready)
            endpoints.append(
                {
                    "name": ep.name,
                    "state": state,
                    "creator": getattr(ep, "creator", ""),
                }
            )
        return {"status": "ok", "data": endpoints}
    except Exception as e:
        logger.error(f"Failed to list serving endpoints: {e}")
        raise HTTPException(status_code=500, detail=str(e))

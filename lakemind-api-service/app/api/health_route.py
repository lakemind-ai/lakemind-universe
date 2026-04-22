from fastapi import APIRouter
from app.utils.lm_utils import get_version_info, get_databricks_host

health_router = APIRouter(tags=["Health Check API"], prefix="/health")


@health_router.get("/ping")
def health():
    return {"status": "ok"}


@health_router.get("/version")
def version():
    return {"status": "ok", "data": get_version_info()}


@health_router.get("/databricks")
def databricks_status():
    host = get_databricks_host()
    return {
        "status": "ok" if host else "unconfigured",
        "databricks_host": host or "not configured",
        "databricks_configured": bool(host),
    }

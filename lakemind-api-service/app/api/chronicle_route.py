from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.utils.app_db import get_db
from app.services import chronicle_service

import logging

logger = logging.getLogger(__name__)

chronicle_router = APIRouter(tags=["Chronicle API"], prefix="/chronicle")


@chronicle_router.get("/realms/{realm_id}/versions")
def list_versions(realm_id: int, db: Session = Depends(get_db)):
    """List all versions for a realm."""
    return {"status": "ok", "data": chronicle_service.list_versions(realm_id, db)}


@chronicle_router.post("/realms/{realm_id}/versions")
def create_version(realm_id: int, db: Session = Depends(get_db)):
    """Create a new draft version by snapshotting the current approved glossary."""
    data = chronicle_service.create_version(realm_id, "user", db)
    if not data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return {"status": "ok", "data": data}


@chronicle_router.get("/versions/{version_id}")
def get_version(version_id: int, db: Session = Depends(get_db)):
    """Get a version with full details including diff and Genie instructions."""
    data = chronicle_service.get_version(version_id, db)
    if not data:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"status": "ok", "data": data}


@chronicle_router.delete("/versions/{version_id}")
def delete_version(version_id: int, db: Session = Depends(get_db)):
    """Delete a draft version."""
    error = chronicle_service.delete_version(version_id, db)
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Version not found")
    if error == "cannot_delete_published":
        raise HTTPException(status_code=400, detail="Cannot delete a published version")
    return {"status": "ok", "message": "Version deleted"}


@chronicle_router.post("/versions/{version_id}/refresh")
def refresh_version(version_id: int, db: Session = Depends(get_db)):
    """Refresh a draft version — re-snapshot glossary and recompute diff against last published."""
    data = chronicle_service.refresh_version(version_id, "user", db)
    if not data:
        raise HTTPException(status_code=404, detail="Version not found or not a draft")
    return {"status": "ok", "data": data}


class CreateGenieRequest(BaseModel):
    warehouse_id: str


@chronicle_router.post("/versions/{version_id}/create-genie")
def create_genie(version_id: int, payload: CreateGenieRequest, request: Request, db: Session = Depends(get_db)):
    """Create a Databricks Genie space from a published version using the user's token."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    if not token:
        raise HTTPException(status_code=401, detail="No authorization token provided")

    data = chronicle_service.create_genie_from_version(version_id, payload.warehouse_id, token, db)
    if data is None:
        raise HTTPException(status_code=404, detail="Version not found or not published")
    if "error" in data:
        raise HTTPException(status_code=502, detail=data.get("detail", data["error"]))
    return {"status": "ok", "data": data}


@chronicle_router.post("/versions/{version_id}/update-genie")
def update_genie(version_id: int, request: Request, db: Session = Depends(get_db)):
    """Update existing Genie space with instructions from a published version."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    if not token:
        raise HTTPException(status_code=401, detail="No authorization token provided")

    data = chronicle_service.update_genie_from_version(version_id, token, db)
    if data is None:
        raise HTTPException(status_code=404, detail="Version not found or not published")
    if "error" in data:
        raise HTTPException(status_code=502, detail=data.get("detail", data["error"]))
    return {"status": "ok", "data": data}


@chronicle_router.post("/versions/{version_id}/publish")
def publish_version(version_id: int, db: Session = Depends(get_db)):
    """Publish a version — generates Genie instructions and marks as published."""
    data = chronicle_service.publish_version(version_id, "user", db)
    if not data:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"status": "ok", "data": data}

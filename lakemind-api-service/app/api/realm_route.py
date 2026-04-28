from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.utils.app_db import get_db
from app.services import realm_service

import logging

logger = logging.getLogger(__name__)

realm_router = APIRouter(tags=["Realm API"], prefix="/realm")


class RealmCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    entity_ids: list[int] = []


class RealmUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class RealmAssignRequest(BaseModel):
    entity_ids: list[int]


@realm_router.get("/realms")
def list_realms(db: Session = Depends(get_db)):
    """List all realms with summary stats."""
    return {"status": "ok", "data": realm_service.list_realms(db)}


@realm_router.get("/realms/{realm_id}")
def get_realm(realm_id: int, db: Session = Depends(get_db)):
    """Get a realm with entity details."""
    data = realm_service.get_realm(realm_id, db)
    if not data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return {"status": "ok", "data": data}


@realm_router.post("/realms")
def create_realm(payload: RealmCreateRequest, db: Session = Depends(get_db)):
    """Create a new realm."""
    data = realm_service.create_realm(
        name=payload.name,
        description=payload.description,
        entity_ids=payload.entity_ids,
        created_by="user",
        db=db,
    )
    return {"status": "ok", "data": data}


@realm_router.patch("/realms/{realm_id}")
def update_realm(realm_id: int, payload: RealmUpdateRequest, db: Session = Depends(get_db)):
    """Update a realm's name and description."""
    data = realm_service.update_realm(realm_id, payload.name, payload.description, db)
    if not data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return {"status": "ok", "data": data}


@realm_router.post("/realms/{realm_id}/entities")
def assign_entities(realm_id: int, payload: RealmAssignRequest, db: Session = Depends(get_db)):
    """Assign entities to a realm (replaces existing assignments)."""
    data = realm_service.assign_entities(realm_id, payload.entity_ids, "user", db)
    if not data:
        raise HTTPException(status_code=404, detail="Realm not found")
    return {"status": "ok", "data": data}


@realm_router.delete("/realms/{realm_id}")
def delete_realm(realm_id: int, db: Session = Depends(get_db)):
    """Delete a realm."""
    success = realm_service.delete_realm(realm_id, "user", db)
    if not success:
        raise HTTPException(status_code=404, detail="Realm not found")
    return {"status": "ok", "message": "Realm deleted"}


@realm_router.get("/available-entities")
def get_available_entities(db: Session = Depends(get_db)):
    """Get all entities available for realm assignment."""
    return {"status": "ok", "data": realm_service.get_available_entities(db)}

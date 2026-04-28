from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.utils.app_db import get_db
from app.services import lexicon_service

import logging

logger = logging.getLogger(__name__)

lexicon_router = APIRouter(tags=["Lexicon API"], prefix="/lexicon")


class BulkApproveRequest(BaseModel):
    entries: list[dict]  # [{source_type, id}]


@lexicon_router.get("/realms/{realm_id}/entries")
def get_lexicon_entries(
    realm_id: int,
    kind: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get all glossary entries for a realm with optional filters."""
    entries = lexicon_service.get_lexicon_entries(realm_id, db, kind=kind, status=status, search=search)
    return {"status": "ok", "data": entries}


@lexicon_router.get("/realms/{realm_id}/stats")
def get_lexicon_stats(realm_id: int, db: Session = Depends(get_db)):
    """Get summary stats for a realm's lexicon."""
    stats = lexicon_service.get_lexicon_stats(realm_id, db)
    return {"status": "ok", "data": stats}


@lexicon_router.post("/realms/{realm_id}/bulk-approve")
def bulk_approve(realm_id: int, payload: BulkApproveRequest, db: Session = Depends(get_db)):
    """Bulk approve glossary entries."""
    count = lexicon_service.bulk_approve(realm_id, payload.entries, "user", db)
    return {"status": "ok", "data": {"approved_count": count}}

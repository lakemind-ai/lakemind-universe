"""
Lexicon Service — per-realm glossary view across all entities.
Aggregates definitions, metrics, and dimensions for a realm.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.realm import Realm, RealmEntity
from app.models.scan import DetectedEntity, DetectedTable, DetectedColumn
from app.models.entity import GlossaryMetric, GlossaryDimension
from app.models.glossary import GlossaryEntry

logger = logging.getLogger(__name__)


def get_lexicon_entries(
    realm_id: int,
    db: Session,
    kind: str = None,
    status: str = None,
    search: str = None,
) -> list[dict]:
    """
    Get all glossary entries for a realm — metrics, dimensions, and definitions.
    Supports filtering by kind, status, and search text.
    """
    # Get entity IDs in this realm
    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return []

    entity_ids = [re.entity_id for re in realm.entities]
    if not entity_ids:
        return []

    entries = []

    # Metrics (entity-level)
    metrics = db.query(GlossaryMetric).filter(
        GlossaryMetric.entity_id.in_(entity_ids)
    ).all()
    for m in metrics:
        entity = db.query(DetectedEntity).filter(DetectedEntity.id == m.entity_id).first()
        entries.append({
            "id": m.id,
            "source_type": "metric",
            "kind": "metric",
            "scope": "entity",
            "entity_id": m.entity_id,
            "entity_name": entity.name if entity else "",
            "name": m.name,
            "description": m.description or "",
            "formula": m.formula or "",
            "source_column": "",
            "source_table": m.backing_table or "",
            "confidence_score": m.confidence_score,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        })

    # Dimensions (column-level)
    dimensions = db.query(GlossaryDimension).filter(
        GlossaryDimension.entity_id.in_(entity_ids)
    ).all()
    for d in dimensions:
        entity = db.query(DetectedEntity).filter(DetectedEntity.id == d.entity_id).first()
        entries.append({
            "id": d.id,
            "source_type": "dimension",
            "kind": "dimension",
            "scope": "column",
            "entity_id": d.entity_id,
            "entity_name": entity.name if entity else "",
            "name": d.name,
            "description": d.description or "",
            "formula": "",
            "source_column": d.source_column or "",
            "source_table": d.source_table or "",
            "confidence_score": d.confidence_score,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        })

    # Column definitions from GlossaryEntry table (if any were created via MindScan)
    gl_entries = db.query(GlossaryEntry).filter(
        GlossaryEntry.entity_id.in_(entity_ids),
        GlossaryEntry.status != "rejected",
    ).all()
    for g in gl_entries:
        entity = db.query(DetectedEntity).filter(DetectedEntity.id == g.entity_id).first()
        # Map scan "accepted" → lexicon "proposed" (needs explicit glossary approval)
        lexicon_status = "proposed" if g.status == "accepted" else g.status
        entries.append({
            "id": g.id,
            "source_type": "glossary_entry",
            "kind": g.kind,
            "scope": g.scope,
            "entity_id": g.entity_id,
            "entity_name": entity.name if entity else "",
            "name": g.name,
            "description": g.description or "",
            "formula": g.formula or "",
            "source_column": g.source_column or "",
            "source_table": g.source_table or "",
            "confidence_score": g.confidence_score,
            "status": lexicon_status,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "updated_at": g.updated_at.isoformat() if g.updated_at else None,
        })

    # Deduplicate by (kind, entity_name, name) — metrics/dimensions may exist in
    # both dedicated tables and the unified GlossaryEntry table.  Keep the
    # dedicated-table version first (it has the authoritative status).
    seen = set()
    deduped = []
    for e in entries:
        key = (e["kind"], e["entity_name"], e["name"])
        if key not in seen:
            seen.add(key)
            deduped.append(e)
    entries = deduped

    # Apply filters
    if kind:
        entries = [e for e in entries if e["kind"] == kind]
    if status:
        entries = [e for e in entries if e["status"] == status]
    if search:
        q = search.lower()
        entries = [
            e for e in entries
            if q in e["name"].lower()
            or q in e["description"].lower()
            or q in e["entity_name"].lower()
            or q in e["source_column"].lower()
        ]

    # Sort: proposed first, then by entity name, then by name
    status_order = {"proposed": 0, "approved": 1, "rejected": 2}
    entries.sort(key=lambda e: (status_order.get(e["status"], 9), e["entity_name"], e["name"]))

    return entries


def get_lexicon_stats(realm_id: int, db: Session) -> dict:
    """Get summary stats for a realm's lexicon."""
    entries = get_lexicon_entries(realm_id, db)
    return {
        "total": len(entries),
        "metrics": len([e for e in entries if e["kind"] == "metric"]),
        "dimensions": len([e for e in entries if e["kind"] == "dimension"]),
        "definitions": len([e for e in entries if e["kind"] == "definition"]),
        "proposed": len([e for e in entries if e["status"] == "proposed"]),
        "approved": len([e for e in entries if e["status"] == "approved"]),
        "rejected": len([e for e in entries if e["status"] == "rejected"]),
    }


def bulk_approve(
    realm_id: int,
    entry_ids: list[dict],
    actor: str,
    db: Session,
) -> int:
    """
    Bulk approve entries. entry_ids is a list of {source_type, id}.
    Returns count of approved items.
    """
    count = 0
    for item in entry_ids:
        source_type = item.get("source_type")
        item_id = item.get("id")

        if source_type == "metric":
            m = db.query(GlossaryMetric).filter(GlossaryMetric.id == item_id).first()
            if m and m.status != "approved":
                m.status = "approved"
                m.approved_by = actor
                m.approved_at = datetime.now(timezone.utc)
                count += 1

        elif source_type == "dimension":
            d = db.query(GlossaryDimension).filter(GlossaryDimension.id == item_id).first()
            if d and d.status != "approved":
                d.status = "approved"
                d.approved_by = actor
                d.approved_at = datetime.now(timezone.utc)
                count += 1

        elif source_type == "glossary_entry":
            g = db.query(GlossaryEntry).filter(GlossaryEntry.id == item_id).first()
            if g and g.status != "approved":
                g.status = "approved"
                count += 1

    db.commit()
    return count

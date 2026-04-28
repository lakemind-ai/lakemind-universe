"""
Realm Service — manages realm CRUD, entity assignment, and realm-scoped queries.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.realm import Realm, RealmEntity
from app.models.scan import DetectedEntity
from app.models.entity import GlossaryMetric, GlossaryDimension
from app.models.glossary import GlossaryEntry
from app.services.audit_service import log_activity

logger = logging.getLogger(__name__)


def list_realms(db: Session) -> list[dict]:
    """List all realms with entity counts and summary stats."""
    realms = db.query(Realm).order_by(Realm.updated_at.desc()).all()
    result = []
    for realm in realms:
        data = realm.to_json()
        # Compute summary stats
        entity_ids = data["entity_ids"]
        if entity_ids:
            data["table_count"] = sum(
                len(e.tables) for e in db.query(DetectedEntity).filter(
                    DetectedEntity.id.in_(entity_ids)
                ).all()
            )
            data["metric_count"] = db.query(GlossaryMetric).filter(
                GlossaryMetric.entity_id.in_(entity_ids)
            ).count()
            data["dimension_count"] = db.query(GlossaryDimension).filter(
                GlossaryDimension.entity_id.in_(entity_ids)
            ).count()
        else:
            data["table_count"] = 0
            data["metric_count"] = 0
            data["dimension_count"] = 0
        result.append(data)
    return result


def get_realm(realm_id: int, db: Session) -> dict | None:
    """Get a realm with full entity details."""
    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return None
    data = realm.to_json()

    # Include entity details
    entity_ids = data["entity_ids"]
    entities = []
    if entity_ids:
        for entity in db.query(DetectedEntity).filter(DetectedEntity.id.in_(entity_ids)).all():
            e = entity.to_json()
            e["metric_count"] = db.query(GlossaryMetric).filter(
                GlossaryMetric.entity_id == entity.id
            ).count()
            e["dimension_count"] = db.query(GlossaryDimension).filter(
                GlossaryDimension.entity_id == entity.id
            ).count()
            e["table_count"] = len(entity.tables)
            entities.append(e)
    data["entities"] = entities
    return data


def create_realm(
    name: str,
    description: str,
    entity_ids: list[int],
    created_by: str,
    db: Session,
) -> dict:
    """Create a new realm and assign entities to it."""
    realm = Realm(
        name=name,
        description=description,
        status="draft",
        created_by=created_by,
    )
    db.add(realm)
    db.flush()

    for eid in entity_ids:
        re = RealmEntity(realm_id=realm.id, entity_id=eid, added_by=created_by)
        db.add(re)

    log_activity(
        db, action="realm.create", module="realms", actor=created_by,
        entity_type="realm", entity_id=str(realm.id),
        detail=f"Created realm '{name}' with {len(entity_ids)} entities",
        source="manual",
    )

    db.commit()
    db.refresh(realm)
    return realm.to_json()


def update_realm(
    realm_id: int,
    name: str | None,
    description: str | None,
    db: Session,
) -> dict | None:
    """Update realm name and description."""
    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return None

    if name is not None:
        realm.name = name
    if description is not None:
        realm.description = description
    realm.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(realm)
    return realm.to_json()


def assign_entities(
    realm_id: int,
    entity_ids: list[int],
    actor: str,
    db: Session,
) -> dict | None:
    """Replace the entity assignments for a realm."""
    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return None

    # Remove existing assignments
    db.query(RealmEntity).filter(RealmEntity.realm_id == realm_id).delete()

    # Add new assignments
    for eid in entity_ids:
        re = RealmEntity(realm_id=realm_id, entity_id=eid, added_by=actor)
        db.add(re)

    realm.updated_at = datetime.now(timezone.utc)

    log_activity(
        db, action="realm.assign_entities", module="realms", actor=actor,
        entity_type="realm", entity_id=str(realm_id),
        detail=f"Assigned {len(entity_ids)} entities to realm '{realm.name}'",
        source="manual",
    )

    db.commit()
    db.refresh(realm)
    return realm.to_json()


def delete_realm(realm_id: int, actor: str, db: Session) -> bool:
    """Delete a realm."""
    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return False

    realm_name = realm.name
    db.delete(realm)

    log_activity(
        db, action="realm.delete", module="realms", actor=actor,
        entity_type="realm", entity_id=str(realm_id),
        detail=f"Deleted realm '{realm_name}'",
        source="manual",
    )

    db.commit()
    return True


def get_available_entities(db: Session) -> list[dict]:
    """Get all approved entities that can be assigned to realms."""
    entities = db.query(DetectedEntity).filter(
        DetectedEntity.status.in_(["approved", "pending"])
    ).order_by(DetectedEntity.name).all()

    result = []
    for e in entities:
        data = e.to_json()
        data["table_count"] = len(e.tables)
        data["metric_count"] = db.query(GlossaryMetric).filter(
            GlossaryMetric.entity_id == e.id
        ).count()
        data["dimension_count"] = db.query(GlossaryDimension).filter(
            GlossaryDimension.entity_id == e.id
        ).count()
        # Check which realms this entity belongs to
        data["realm_ids"] = [
            re.realm_id for re in db.query(RealmEntity).filter(
                RealmEntity.entity_id == e.id
            ).all()
        ]
        result.append(data)
    return result

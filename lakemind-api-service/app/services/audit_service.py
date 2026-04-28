"""
Audit Service — logs all user and system actions to activity_logs table.
"""
import json
import logging
from sqlalchemy.orm import Session
from app.models.activity_log import ActivityLog

logger = logging.getLogger(__name__)


def log_activity(
    db: Session,
    action: str,
    module: str,
    actor: str = "system",
    entity_type: str = None,
    entity_id: str = None,
    detail: str = None,
    extra_data: dict = None,
    source: str = "system",
):
    """Persist an activity log entry."""
    try:
        entry = ActivityLog(
            action=action,
            module=module,
            actor=actor,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            detail=detail,
            extra_data=json.dumps(extra_data) if extra_data else None,
            source=source,
        )
        db.add(entry)
        db.flush()
    except Exception as e:
        logger.warning(f"Failed to write audit log: {e}")


def get_activity_logs(
    db: Session,
    module: str = None,
    entity_type: str = None,
    entity_id: str = None,
    limit: int = 50,
) -> list[dict]:
    """Query activity logs with optional filters."""
    query = db.query(ActivityLog).order_by(ActivityLog.created_at.desc())

    if module:
        query = query.filter(ActivityLog.module == module)
    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(ActivityLog.entity_id == str(entity_id))

    return [entry.to_json() for entry in query.limit(limit).all()]

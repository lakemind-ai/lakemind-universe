from sqlalchemy import Column, Integer, String, Text, DateTime
from app.utils.database import Base
from datetime import datetime, timezone


class ActivityLog(Base):
    """Audit trail for all user and system actions across LakeMind."""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(255), nullable=False)  # e.g. "mindscan.start", "proposal.accept"
    module = Column(String(100), nullable=False)  # mindscan | entity_hub | lexicon | chronicle
    actor = Column(String(255), nullable=True)  # username or "system"
    entity_type = Column(String(100), nullable=True)  # scan | entity | proposal | glossary_entry | realm | version
    entity_id = Column(String(50), nullable=True)  # ID of the affected record
    detail = Column(Text, nullable=True)  # human-readable description
    extra_data = Column(Text, nullable=True)  # JSON for extra context
    source = Column(String(50), nullable=True)  # manual | ai | system | api
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_json(self):
        return {
            "id": self.id,
            "action": self.action,
            "module": self.module,
            "actor": self.actor,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "detail": self.detail,
            "extra_data": self.extra_data,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

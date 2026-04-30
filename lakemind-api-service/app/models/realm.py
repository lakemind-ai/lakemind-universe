from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.utils.database import Base
from datetime import datetime, timezone


class Realm(Base):
    """A realm groups entities into a publishable unit for versioning and Genie publishing."""
    __tablename__ = "realms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="draft")  # draft | published | archived
    genie_workspace_id = Column(String(255), nullable=True)
    genie_workspace_name = Column(String(255), nullable=True)
    genie_deployed_version = Column(Integer, nullable=True)
    latest_version = Column(Integer, nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    entities = relationship("RealmEntity", back_populates="realm", cascade="all, delete-orphan")

    def to_json(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "genie_workspace_id": self.genie_workspace_id,
            "genie_workspace_name": self.genie_workspace_name,
            "genie_deployed_version": self.genie_deployed_version,
            "latest_version": self.latest_version,
            "entity_count": len(self.entities) if self.entities else 0,
            "entity_ids": [re.entity_id for re in self.entities] if self.entities else [],
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class RealmEntity(Base):
    """Junction table linking realms to entities."""
    __tablename__ = "realm_entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    realm_id = Column(Integer, ForeignKey("realms.id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="CASCADE"), nullable=False)
    added_by = Column(String(255), nullable=True)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    realm = relationship("Realm", back_populates="entities")

    __table_args__ = (
        UniqueConstraint("realm_id", "entity_id", name="uq_realm_entity"),
    )

    def to_json(self):
        return {
            "id": self.id,
            "realm_id": self.realm_id,
            "entity_id": self.entity_id,
            "added_by": self.added_by,
            "added_at": self.added_at.isoformat() if self.added_at else None,
        }

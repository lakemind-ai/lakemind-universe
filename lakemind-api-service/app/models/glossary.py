from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.utils.database import Base
from datetime import datetime, timezone


class GlossaryEntry(Base):
    """A unified glossary entry — definition, metric, or dimension — proposed or committed."""
    __tablename__ = "glossary_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(Integer, ForeignKey("scan_proposals.id", ondelete="CASCADE"), nullable=True)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="SET NULL"), nullable=True)
    kind = Column(String(50), nullable=False)  # definition | metric | dimension
    scope = Column(String(50), nullable=False)  # entity | table | column
    target_name = Column(String(500), nullable=True)  # the table/column this defines
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    formula = Column(Text, nullable=True)  # for metrics
    source_column = Column(String(255), nullable=True)  # for dimensions
    source_table = Column(String(500), nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="proposed")  # proposed | accepted | rejected
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    proposal = relationship("ScanProposal", back_populates="glossary_entries")

    def to_json(self):
        return {
            "id": self.id,
            "proposal_id": self.proposal_id,
            "entity_id": self.entity_id,
            "kind": self.kind,
            "scope": self.scope,
            "target_name": self.target_name,
            "name": self.name,
            "description": self.description,
            "formula": self.formula,
            "source_column": self.source_column,
            "source_table": self.source_table,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class GlossaryVersion(Base):
    """A versioned snapshot of the glossary — draft, staged, published, or archived."""
    __tablename__ = "glossary_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_number = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="draft")  # draft | staged | published | archived
    description = Column(Text, nullable=True)
    changes_summary = Column(Text, nullable=True)
    entities_added = Column(Integer, nullable=True, default=0)
    entities_modified = Column(Integer, nullable=True, default=0)
    entities_removed = Column(Integer, nullable=True, default=0)
    created_by = Column(String(255), nullable=True)
    published_by = Column(String(255), nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_json(self):
        return {
            "id": self.id,
            "version_number": self.version_number,
            "status": self.status,
            "description": self.description,
            "changes_summary": self.changes_summary,
            "entities_added": self.entities_added,
            "entities_modified": self.entities_modified,
            "entities_removed": self.entities_removed,
            "created_by": self.created_by,
            "published_by": self.published_by,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class VersionChange(Base):
    """A recorded change within a glossary version — what was added, modified, or removed."""
    __tablename__ = "version_changes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("glossary_versions.id", ondelete="CASCADE"), nullable=False)
    change_type = Column(String(50), nullable=False)  # added | modified | removed
    entity_name = Column(String(255), nullable=True)
    item_name = Column(String(255), nullable=True)
    item_type = Column(String(50), nullable=True)  # entity | metric | dimension | instruction
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String(255), nullable=True)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_json(self):
        return {
            "id": self.id,
            "version_id": self.version_id,
            "change_type": self.change_type,
            "entity_name": self.entity_name,
            "item_name": self.item_name,
            "item_type": self.item_type,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
        }


class AuditEntry(Base):
    """An audit trail entry for glossary version lifecycle events."""
    __tablename__ = "audit_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(Integer, ForeignKey("glossary_versions.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(255), nullable=False)
    actor = Column(String(255), nullable=True)
    detail = Column(Text, nullable=True)
    source = Column(String(50), nullable=True)  # manual | scoped_chat | ai
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_json(self):
        return {
            "id": self.id,
            "version_id": self.version_id,
            "action": self.action,
            "actor": self.actor,
            "detail": self.detail,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

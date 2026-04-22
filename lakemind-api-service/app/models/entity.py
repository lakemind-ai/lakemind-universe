from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.utils.database import Base
from datetime import datetime, timezone


class GlossaryMetric(Base):
    """A metric or KPI defined on an entity for the semantic layer."""
    __tablename__ = "glossary_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    metric_type = Column(String(50), nullable=False, default="metric")  # metric | kpi
    description = Column(Text, nullable=True)
    formula = Column(Text, nullable=True)  # SQL expression e.g. SUM(amount)
    backing_table = Column(String(500), nullable=True)  # full table name
    sample_count = Column(Integer, nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="proposed")  # proposed | approved | rejected
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    entity = relationship("DetectedEntity", back_populates="metrics")

    def to_json(self):
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "name": self.name,
            "metric_type": self.metric_type,
            "description": self.description,
            "formula": self.formula,
            "backing_table": self.backing_table,
            "sample_count": self.sample_count,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class GlossaryDimension(Base):
    """A dimension column identified for an entity in the semantic layer."""
    __tablename__ = "glossary_dimensions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_column = Column(String(255), nullable=True)
    source_table = Column(String(500), nullable=True)
    cardinality = Column(String(50), nullable=True)  # low | medium | high
    null_rate = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="proposed")  # proposed | approved | rejected
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    entity = relationship("DetectedEntity", back_populates="dimensions")

    def to_json(self):
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "name": self.name,
            "description": self.description,
            "source_column": self.source_column,
            "source_table": self.source_table,
            "cardinality": self.cardinality,
            "null_rate": self.null_rate,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class GenieInstruction(Base):
    """A generated instruction for a Genie workspace derived from the glossary."""
    __tablename__ = "genie_instructions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="CASCADE"), nullable=False)
    instruction_text = Column(Text, nullable=False)
    instruction_type = Column(String(50), nullable=False, default="guidance")  # filter | guidance | naming
    workspace_name = Column(String(255), nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    entity = relationship("DetectedEntity", back_populates="instructions")

    def to_json(self):
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "instruction_text": self.instruction_text,
            "instruction_type": self.instruction_type,
            "workspace_name": self.workspace_name,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.utils.database import Base
from datetime import datetime, timezone


class CatalogScan(Base):
    """A recorded scan of a Unity Catalog catalog."""
    __tablename__ = "catalog_scans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    catalog_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending | scanning | complete | failed
    schema_count = Column(Integer, nullable=True)
    table_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    entity_count = Column(Integer, nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    entities = relationship("DetectedEntity", back_populates="scan", cascade="all, delete-orphan")

    def to_json(self):
        return {
            "id": self.id,
            "catalog_name": self.catalog_name,
            "status": self.status,
            "schema_count": self.schema_count,
            "table_count": self.table_count,
            "column_count": self.column_count,
            "entity_count": self.entity_count,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class DetectedEntity(Base):
    """An entity detected during a catalog scan — a logical grouping of related tables."""
    __tablename__ = "detected_entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(Integer, ForeignKey("catalog_scans.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    entity_type = Column(String(50), nullable=False, default="ai_derived")  # golden | ai_derived | uncategorized
    source_hint = Column(String(500), nullable=True)  # e.g. "from LakeFusion metadata"
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # pending | approved | rejected
    pii_flag = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    scan = relationship("CatalogScan", back_populates="entities")
    tables = relationship("DetectedTable", back_populates="entity", cascade="all, delete-orphan")
    metrics = relationship("GlossaryMetric", back_populates="entity", cascade="all, delete-orphan")
    dimensions = relationship("GlossaryDimension", back_populates="entity", cascade="all, delete-orphan")
    instructions = relationship("GenieInstruction", back_populates="entity", cascade="all, delete-orphan")

    def to_json(self):
        return {
            "id": self.id,
            "scan_id": self.scan_id,
            "name": self.name,
            "description": self.description,
            "entity_type": self.entity_type,
            "source_hint": self.source_hint,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "pii_flag": self.pii_flag,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DetectedTable(Base):
    """A table discovered within a detected entity."""
    __tablename__ = "detected_tables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="CASCADE"), nullable=False)
    catalog = Column(String(255), nullable=False)
    schema_name = Column(String(255), nullable=False)
    table_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    column_count = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default="detected")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    entity = relationship("DetectedEntity", back_populates="tables")
    columns = relationship("DetectedColumn", back_populates="table", cascade="all, delete-orphan")

    def to_json(self):
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "catalog": self.catalog,
            "schema_name": self.schema_name,
            "table_name": self.table_name,
            "description": self.description,
            "column_count": self.column_count,
            "row_count": self.row_count,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DetectedColumn(Base):
    """A column discovered within a detected table."""
    __tablename__ = "detected_columns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_id = Column(Integer, ForeignKey("detected_tables.id", ondelete="CASCADE"), nullable=False)
    column_name = Column(String(255), nullable=False)
    data_type = Column(String(100), nullable=True)
    null_rate = Column(Float, nullable=True)
    distinct_count = Column(Integer, nullable=True)
    sample_values = Column(Text, nullable=True)  # JSON string of sample values
    business_name = Column(String(255), nullable=True)
    business_description = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="ok")  # ok | needs_review | approved | rejected
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    table = relationship("DetectedTable", back_populates="columns")

    def to_json(self):
        return {
            "id": self.id,
            "table_id": self.table_id,
            "column_name": self.column_name,
            "data_type": self.data_type,
            "null_rate": self.null_rate,
            "distinct_count": self.distinct_count,
            "sample_values": self.sample_values,
            "business_name": self.business_name,
            "business_description": self.business_description,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

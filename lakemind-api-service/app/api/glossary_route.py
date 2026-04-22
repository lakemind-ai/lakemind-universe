import json
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.utils.app_db import get_db
from app.models.scan import DetectedEntity, DetectedTable, DetectedColumn
from app.models.entity import GlossaryMetric, GlossaryDimension, GenieInstruction
from app.models.glossary import GlossaryVersion, VersionChange, AuditEntry

import logging
logger = logging.getLogger(__name__)

glossary_router = APIRouter(tags=["Glossary API"], prefix="/glossary")

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class VersionCreate(BaseModel):
    description: Optional[str] = None


# ── Versions ─────────────────────────────────────────────────────────────────

@glossary_router.get("/versions")
def list_versions(db: Session = Depends(get_db)):
    versions = db.query(GlossaryVersion).order_by(GlossaryVersion.created_at.desc()).all()
    return {"status": "ok", "data": [v.to_json() for v in versions]}


@glossary_router.post("/versions")
def create_version(payload: VersionCreate, db: Session = Depends(get_db)):
    """Create a new draft version of the glossary."""
    # Auto-increment version number
    latest = db.query(GlossaryVersion).order_by(GlossaryVersion.version_number.desc()).first()
    next_version = (latest.version_number + 1) if latest else 1

    version = GlossaryVersion(
        version_number=next_version,
        status="draft",
        description=payload.description or f"Glossary version {next_version}",
        created_by="user",
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    # Snapshot current approved entities/metrics/dimensions into changes
    approved_entities = db.query(DetectedEntity).filter(DetectedEntity.status == "approved").all()
    entities_added = 0

    for entity in approved_entities:
        # Check if entity was in previous version
        prev_change = None
        if latest:
            prev_change = db.query(VersionChange).filter(
                VersionChange.version_id == latest.id,
                VersionChange.entity_name == entity.name,
                VersionChange.change_type != "removed",
            ).first()

        change_type = "modified" if prev_change else "added"
        entities_added += 1

        # Record entity-level change
        db.add(VersionChange(
            version_id=version.id,
            change_type=change_type,
            entity_name=entity.name,
            item_name=entity.name,
            item_type="entity",
            new_value=entity.description,
            changed_by="system",
        ))

        # Record metric changes
        metrics = db.query(GlossaryMetric).filter(
            GlossaryMetric.entity_id == entity.id,
            GlossaryMetric.status == "approved",
        ).all()
        for metric in metrics:
            db.add(VersionChange(
                version_id=version.id,
                change_type=change_type,
                entity_name=entity.name,
                item_name=metric.name,
                item_type="metric",
                new_value=metric.formula,
                changed_by="system",
            ))

        # Record dimension changes
        dimensions = db.query(GlossaryDimension).filter(
            GlossaryDimension.entity_id == entity.id,
            GlossaryDimension.status == "approved",
        ).all()
        for dim in dimensions:
            db.add(VersionChange(
                version_id=version.id,
                change_type=change_type,
                entity_name=entity.name,
                item_name=dim.name,
                item_type="dimension",
                new_value=dim.source_column,
                changed_by="system",
            ))

    version.entities_added = entities_added
    version.entities_modified = 0
    version.entities_removed = 0
    version.changes_summary = f"{entities_added} entities snapshotted"

    # Audit trail
    db.add(AuditEntry(
        version_id=version.id,
        action="version_created",
        actor="user",
        detail=f"Draft version {next_version} created with {entities_added} entities",
        source="manual",
    ))

    db.commit()
    db.refresh(version)
    return {"status": "ok", "data": version.to_json()}


@glossary_router.get("/versions/{version_id}")
def get_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    data = version.to_json()
    changes = db.query(VersionChange).filter(VersionChange.version_id == version_id).all()
    data["changes"] = [c.to_json() for c in changes]
    return {"status": "ok", "data": data}


@glossary_router.get("/versions/{version_id}/diff")
def get_version_diff(version_id: int, compare_to: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Diff between two versions. If compare_to is not specified,
    diffs against the previous version.
    """
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if compare_to:
        other = db.query(GlossaryVersion).filter(GlossaryVersion.id == compare_to).first()
    else:
        other = db.query(GlossaryVersion).filter(
            GlossaryVersion.version_number == version.version_number - 1
        ).first()

    current_changes = db.query(VersionChange).filter(
        VersionChange.version_id == version_id
    ).all()
    current_items = {
        (c.entity_name, c.item_name, c.item_type): c for c in current_changes
    }

    other_items = {}
    if other:
        other_changes = db.query(VersionChange).filter(
            VersionChange.version_id == other.id
        ).all()
        other_items = {
            (c.entity_name, c.item_name, c.item_type): c for c in other_changes
        }

    diff = {
        "added": [],
        "modified": [],
        "removed": [],
    }

    # Items in current but not in other = added
    for key, change in current_items.items():
        if key not in other_items:
            diff["added"].append(change.to_json())
        else:
            old_change = other_items[key]
            if change.new_value != old_change.new_value:
                entry = change.to_json()
                entry["old_value"] = old_change.new_value
                diff["modified"].append(entry)

    # Items in other but not in current = removed
    for key, change in other_items.items():
        if key not in current_items:
            diff["removed"].append(change.to_json())

    return {
        "status": "ok",
        "data": {
            "version": version.version_number,
            "compare_to": other.version_number if other else None,
            "diff": diff,
        }
    }


@glossary_router.post("/versions/{version_id}/stage")
def stage_version(version_id: int, db: Session = Depends(get_db)):
    """Stage a draft version for review."""
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if version.status != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot stage version in '{version.status}' status")

    version.status = "staged"
    db.add(AuditEntry(
        version_id=version.id,
        action="version_staged",
        actor="user",
        detail=f"Version {version.version_number} staged for review",
        source="manual",
    ))
    db.commit()
    db.refresh(version)
    return {"status": "ok", "message": "Version staged for review", "data": version.to_json()}


@glossary_router.post("/versions/{version_id}/publish")
def publish_version(version_id: int, db: Session = Depends(get_db)):
    """
    Publish a draft/staged version:
    1. Lock the version (status -> published)
    2. Archive any previously published versions
    3. Regenerate Genie workspace instructions from approved entities
    """
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if version.status not in ("draft", "staged"):
        raise HTTPException(status_code=400, detail=f"Cannot publish version in '{version.status}' status")

    # Archive previous published versions
    published = db.query(GlossaryVersion).filter(
        GlossaryVersion.status == "published",
        GlossaryVersion.id != version_id,
    ).all()
    for pv in published:
        pv.status = "archived"

    # Publish this version
    version.status = "published"
    version.published_by = "user"
    version.published_at = datetime.now(timezone.utc)

    # Regenerate Genie instructions for all approved entities
    approved_entities = db.query(DetectedEntity).filter(DetectedEntity.status == "approved").all()
    genie_instructions_generated = 0

    for entity in approved_entities:
        metrics = db.query(GlossaryMetric).filter(
            GlossaryMetric.entity_id == entity.id,
            GlossaryMetric.status == "approved",
        ).all()
        dimensions = db.query(GlossaryDimension).filter(
            GlossaryDimension.entity_id == entity.id,
            GlossaryDimension.status == "approved",
        ).all()

        if not metrics and not dimensions:
            continue

        # Build Genie instruction text
        instruction_parts = [f"Entity: {entity.name}"]
        if entity.description:
            instruction_parts.append(f"Description: {entity.description}")

        if metrics:
            instruction_parts.append("\nMetrics:")
            for m in metrics:
                instruction_parts.append(f"- {m.name}: {m.description or ''} (Formula: {m.formula or 'N/A'})")

        if dimensions:
            instruction_parts.append("\nDimensions:")
            for d in dimensions:
                instruction_parts.append(f"- {d.name}: {d.description or ''} (Source: {d.source_column or 'N/A'})")

        instruction_text = "\n".join(instruction_parts)

        # Upsert Genie instruction
        existing_instruction = db.query(GenieInstruction).filter(
            GenieInstruction.entity_id == entity.id,
            GenieInstruction.instruction_type == "guidance",
        ).first()

        if existing_instruction:
            existing_instruction.instruction_text = instruction_text
        else:
            db.add(GenieInstruction(
                entity_id=entity.id,
                instruction_text=instruction_text,
                instruction_type="guidance",
                workspace_name="default",
                created_by="system",
            ))
        genie_instructions_generated += 1

    # Audit trail
    db.add(AuditEntry(
        version_id=version.id,
        action="version_published",
        actor="user",
        detail=f"Version {version.version_number} published with {genie_instructions_generated} Genie instructions",
        source="manual",
    ))

    db.commit()
    db.refresh(version)

    return {
        "status": "ok",
        "message": f"Version {version.version_number} published",
        "data": {
            **version.to_json(),
            "genie_instructions_generated": genie_instructions_generated,
        }
    }


@glossary_router.get("/versions/{version_id}/audit")
def get_version_audit(version_id: int, db: Session = Depends(get_db)):
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    audit = db.query(AuditEntry).filter(
        AuditEntry.version_id == version_id
    ).order_by(AuditEntry.created_at.desc()).all()
    return {"status": "ok", "data": [a.to_json() for a in audit]}
